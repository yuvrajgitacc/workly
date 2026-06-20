import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import './Navbar.css';

const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="45" cy="45" r="35" stroke="currentColor" strokeWidth="8"/>
    <line x1="70" y1="70" x2="90" y2="90" stroke="currentColor" strokeWidth="12" strokeLinecap="round"/>
    <rect x="30" y="45" width="8" height="20" fill="currentColor" />
    <rect x="42" y="35" width="8" height="30" fill="currentColor" />
    <rect x="54" y="25" width="10" height="40" fill="currentColor" clipPath="inset(0 0 0 0 round 0 0 8 0)"/>
  </svg>
);

const Navbar = ({ onSignIn, isLoggedIn }) => {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    return scrollY.onChange((latest) => {
      setScrolled(latest > 50);
    });
  }, [scrollY]);

  return (
    <motion.nav 
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.21, 0.45, 0.32, 0.9] }}
    >
      <Link to="/admin" className="nav-left flex items-center cursor-pointer no-underline text-inherit">
        <Logo />
        <span className="logo-text ml-2">Vishleshan</span>
      </Link>

      <div className="nav-center">
        {['Product', 'Features', 'Pricing', 'Jobs', 'Sessions', 'Developers'].map((item) => {
          if (item === 'Sessions') {
            return (
              <Link 
                key={item}
                to="/admin/dashboard/sessions" 
                className="nav-link font-semibold transition-all hover:translate-y-[-2px]"
              >
                Sessions
              </Link>
            );
          }
          if (item === 'Jobs') {
            return (
              <Link 
                key={item}
                to="/admin/jobs/post" 
                className="nav-link font-semibold transition-all hover:translate-y-[-2px]"
              >
                Jobs
              </Link>
            );
          }
          if (item === 'Developers') {
            return (
              <Link 
                key={item}
                to="/developer" 
                className="nav-link font-semibold transition-all hover:translate-y-[-2px]"
              >
                Developers
              </Link>
            );
          }
          return (
            <motion.a 
              key={item}
              href={`/admin#${item.toLowerCase()}`} 
              className="nav-link"
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {item}
              {item === 'Product' && (
                <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              )}
            </motion.a>
          );
        })}
      </div>

      <div className="nav-right">
        <motion.button 
          className="sign-in-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSignIn}
        >
          {isLoggedIn ? 'Dashboard' : 'Sign In'}
          <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </motion.button>
      </div>
    </motion.nav>
  );
};

export default Navbar;
