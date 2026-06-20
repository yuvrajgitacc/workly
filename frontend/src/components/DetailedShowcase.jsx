"use client";
import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, PlayCircle, Code, Users, Search, Target } from 'lucide-react';
import './DetailedShowcase.css';

const apiImg = '/assets/developer-api.png';

const SimulatedDashboard = () => {
  const candidates = [
    { 
      name: "Marcus Aurelius", 
      role: "Lead Fullstack Developer", 
      score: "98", 
      color: "#059669", 
      skills: ["React", "Go", "AWS", "NLP"],
      initials: "MA"
    },
    { 
      name: "Sophia Chen", 
      role: "Senior AI Engineer", 
      score: "95", 
      color: "#3b82f6", 
      skills: ["Python", "PyTorch", "Rust"],
      initials: "SC"
    },
    { 
      name: "David Kim", 
      role: "Backend Architect", 
      score: "92", 
      color: "#8b5cf6", 
      skills: ["Java", "Kubernetes", "Redis"],
      initials: "DK"
    },
    { 
      name: "Elena Rodriguez", 
      role: "Data Scientist", 
      score: "89", 
      color: "#059669", 
      skills: ["R", "Tableau", "SQL"],
      initials: "ER"
    },
  ];

  return (
    <div className="simulated-dashboard">
      <div className="dash-top-nav">
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        <div className="dash-search" />
      </div>
      <div className="candidate-list">
        {candidates.map((c, j) => (
          <motion.div 
            key={j} 
            className="candidate-item"
            animate={{ 
              y: [0, -80],
              opacity: [1, 1, 1, 0]
            }}
            transition={{ 
              duration: 5, 
              repeat: Infinity, 
              delay: j * 1,
              ease: "linear"
            }}
            whileHover={{ 
              scale: 1.02, 
              borderColor: c.color,
              boxShadow: `0 8px 24px ${c.color}15`,
              transition: { duration: 0.2 }
            }}
          >
            <div className="avatar-circle" style={{ border: `2px solid ${c.color}30` }}>
              {c.initials}
            </div>
            <div className="candidate-info">
              <h4>{c.name}</h4>
              <p>{c.role}</p>
              <div className="skill-tags">
                {c.skills.map((s, si) => (
                  <span key={si} className="skill">{s}</span>
                ))}
              </div>
            </div>
            <div className="score-cell">
              <div className="score-val" style={{ color: c.color }}>{c.score}%</div>
              <div className="score-label">Match</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DetailedShowcase = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const x = useTransform(scrollYProgress, [0, 0.45, 0.55, 1], ["0vw", "0vw", "-100vw", "-100vw"]);
  const opacity1 = useTransform(scrollYProgress, [0, 0.4, 0.5], [1, 1, 0]);
  const opacity2 = useTransform(scrollYProgress, [0.5, 0.6, 1], [0, 1, 1]);

  return (
    <div className="showcase-horizontal-wrapper" ref={containerRef}>
      <div className="sticky-container">
        <motion.div className="horizontal-track" style={{ x }}>
          <div className="showcase-slide">
            <motion.div className="showcase-section-inner" style={{ opacity: opacity1 }}>
              <div className="showcase-content">
                <span className="showcase-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code size={14} /> Developers
                </span>
                <h2 className="showcase-title">Connect screening to your systems.</h2>
                <p className="showcase-desc">
                  Our API handles resume analysis and candidate ranking. Build recruitment workflows that fit your stack without the overhead.
                </p>
                <div className="showcase-actions">
                  <button className="btn btn-secondary" onClick={() => navigate('/developer')}>Explore API Docs</button>
                  <button className="nav-link" style={{ fontSize: '15px' }} onClick={() => navigate('/developer/portal/docs')}>
                    View Endpoints <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="showcase-visual">
                <div className="dotted-grid" />
                <motion.div 
                  className="visual-card"
                  whileHover={{ scale: 1.02, rotate: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <img src={apiImg} alt="API Documentation" className="api-frame" />
                </motion.div>
              </div>
            </motion.div>
          </div>

          <div className="showcase-slide">
            <motion.div className="showcase-section-inner reverse" style={{ opacity: opacity2 }}>
              <div className="showcase-content">
                <span className="showcase-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={14} /> Dashboard
                </span>
                <h2 className="showcase-title">See your candidates at a glance.</h2>
                <p className="showcase-desc">
                  Upload resumes, watch the AI rank them, then manage your best matches. Full transparency for your hiring pipeline.
                </p>
                <div className="showcase-actions">
                  <button className="btn btn-primary" style={{ gap: '10px' }}>
                    <PlayCircle size={18} /> Watch Demo
                  </button>
                  <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>Try Dashboard</button>
                </div>
              </div>

              <div className="showcase-visual">
                <div className="dotted-grid" />
                <motion.div 
                  className="visual-card"
                  whileHover={{ scale: 1.02, rotate: -1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <SimulatedDashboard />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DetailedShowcase;
