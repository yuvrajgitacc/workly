import os
import logging
import sys
import time
from openai import OpenAI

logger = logging.getLogger(__name__)

# Initialize global key index and cache for failed keys
_current_key_idx = 0
_bad_keys = {}  # maps api_key string -> float timestamp of failure

def get_api_keys():
    """Reads Gemini API keys from environment variable."""
    keys_str = os.getenv("GEMINI_API_KEYS", "")
    keys = [k.strip() for k in keys_str.split(",") if k.strip()]
    if not keys:
        gkey = os.getenv("GEMINI_API_KEY")
        if gkey:
            keys.append(gkey)
    return keys

def get_openai_fallback_key():
    """Reads OpenAI API key from environment variable."""
    return os.getenv("OPENAI_API_KEY")

class RotateCompletions:
    def __init__(self, client_instance):
        self.client_instance = client_instance

    def create(self, **kwargs):
        keys = get_api_keys()
        model = kwargs.get("model", "gemini-1.5-flash")
        messages = kwargs.get("messages", [])
        temperature = kwargs.get("temperature", 0.2)
        response_format = kwargs.get("response_format")
        max_tokens = kwargs.get("max_tokens")
        
        # Optimize timeouts to fail fast and prevent browser/scanner hangs
        timeout = kwargs.get("timeout") or 3.0

        global _current_key_idx
        global _bad_keys

        # Filter out keys that failed recently (within last 60 seconds)
        now = time.time()
        active_keys = [k for k in keys if k not in _bad_keys or now - _bad_keys[k] > 60]

        if active_keys:
            # Try keys sequentially starting from the last working key index
            for attempt in range(len(active_keys)):
                idx = (_current_key_idx + attempt) % len(active_keys)
                key = active_keys[idx]
                
                try:
                    # Initialize client pointing to Google's OpenAI-compatible endpoint
                    client = OpenAI(
                        api_key=key,
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                        max_retries=0
                    )
                    
                    # Map standard GPT models to Gemini
                    default_flash = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
                    gemini_model = default_flash
                    if ("pro" in model.lower() or "gpt-4" in model.lower()) and "mini" not in model.lower():
                        gemini_model = "gemini-2.5-pro"
                        
                    call_kwargs = {
                        "model": gemini_model,
                        "messages": messages,
                        "temperature": temperature,
                        "timeout": timeout
                    }
                    if response_format:
                        call_kwargs["response_format"] = response_format
                    if max_tokens:
                        call_kwargs["max_tokens"] = max_tokens
                        
                    masked_key = key[:8] + "..." + key[-4:] if len(key) > 12 else "..."
                    print(f"[LLM ROTATION] Trying Gemini key {idx+1}/{len(active_keys)}: {masked_key} (timeout={timeout})", flush=True)
                    try:
                        res = client.chat.completions.create(**call_kwargs)
                        # Save working key index
                        _current_key_idx = idx
                        print(f"[LLM ROTATION] Gemini key {masked_key} succeeded!", flush=True)
                        return res
                    except Exception as inner_e:
                        _bad_keys[key] = time.time()
                        print(f"[LLM ROTATION] Gemini key {masked_key} failed: {inner_e}", flush=True)
                        if gemini_model != default_flash:
                            print(f"[LLM ROTATION] Retrying {default_flash} on key {masked_key}", flush=True)
                            logger.warning(f"Model {gemini_model} failed on key {masked_key}, falling back to {default_flash}: {str(inner_e)}")
                            call_kwargs["model"] = default_flash
                            res = client.chat.completions.create(**call_kwargs)
                            # Save working key index
                            _current_key_idx = idx
                            print(f"[LLM ROTATION] Gemini key {masked_key} fallback succeeded!", flush=True)
                            return res
                        else:
                            raise inner_e
                    
                except Exception as e:
                    _bad_keys[key] = time.time()
                    masked_key = key[:8] + "..." + key[-4:] if len(key) > 12 else "..."
                    print(f"[LLM ROTATION] Gemini key {masked_key} final error: {e}", flush=True)
            print("[LLM ROTATION] All active Gemini API keys exhausted.", flush=True)
            logger.error("All active Gemini API keys exhausted.")

        # Fallback to Groq if GROQ_API_KEY is configured
        # Supports fallback to smaller models (like llama-3.1-8b-instant) if 70B is rate-limited (429)
        groq_key = os.getenv("GROQ_API_KEY")
        if groq_key:
            client = OpenAI(
                api_key=groq_key,
                base_url="https://api.groq.com/openai/v1",
                max_retries=0
            )
            groq_models = [
                os.getenv("GROQ_MODEL", "llama-3.3-70b-specdec"),
                "llama-3.3-70b-versatile",
                "llama-3.1-8b-instant",
                "llama3-8b-8192"
            ]
            
            seen = set()
            unique_models = []
            for m in groq_models:
                if m not in seen:
                    unique_models.append(m)
                    seen.add(m)
                    
            fallback_timeout = kwargs.get("timeout") or 25.0
            for model_name in unique_models:
                print(f"[LLM ROTATION] Trying Groq model: {model_name} (timeout={fallback_timeout})", flush=True)
                try:
                    call_kwargs = {
                        "model": model_name,
                        "messages": messages,
                        "temperature": temperature,
                        "timeout": fallback_timeout
                    }
                    if response_format:
                        call_kwargs["response_format"] = response_format
                    if max_tokens:
                        call_kwargs["max_tokens"] = min(max_tokens, 4096) if max_tokens else 4096
                    res = client.chat.completions.create(**call_kwargs)
                    print(f"[LLM ROTATION] Groq model {model_name} succeeded!", flush=True)
                    return res
                except Exception as e:
                    print(f"[LLM ROTATION] Groq model {model_name} failed: {e}", flush=True)
                    logger.error(f"Groq model {model_name} failed/rate-limited: {str(e)}")

        # Fallback to OpenAI client if OPENAI_API_KEY is configured
        openai_key = get_openai_fallback_key()
        if openai_key:
            try:
                client = OpenAI(api_key=openai_key, max_retries=0)
                call_kwargs = {
                    "model": "gpt-4o-mini" if "flash" in model.lower() else model,
                    "messages": messages,
                    "temperature": temperature,
                    "timeout": fallback_timeout
                }
                if response_format:
                    call_kwargs["response_format"] = response_format
                if max_tokens:
                    call_kwargs["max_tokens"] = max_tokens
                return client.chat.completions.create(**call_kwargs)
            except Exception as e:
                logger.error(f"OpenAI fallback failed: {str(e)}")
                raise e

        raise ValueError("No working API keys configured (All Gemini keys failed, and no Groq or OpenAI key exists).")

class RotateChat:
    def __init__(self, client_instance):
        self.completions = RotateCompletions(client_instance)

class RotateLLMClient:
    """Mock OpenAI client that handles API Key rotation and Gemini compatibility."""
    def __init__(self):
        self.chat = RotateChat(self)

    def generate(self, prompt: str, system_prompt: str = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = self.chat.completions.create(
            model="gemini-1.5-flash",
            messages=messages,
            temperature=0.2
        )
        return response.choices[0].message.content
