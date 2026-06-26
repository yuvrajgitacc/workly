import os
import logging
import numpy as np
import requests

logger = logging.getLogger(__name__)

_model_cache = None
_EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension


class RemoteEmbeddingModel:
    """
    Thin wrapper that mimics the SentenceTransformer.encode() interface,
    but sends the actual computation to a Hugging Face Space running the
    real model. This keeps ats_compatibility_agent.py and matching_agent.py
    completely unchanged -- they still just call model.encode(...) like before.
    """

    def __init__(self, base_url: str, timeout: float = 20.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def encode(self, texts, convert_to_numpy: bool = True, **kwargs):
        if isinstance(texts, str):
            texts = [texts]
        if not texts:
            return np.zeros((0, _EMBEDDING_DIM), dtype=np.float32) if convert_to_numpy else []

        try:
            api_key = os.getenv("EMBED_API_KEY", "").strip()
            payload = {"texts": texts}
            if api_key:
                payload["api_key"] = api_key
            resp = requests.post(
                f"{self.base_url}/embed",
                json=payload,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            embeddings = resp.json()["embeddings"]
        except Exception as e:
            logger.error("RemoteEmbeddingModel request to %s failed: %s", self.base_url, e)
            # Return zero vectors so callers don't crash outright. Cosine similarity
            # against an all-zero vector is ~0, which is treated as "no match" by
            # the calling agents -- safer than raising and breaking the whole request.
            embeddings = [[0.0] * _EMBEDDING_DIM for _ in texts]

        if convert_to_numpy:
            return np.array(embeddings, dtype=np.float32)
        return embeddings


def get_embedding_model():
    """
    Returns an embedding model-like object exposing .encode(), or None.

    Resolution order:
      1. HF_SPACE_EMBEDDING_URL set -> use the remote Hugging Face Space.
         (Recommended for Render / any host with <1GB RAM.)
      2. ENABLE_LOCAL_EMBEDDINGS=true -> load SentenceTransformer locally.
         (Only use this on hosts with enough RAM headroom, e.g. Cloud Run,
         a VPS, or your own machine.)
      3. Neither set -> return None. All calling agents already have
         substring-matching fallbacks for this case.
    """
    global _model_cache

    if _model_cache is not None:
        return _model_cache

    hf_space_url = os.getenv("HF_SPACE_EMBEDDING_URL", "").strip()
    if hf_space_url:
        logger.info("Using remote embedding model at %s", hf_space_url)
        _model_cache = RemoteEmbeddingModel(hf_space_url)
        return _model_cache

    enable_local = os.getenv("ENABLE_LOCAL_EMBEDDINGS", "false").lower() == "true"
    if enable_local:
        try:
            from sentence_transformers import SentenceTransformer
            _model_cache = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
            return _model_cache
        except Exception as e:
            logger.error("Failed to load local SentenceTransformer: %s", e)
            return None

    logger.info(
        "Embeddings disabled: set HF_SPACE_EMBEDDING_URL (recommended) or "
        "ENABLE_LOCAL_EMBEDDINGS=true to enable semantic matching."
    )
    return None
