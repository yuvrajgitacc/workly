"use client";
import React from 'react';
import { motion } from 'framer-motion';
import './Footer.css';

const Footer = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.21, 0.45, 0.32, 0.9] }}
  };

  const linkUrls = {
    "For Enterprise": "/admin#features",
    "For Developers": "/developer",
    "Board": "/admin/dashboard",
    "Pricing": "/admin#pricing",
    "Sign In": "/admin/login",
    "Careers": "/jobs",
    "About": "/admin#product",
    "Documentation": "/developer/portal/docs",
    "API Reference": "/developer/portal/docs"
  };

  const getLinkUrl = (name) => {
    return linkUrls[name] || "/#";
  };

  return (
    <footer className="footer">
      <motion.div 
        className="footer-main"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div className="footer-brand" variants={itemVariants}>
          <div className="footer-logo-wrapper">
             <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="45" cy="45" r="35" stroke="white" strokeWidth="8"/>
                <line x1="70" y1="70" x2="90" y2="90" stroke="white" strokeWidth="12" strokeLinecap="round"/>
            </svg>
            <span className="footer-logo-text">Vishleshan</span>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', maxWidth: '240px', lineHeight: '1.6' }}>
            The next generation of AI-driven recruitment screening.
          </p>
        </motion.div>

        {[
          { title: "Product", links: ["For Enterprise", "For Developers", "Board", "Pricing", "Sign In"] },
          { title: "Company", links: ["Newsletter", "Careers", "About", "Blog"] },
          { title: "Resources", links: ["Documentation", "API Reference", "Community", "Guide"] },
          { title: "Legal", links: ["Terms of Service", "Privacy Policy", "Cookie Settings"] }
        ].map((column, i) => (
          <motion.div key={i} className="footer-column" variants={itemVariants}>
            <h4>{column.title}</h4>
            <ul className="footer-list">
              {column.links.map((link, li) => (
                <li key={li}><a href={getLinkUrl(link)}>{link}</a></li>
              ))}
            </ul>
          </motion.div>
        ))}
      </motion.div>

      <motion.div 
        className="footer-bottom"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="footer-copyright">
          © {new Date().getFullYear()} Vishleshan AI, Inc.
        </div>
        
        <div className="social-icons-footer">
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', marginRight: '8px' }}>Social</span>
            <motion.a whileHover={{ y: -2 }} target="_blank" rel="noopener noreferrer" href="https://github.com/dakshbhavsar007/Multi-Agent-Resume-Project" className="social-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            </motion.a>
            <motion.a whileHover={{ y: -2 }} target="_blank" rel="noopener noreferrer" href="https://github.com/dakshbhavsar007/Multi-Agent-Resume-Project" className="social-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </motion.a>
            <div className="status-indicator" style={{ marginLeft: '40px' }}>
                <motion.div 
                    className="status-dot"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
                <span>System Status</span>
            </div>
        </div>
      </motion.div>
    </footer>
  );
};

export default Footer;
