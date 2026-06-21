import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI, seekerAPI } from '../lib/api';
import { portalAuth } from '../lib/portalApi';
import { useAuthStore } from '../stores/authStore';
import { useSeekerAuthStore } from '../stores/seekerAuthStore';
import { usePortalAuthStore } from '../stores/portalAuthStore';
import { toast } from 'react-hot-toast';
import { Loader2, Key, Copy, Check, ArrowRight, Lock } from 'lucide-react';

export default function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const setRecruiterAuth = useAuthStore((s) => s.setAuth);
  const setSeekerAuth = useSeekerAuthStore((s) => s.setAuth);
  const setPortalAuth = usePortalAuthStore((s) => s.setAuth);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [newDevData, setNewDevData] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state') || 'recruiter'; // fallback to recruiter

    if (!code) {
      setError('Authorization code is missing');
      setLoading(false);
      return;
    }

    const authenticate = async () => {
      try {
        if (state === 'seeker') {
          const data = await seekerAPI.githubLogin(code);
          setSeekerAuth(data);
          toast.success(`Welcome, ${data.seeker.full_name}!`);
          navigate('/jobs/dashboard');
        } else if (state === 'developer') {
          const data = await portalAuth.githubLogin(code);
          setPortalAuth(data);
          if (data.is_new) {
            setNewDevData(data);
            setLoading(false);
          } else {
            toast.success(`Welcome back, ${data.company_name || 'Developer'}!`);
            navigate('/developer/portal/dashboard');
          }
        } else {
          // Default to recruiter / company
          const data = await authAPI.githubLogin(code);
          setRecruiterAuth(data);
          toast.success(`Signed in successfully as ${data.name || 'Recruiter'}!`);
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('GitHub auth error:', err);
        setError(err.message || 'Authentication failed');
        setLoading(false);
      }
    };

    authenticate();
  }, [searchParams, navigate, setRecruiterAuth, setSeekerAuth, setPortalAuth]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative bg-bg overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-100 via-bg to-bg opacity-70"></div>
        <div className="relative z-10 flex flex-col items-center gap-4 p-8 max-w-md text-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin" />
          <h2 className="text-xl font-bold text-charcoal">Authenticating with GitHub</h2>
          <p className="text-sm text-gray-500">Please wait while we set up your secure session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative bg-bg overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-50/30 via-bg to-bg opacity-70"></div>
        <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl shadow-gray-200/50 border border-gray-100 text-center m-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <span className="text-red-500 font-bold text-2xl">!</span>
          </div>
          <h2 className="text-2xl font-black text-charcoal mb-2">Authentication Failed</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-accent text-white py-3.5 rounded-xl font-bold tracking-wide hover:bg-accent-dark transition-all shadow-md shadow-accent/20 hover:-translate-y-0.5"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (newDevData) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-[#0B0F19] text-gray-100 overflow-y-auto p-4 font-sans">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]"></div>

        <div className="w-full max-w-2xl bg-[#111827]/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 relative z-10 shadow-2xl shadow-black/50 my-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 mb-4 animate-pulse">
              <Key className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Welcome, Developer!
            </h1>
            <p className="text-gray-400 text-sm max-w-md">
              Your developer portal account has been created successfully. Below are your generated API keys.
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-300">Security Warning</h4>
              <p className="text-xs text-red-200/80 leading-relaxed mt-0.5">
                Make sure to copy your Secret Keys now. For security reasons, we cannot show them to you again. Keep them secure and do not share them.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Production Keys */}
            <div>
              <h3 className="text-xs font-bold text-indigo-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                Production Environment
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Public Key</label>
                  <div className="flex items-center gap-2 bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3">
                    <code className="text-xs text-gray-200 select-all font-mono break-all flex-1">{newDevData.public_key}</code>
                    <button
                      onClick={() => copyToClipboard(newDevData.public_key, 'Production Public Key')}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                      {copiedKey === 'Production Public Key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Secret Key</label>
                  <div className="flex items-center gap-2 bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3">
                    <code className="text-xs text-gray-200 select-all font-mono break-all flex-1">{newDevData.secret_key}</code>
                    <button
                      onClick={() => copyToClipboard(newDevData.secret_key, 'Production Secret Key')}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                      {copiedKey === 'Production Secret Key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Keys */}
            <div>
              <h3 className="text-xs font-bold text-purple-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                Test Environment
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Public Key</label>
                  <div className="flex items-center gap-2 bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3">
                    <code className="text-xs text-gray-200 select-all font-mono break-all flex-1">{newDevData.test_public_key}</code>
                    <button
                      onClick={() => copyToClipboard(newDevData.test_public_key, 'Test Public Key')}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                      {copiedKey === 'Test Public Key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Secret Key</label>
                  <div className="flex items-center gap-2 bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3">
                    <code className="text-xs text-gray-200 select-all font-mono break-all flex-1">{newDevData.test_secret_key}</code>
                    <button
                      onClick={() => copyToClipboard(newDevData.test_secret_key, 'Test Secret Key')}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                      {copiedKey === 'Test Secret Key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/developer/portal/dashboard')}
            className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 hover:-translate-y-0.5"
          >
            <span>Continue to Developer Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
