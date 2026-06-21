import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seekerAPI } from '../../lib/api';
import { useSeekerAuthStore } from '../../stores/seekerAuthStore';
import toast from 'react-hot-toast';

export default function JobSeekerLoginPage() {
  const navigate = useNavigate();
  const setAuth = useSeekerAuthStore(s => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const googleClientRef = useRef(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        googleClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: "openid email profile",
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              setLoading(true);
              try {
                const data = await seekerAPI.googleLogin(tokenResponse.access_token);
                setAuth(data);
                toast.success(`Welcome, ${data.seeker.full_name}!`);
                navigate('/dashboard');
              } catch (err) {
                toast.error(err.message || 'Google login failed');
              } finally {
                setLoading(false);
              }
            }
          }
        });
      }
    };
    document.body.appendChild(script);
  }, [navigate, setAuth]);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await seekerAPI.login(form);
      setAuth(data);
      localStorage.setItem('vish_seeker_token', data.seeker_token);
      localStorage.setItem('vish_seeker_data', JSON.stringify(data.seeker));
      toast.success(`Welcome back, ${data.seeker.full_name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Left Panel */}
      <div style={styles.left}>
        <div style={styles.brand}>
          <div style={styles.logo}>V</div>
          <span style={styles.brandName}>Vishleshan</span>
        </div>
        <div style={styles.leftContent}>
          <h1 style={styles.leftHeading}>Find your<br/><span style={styles.accent}>next role</span></h1>
          <p style={styles.leftSub}>AI-powered job matching that connects your skills to the right opportunities.</p>
          <div style={styles.features}>
            {['AI Resume Enhancement', 'Smart Job Matching', 'Real-time Application Tracking', 'Fraud-verified Job Listings'].map(f => (
              <div key={f} style={styles.featureItem}>
                <span style={styles.check}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Sign in to your account</h2>
            <p style={styles.cardSub}>Job Seeker Portal</p>
          </div>

          <form onSubmit={handle} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={styles.input}
                required
              />
            </div>
            <button type="submit" disabled={loading} style={styles.btn}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={styles.orDivider}>
            <div style={styles.orLine}></div>
            <span style={styles.orText}>or</span>
            <div style={styles.orLine}></div>
          </div>

          <button 
            type="button" 
            disabled={loading}
            onClick={() => {
              if (googleClientRef.current) {
                googleClientRef.current.requestAccessToken();
              } else {
                toast.error("Google Auth is loading. Please try again in a moment.");
              }
            }}
            style={styles.ssoBtn}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M21.35,11.1H12v2.7h5.38C17,14.93,15.76,15.9,14.15,16.5l2.2,2.2c2.6-2.4,4.1-5.9,4.1-10C22.45,12.3,22,11.6,21.35,11.1z" fill="#4285F4" />
              <path d="M12,20.45c2.6,0,4.8-.85,6.4-2.3l-2.2-2.2c-.85.6-2,1-3.3,1c-3.15,0-5.8-2.15-6.75-5.05L3.9,13.9A10.45,10.45,0,0,0,12,20.45z" fill="#34A853" />
              <path d="M5.25,12.1a6.4,6.4,0,0,1,0-3.8L3.05,6A10.45,10.45,0,0,0,3.05,16.2z" fill="#FBBC05" />
              <path d="M12,5.25c1.8,0,3.2.6,4.05,1.4l2-2A10.35,10.35,0,0,0,12,1.55a10.45,10.45,0,0,0-8.1,4.45L6.1,8.1C7.05,5.2,9.7,3.15,12,5.25z" fill="#EA4335" />
            </svg>
            Sign In with Google
          </button>

          <button 
            type="button" 
            disabled={loading}
            onClick={() => {
              const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
              const redirectUri = encodeURIComponent(import.meta.env.VITE_GITHUB_REDIRECT_URI);
              window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user,user:email&state=seeker`;
            }}
            style={styles.ssoBtn}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.867 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.523-10-10-10z"/>
            </svg>
            Sign In with GitHub
          </button>

          <div style={styles.divider}><span>New to Vishleshan?</span></div>
          <Link to="/jobs/register" style={styles.registerLink}>Create an account →</Link>

          <div style={styles.companyLink}>
            Are you a company? <Link to="/login" style={{ color: '#6366f1' }}>Company Login →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif" },
  left: {
    flex: '0 0 45%', background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)',
    padding: '48px', display: 'flex', flexDirection: 'column', color: '#fff',
  },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '60px' },
  logo: {
    width: '38px', height: '38px', borderRadius: '10px',
    background: '#fff', color: '#2563eb', fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
  },
  brandName: { fontSize: '20px', fontWeight: 700 },
  leftContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  leftHeading: { fontSize: '42px', fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px' },
  accent: { color: '#93c5fd' },
  leftSub: { fontSize: '16px', color: '#bfdbfe', marginBottom: '36px', lineHeight: 1.6 },
  features: { display: 'flex', flexDirection: 'column', gap: '12px' },
  featureItem: { fontSize: '15px', color: '#dbeafe', display: 'flex', alignItems: 'center', gap: '10px' },
  check: { color: '#4ade80', fontWeight: 700, fontSize: '16px' },
  right: {
    flex: 1, background: '#f8fafc', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '48px',
  },
  card: {
    background: '#fff', borderRadius: '20px', padding: '44px',
    width: '100%', maxWidth: '440px',
    boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
  },
  cardHeader: { marginBottom: '32px' },
  cardTitle: { fontSize: '26px', fontWeight: 700, color: '#111827', margin: '0 0 6px' },
  cardSub: { fontSize: '14px', color: '#6b7280', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  input: {
    padding: '12px 16px', border: '1.5px solid #e5e7eb',
    borderRadius: '10px', fontSize: '14px', color: '#111827',
    outline: 'none', transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  btn: {
    padding: '14px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
    color: '#fff', border: 'none', borderRadius: '12px',
    fontSize: '15px', fontWeight: 600, cursor: 'pointer',
    marginTop: '4px', transition: 'opacity 0.2s',
  },
  divider: {
    textAlign: 'center', color: '#9ca3af', fontSize: '13px',
    margin: '24px 0 0', borderTop: '1px solid #f3f4f6', paddingTop: '20px',
  },
  registerLink: {
    display: 'block', textAlign: 'center', color: '#2563eb',
    fontWeight: 600, fontSize: '14px', textDecoration: 'none', marginTop: '10px',
  },
  companyLink: {
    textAlign: 'center', fontSize: '12px', color: '#9ca3af',
    marginTop: '20px',
  },
  orDivider: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '16px 0', width: '100%',
  },
  orLine: {
    flex: 1, height: '1px', backgroundColor: '#e5e7eb',
  },
  orText: {
    padding: '0 12px', fontSize: '12px', color: '#9ca3af', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  ssoBtn: {
    width: '100%', padding: '12px', backgroundColor: '#fff', border: '1.5px solid #e5e7eb',
    borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#374151',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', marginTop: '10px', transition: 'all 0.2s', fontFamily: 'inherit',
  },
};
