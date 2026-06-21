import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { CompanyLogo } from '../components/user/company-logo';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Search,
  HelpCircle,
  Settings as SettingsIcon,
  Grid3x3,
  LayoutDashboard,
  Sparkles,
  Shield,
  Layers,
  Bell,
  X,
  LogOut,
  Home
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { authAPI } from '../lib/api';
import RateLimitBanner from '../components/RateLimitBanner';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { initFromStorage, company, clearAuth } = useAuthStore();
  const [initDone, setInitDone] = useState(false);

  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    initFromStorage();
    const jwt = localStorage.getItem("vish_jwt");
    if (!jwt) {
      navigate("/admin/login");
    } else {
      setInitDone(true);
    }
  }, [initFromStorage, navigate]);

  // Default open on desktop, closed on mobile
  useEffect(() => {
    setOpen(isDesktop);
  }, [isDesktop]);

  // Close mobile drawer on route change
  useEffect(() => {
    if (!isDesktop) setOpen(false);
    setSearchOpen(false);
  }, [pathname, isDesktop]);

  if (!initDone) return null; // Wait for hydrate

  const handleLogout = () => {
    try {
      authAPI.logout();
    } catch (e) {
      clearAuth();
    }
  };

  const getTierBadgeColor = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'starter': return 'bg-blue-100 text-blue-700';
      case 'business': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const navItems = [
    { to: "/admin", label: "Home Page", icon: Home, exact: true },
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/dashboard/smart-analyzer", label: "Smart Analyzer", icon: Sparkles },
    { to: "/admin/dashboard/protection", label: "Protection", icon: Shield },
    { to: "/admin/dashboard/sessions", label: "Sessions", icon: Layers },
    { to: "/admin/dashboard/settings", label: "Settings", icon: SettingsIcon },
  ];

  // Parses usage configuration
  const parsesUsed = 247;
  const parsesTotal = 1000;
  const parsePercent = (parsesUsed / parsesTotal) * 100;

  const sideWidth = isDesktop ? (open ? 260 : 72) : 0;

  const cleanPath = pathname.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans recruiter-page">
      <RateLimitBanner />

      {/* Top App Bar — Google style */}
      <header className="fixed top-0 inset-x-0 z-40 h-16 bg-background border-b border-border flex items-center px-2 sm:px-4 gap-1 sm:gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-12 h-12 shrink-0 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>

        <Link to="/admin/dashboard" className="flex items-center gap-2 pr-1 sm:pr-3 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-display font-bold text-sm" style={{ background: "linear-gradient(135deg,#4285F4 0%,#1a73e8 100%)" }}>
            V
          </div>
          <span className="font-display text-[20px] sm:text-[22px] text-foreground tracking-tight hidden xs:inline sm:inline">
            Vishleshan
          </span>
          <span className="text-muted-foreground text-sm hidden lg:inline ml-1 font-medium">Workspace</span>
        </Link>

        {/* Search — inline on sm+, icon-only sheet on xs */}
        <div className="flex-1 max-w-2xl mx-auto px-2 hidden sm:block">
          <div className="group flex items-center h-11 md:h-12 bg-[#f1f3f4] rounded-full px-4 gap-3 focus-within:bg-card focus-within:shadow-google-1 transition">
            <Search size={20} className="text-[#5f6368] shrink-0" />
            <input
              type="text"
              placeholder="Search candidates, sessions, jobs"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#202124] placeholder:text-[#5f6368]"
            />
          </div>
        </div>
        <div className="flex-1 sm:hidden" />

        <div className="flex items-center gap-0.5 sm:gap-1 pl-1 sm:pl-2 shrink-0">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="sm:hidden w-10 h-10 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center text-[#5f6368] transition"
          >
            <Search size={20} />
          </button>
          <IconBtn label="Help" hideOn="sm"><HelpCircle size={20} /></IconBtn>
          <IconBtn label="Notifications"><Bell size={20} /></IconBtn>
          <IconBtn label="Apps" hideOn="sm"><Grid3x3 size={20} /></IconBtn>
          
          {/* User profile identifier */}
          <div className="ml-1 flex items-center gap-2">
            <div className="text-right hidden md:block">
              <div className="text-xs font-semibold text-[#202124] truncate max-w-[120px]">
                {company?.name || 'Company'}
              </div>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${getTierBadgeColor(company?.tier)}`}>
                {company?.tier || 'Free'}
              </span>
            </div>
            <Link to="/admin/dashboard/settings" className="w-9 h-9 shrink-0 rounded-full overflow-hidden hover:shadow-google-1 transition block border border-black/5">
              <CompanyLogo name={company?.name || 'Company'} logoPath={company?.logo_path} size={36} />
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-background sm:hidden">
          <div className="h-16 flex items-center px-2 gap-2 border-b border-border">
            <button
              onClick={() => setSearchOpen(false)}
              className="w-12 h-12 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center text-[#5f6368]"
              aria-label="Close search"
            >
              <X size={22} />
            </button>
            <div className="flex-1 flex items-center h-11 bg-[#f1f3f4] rounded-full px-4 gap-3">
              <Search size={20} className="text-[#5f6368] shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search"
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile drawer backdrop */}
      {!isDesktop && open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-16 z-30 bg-[#202124]/30 md:hidden"
        />
      )}

      {/* Side Nav — Material 3 drawer */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 bg-background border-r border-border md:border-transparent transition-[width,transform] duration-200 ${
          isDesktop
            ? open
              ? "w-[260px] translate-x-0"
              : "w-[72px] translate-x-0"
            : open
              ? "w-[280px] translate-x-0 shadow-google-2"
              : "w-[280px] -translate-x-full"
        }`}
      >
        <nav className="py-3 px-2 space-y-1 overflow-y-auto h-[calc(100%-140px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact 
              ? cleanPath === item.to.replace(/\/$/, "") 
              : cleanPath.startsWith(item.to);
            const showLabel = !isDesktop || open;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => { if (!isDesktop) setOpen(false); }}
                className={`flex items-center h-12 rounded-full px-3 gap-5 relative group transition-colors duration-200 ${
                  active 
                    ? "text-[#1967d2] font-semibold" 
                    : "text-[#202124] hover:bg-[#f1f3f4] font-medium"
                }`}
                title={item.label}
              >
                {active && (
                  <motion.div
                    layoutId="activeNavBackground"
                    className="absolute inset-0 bg-[#e8f0fe] rounded-full border border-[#1a73e8]/10"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <span className={`w-6 flex items-center justify-center shrink-0 transition-colors duration-200 relative z-10 ${
                  active ? "text-[#1967d2]" : "text-[#5f6368] group-hover:text-[#202124]"
                }`}>
                  <Icon size={20} />
                </span>
                {showLabel && (
                  <span className="text-sm truncate relative z-10">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Details Panel with Logout & Usage limits */}
        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-border bg-background">
          {(!isDesktop || open) ? (
            <div className="space-y-3">
              <div className="text-xs text-[#5f6368] px-2">
                <div className="flex justify-between items-center mb-1">
                  <span>Usage: {parsesUsed}/{parsesTotal} parses</span>
                </div>
                <div className="w-full bg-[#f1f3f4] h-1 rounded-full overflow-hidden">
                  <div className="bg-[#1a73e8] h-full rounded-full animate-pulse" style={{ width: `${parsePercent}%`, animationDuration: '3s' }}></div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center h-10 rounded-full px-3 gap-5 text-[#5f6368] hover:text-[#d93025] hover:bg-[#fce8e6] transition"
              >
                <span className="w-6 flex items-center justify-center shrink-0">
                  <LogOut size={18} />
                </span>
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-10 h-10 mx-auto rounded-full hover:bg-[#fce8e6] text-[#5f6368] hover:text-[#d93025] flex items-center justify-center transition"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Page Content */}
      <main
        className="pt-16 transition-[padding] duration-200 min-h-screen"
        style={{ paddingLeft: isDesktop ? sideWidth : 0 }}
      >
        <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function IconBtn({ children, label, hideOn }) {
  const hideCls = hideOn === "sm" ? "hidden sm:flex" : hideOn === "md" ? "hidden md:flex" : "flex";
  return (
    <button
      aria-label={label}
      className={`${hideCls} w-10 h-10 rounded-full hover:bg-[#f1f3f4] items-center justify-center text-[#5f6368] transition shrink-0`}
    >
      {children}
    </button>
  );
}
