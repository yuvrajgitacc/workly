import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seekerAPI } from '../../lib/api';
import { useSeekerAuthStore } from '../../stores/seekerAuthStore';
import toast from 'react-hot-toast';

export default function JobSeekerLoginPage() {
  const navigate = useNavigate();
  const setAuth = useSeekerAuthStore(s => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

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
};
