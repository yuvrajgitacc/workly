import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Upload, Briefcase, TrendingUp, FolderGit, Home, Shield, Bell, Sparkles, LayoutDashboard } from 'lucide-react';

const googleColors = [
  '#1a73e8', // Google Blue
  '#ea4335', // Google Red
  '#f9ab00', // Google Yellow
  '#34a853', // Google Green
  '#673ab7', // Google Purple
  '#00acc1', // Google Cyan
  '#f4511e', // Google Orange
];

const getGoogleColor = (str) => {
  if (!str) return '#1a73e8';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % googleColors.length;
  return googleColors[idx];
};

export default function JobsNavbar({ onUploadClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => {
    const seekerData = localStorage.getItem('vish_seeker_data');
    if (seekerData) {
      try {
        const parsed = JSON.parse(seekerData);
        return {
          name: parsed.full_name,
          email: parsed.email,
          skills: parsed.skills || []
        };
      } catch (e) {}
    }
    const saved = localStorage.getItem('vish_seeker_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isSeekerLoggedIn = !!localStorage.getItem('vish_seeker_token');

  // Sync profile from local storage
  const syncProfile = () => {
    const seekerData = localStorage.getItem('vish_seeker_data');
    if (seekerData) {
      try {
        const parsed = JSON.parse(seekerData);
        setProfile({
          name: parsed.full_name,
          email: parsed.email,
          skills: parsed.skills || []
        });
        return;
      } catch (e) {}
    }

    const saved = localStorage.getItem('vish_seeker_profile');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    syncProfile();
    // Listen for custom event triggered when profile is uploaded
    window.addEventListener('seeker_profile_updated', syncProfile);
    return () => window.removeEventListener('seeker_profile_updated', syncProfile);
  }, []);

  const handleClearProfile = () => {
    localStorage.removeItem('vish_seeker_profile');
    localStorage.removeItem('vish_applied_jobs');
    localStorage.removeItem('vish_seeker_token');
    localStorage.removeItem('vish_seeker_data');
    setProfile(null);
    setDropdownOpen(false);
    window.dispatchEvent(new Event('seeker_profile_updated'));
    navigate('/jobs');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="w-full bg-[#FFFFFF] border-b border-[#e6dfcd] sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Brand logo */}
      <div className="flex items-center space-x-8">
        <Link to="/jobs" className="flex items-center space-x-2">
          <span className="text-xl font-extrabold text-[#2563EB] font-sans tracking-tight">CareerEngine</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center space-x-2 xl:space-x-4 lg:space-x-3">
          <Link
            to="/"
            className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive('/')
                ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
            }`}
          >
            <Home size={16} />
            <span>Home</span>
          </Link>

          {isSeekerLoggedIn && (
            <Link
              to="/jobs"
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                isActive('/jobs')
                  ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                  : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
              }`}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </Link>
          )}
          
          <Link
            to="/jobs/search"
            className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive('/jobs/search')
                ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
            }`}
          >
            <Briefcase size={16} />
            <span>Find Jobs</span>
          </Link>

          {isSeekerLoggedIn && (
            <Link
              to="/jobs/resume"
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                isActive('/jobs/resume')
                  ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                  : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
              }`}
            >
              <Sparkles size={16} />
              <span>AI Resume Enhancer</span>
            </Link>
          )}
          
          {isSeekerLoggedIn && (
            <Link
              to="/jobs/applications"
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                isActive('/jobs/applications')
                  ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                  : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
              }`}
            >
              <FolderGit size={16} />
              <span>My Applications</span>
            </Link>
          )}

          {isSeekerLoggedIn && (
            <Link
              to="/jobs/notifications"
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                isActive('/jobs/notifications')
                  ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                  : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
              }`}
            >
              <Bell size={16} />
              <span>Notifications</span>
            </Link>
          )}

          <Link
            to="/jobs/trends"
            className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive('/jobs/trends')
                ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
            }`}
          >
            <TrendingUp size={16} />
            <span>Market Trends</span>
          </Link>

          <Link
            to="/jobs/safety-checker"
            className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive('/jobs/safety-checker')
                ? 'text-[#2563EB] bg-[#EFF6FF]/50 font-semibold'
                : 'text-[#5c5c5c] hover:text-[#2A2A2A]'
            }`}
          >
            <Shield size={16} />
            <span>Hiring Safety</span>
          </Link>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-4">
        {profile ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 border border-[#e6dfcd] hover:border-[#2563EB] rounded-full px-4 py-2 text-sm font-medium text-[#2A2A2A] transition-colors"
            >
              <div 
                className="w-6 h-6 text-white rounded-full flex items-center justify-center text-xs font-bold capitalize"
                style={{ backgroundColor: getGoogleColor(profile.name) }}
              >
                {profile.name ? profile.name[0] : 'U'}
              </div>
              <span className="max-w-[120px] truncate">
                {profile.name ? profile.name.split(' ')[0] : 'User'}
              </span>
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-[#e6dfcd] rounded-xl shadow-lg z-20 overflow-hidden"
                  >
                    <div className="p-3 border-b border-[#e6dfcd] bg-[#f5f4ef]/50">
                      <div className="text-sm font-bold text-[#2A2A2A] truncate">{profile.name}</div>
                      <div className="text-xs text-[#5c5c5c] truncate">{profile.email || 'No email associated'}</div>
                      <div className="mt-1 text-[10px] bg-[#2563EB]/10 text-[#2563EB] px-1.5 py-0.5 rounded inline-block font-semibold">
                        {profile.skills?.length || 0} Skills Extracted
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onUploadClick();
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-[#2A2A2A] hover:bg-[#f5f4ef] rounded-lg text-left transition-colors"
                      >
                        <Upload size={14} />
                        <span>Update Resume</span>
                      </button>
                      <button
                        onClick={handleClearProfile}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-red-50 rounded-lg text-left transition-colors"
                      >
                        <LogOut size={14} />
                        <span>{isSeekerLoggedIn ? 'Log Out' : 'Clear AI Profile'}</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <button
            onClick={onUploadClick}
            className="flex items-center space-x-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium rounded-full px-5 py-2.5 text-sm transition-all shadow-sm active:scale-95"
          >
            <Upload size={14} />
            <span>Upload Resume</span>
          </button>
        )}

        {!isSeekerLoggedIn && (
          <button 
            onClick={() => navigate('/jobs/login')} 
            className="text-sm font-bold text-gray-800 border border-gray-300 hover:border-gray-400 rounded-full px-4.5 py-2 transition-all bg-white shadow-sm"
          >
            Sign In
          </button>
        )}



      </div>
    </nav>
  );
}
