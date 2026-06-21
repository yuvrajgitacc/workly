"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import './AuthPage.css';

const AntigravityGrid = () => {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const particles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles.current = Array.from({ length: 150 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.5,
        speedX: Math.random() * 0.4 - 0.2,
        speedY: Math.random() * 0.4 - 0.2,
        life: Math.random()
      }));
    };

    const handleMouseMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    handleResize();

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gridSize = 40;
      const columns = Math.ceil(canvas.width / gridSize);
      const rows = Math.ceil(canvas.height / gridSize);
      const offX = (mouse.current.x - canvas.width/2) * 0.03;
      const offY = (mouse.current.y - canvas.height/2) * 0.03;

      for (let i = -1; i <= columns + 1; i++) {
        for (let j = -1; j <= rows + 1; j++) {
          const x = i * gridSize + offX;
          const y = j * gridSize + offY;
          const dx = mouse.current.x - x;
          const dy = mouse.current.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const rawOpacity = Math.max(0, 1 - dist / 400);
          const contrastOpacity = Math.pow(rawOpacity, 3);
          
          if (contrastOpacity > 0.001) {
            ctx.fillStyle = `rgba(59, 130, 246, ${contrastOpacity * 0.9})`;
            ctx.beginPath();
            ctx.arc(x, y, 2.5 * contrastOpacity + 0.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
             ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
             ctx.beginPath();
             ctx.arc(x, y, 0.5, 0, Math.PI * 2);
             ctx.fill();
          }
        }
      }

      particles.current.forEach(p => {
        p.x += p.speedX; p.y += p.speedY; p.life += 0.003;
        if (p.life > 1) p.life = 0;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        const dist = Math.sqrt(Math.pow(mouse.current.x - p.x, 2) + Math.pow(mouse.current.y - p.y, 2));
        const pInfluence = Math.max(0, 1 - dist / 300);
        const pOpacity = (Math.sin(p.life * Math.PI) * 0.2) + (pInfluence * 0.6);
        ctx.fillStyle = `rgba(59, 130, 246, ${pOpacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (pInfluence * 2), 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(drawGrid);
    };
    drawGrid();
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />;
};

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const googleClientRef = useRef(null);

  useEffect(() => {
    // Dynamic script loading for Google GIS client
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
                const data = await authAPI.googleLogin(tokenResponse.access_token);
                setAuth(data);
                toast.success("Signed in successfully with Google!");
                navigate('/admin/dashboard');
              } catch (err) {
                toast.error(err.message || "Google Authentication failed");
              } finally {
                setLoading(false);
              }
            }
          }
        });
      }
    };
    document.body.appendChild(script);

    const jwt = localStorage.getItem("vish_jwt");
    if (jwt) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate, setAuth]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ clientX, clientY }) {
    const x = (clientX / window.innerWidth) - 0.5;
    const y = (clientY / window.innerHeight) - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const data = await authAPI.login(email, password);
        setAuth(data);
        toast.success("Welcome back!");
        navigate('/admin/dashboard');
      } else {
        await authAPI.register({ email, password, name: fullName });
        toast.success("Account created! Please sign in.");
        setIsLogin(true);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), { stiffness: 100, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), { stiffness: 100, damping: 30 });

  return (
    <div className="auth-page" onMouseMove={handleMouseMove}>
      <AntigravityGrid />
      
      <motion.div 
        className="auth-container"
        style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 1000 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.21, 0.45, 0.32, 0.9] }}
      >
        <div className="auth-header" style={{ transform: "translateZ(50px)" }}>
          <span className="auth-logo">Vishleshan</span>
          <AnimatePresence mode="wait">
            <motion.h2 key={isLogin ? 'login' : 'signup'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="auth-title">
              {isLogin ? 'Sign In' : 'Create Account'}
            </motion.h2>
          </AnimatePresence>
          <p className="auth-subtitle">
            {isLogin ? 'Sign in to access your dashboard.' : 'Start your 14-day free trial today.'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleAuth} style={{ transform: "translateZ(30px)" }}>
          {!isLogin && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="input-group">
              <label>Full Name</label>
              <input type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} required={!isLogin} />
            </motion.div>
          )}
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>Password</label>
              {isLogin && <button type="button" style={{ background: 'none', border: 'none', fontSize: '11px', color: '#6b6375', cursor: 'pointer' }}>Forgot?</button>}
            </div>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <motion.button 
            type="submit" 
            disabled={loading}
            className="auth-submit-btn" 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Processing...' : (isLogin ? 'Continue' : 'Create Account')}
            {!loading && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
          </motion.button>
        </form>

        <div className="sso-divider" style={{ transform: "translateZ(20px)" }}>
          <div className="sso-line" /><span>or</span><div className="sso-line" />
        </div>

        <div className="sso-buttons" style={{ transform: "translateZ(20px)" }}>
          <motion.button 
            type="button" 
            whileHover={{ y: -2 }} 
            className="sso-btn"
            onClick={() => {
              if (googleClientRef.current) {
                googleClientRef.current.requestAccessToken();
              } else {
                toast.error("Google Auth is loading. Please try again in a moment.");
              }
            }}
          >
            Google
          </motion.button>
          <motion.button 
            type="button" 
            whileHover={{ y: -2 }} 
            className="sso-btn"
            onClick={() => {
              const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
              const redirectUri = encodeURIComponent(import.meta.env.VITE_GITHUB_REDIRECT_URI);
              window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user,user:email&state=recruiter`;
            }}
          >
            GitHub
          </motion.button>
        </div>

        <div className="auth-footer" style={{ transform: "translateZ(10px)" }}>
          {isLogin ? "New to Vishleshan?" : "Have an account?"}
          <button 
            type="button"
            className="auth-toggle-link" 
            onClick={() => {
              if (isLogin) {
                navigate('/admin/register');
              } else {
                setIsLogin(true);
              }
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        <button onClick={() => navigate('/admin')} className="back-btn" style={{ background: 'none', border: 'none', width: '100%', marginTop: '10px', color: '#a1a1a1', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Return to Recruiter Home
        </button>
      </motion.div>
    </div>
  );
};

export default AuthPage;
