import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Briefcase, Search, Building2, User, LayoutDashboard, LogOut, Shield, TrendingUp, FileText } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

const links = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Search },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/resume-builder", label: "Resume Builder", icon: FileText },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/hiring-safety", label: "Hiring Safety", icon: Shield },
  { to: "/market-trends", label: "Market Trends", icon: TrendingUp },
];

export function Header() {
  const { pathname } = useLocation();
  const [seekerData, setSeekerData] = useState(() => {
    const token = localStorage.getItem('vish_seeker_token');
    const data = localStorage.getItem('vish_seeker_data');
    if (token && data) {
      try { return JSON.parse(data); } catch {}
    }
    return null;
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      const data = localStorage.getItem('vish_seeker_data');
      if (data) {
        try { setSeekerData(JSON.parse(data)); } catch {}
      } else {
        setSeekerData(null);
      }
    };
    window.addEventListener('seeker_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('seeker_profile_updated', handleProfileUpdate);
  }, []);

  const isLoggedIn = !!seekerData;

  const handleLogout = () => {
    localStorage.removeItem('vish_seeker_token');
    localStorage.removeItem('vish_seeker_data');
    window.location.href = '/';
  };

  const filteredLinks = links.filter((l) => {
    if (l.to === "/applications" || l.to === "/profile") {
      return isLoggedIn;
    }
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">workly</span>
        </Link>

        <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
          {filteredLinks.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`pill px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? "bg-muted text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Link
                to="/dashboard"
                className="pill hidden border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted sm:inline-flex"
              >
                Dashboard
              </Link>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <Link
                  to="/profile"
                  className="flex items-center gap-2 pill bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                >
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {seekerData?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:inline">{seekerData?.full_name?.split(' ')[0] || 'Profile'}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="pill p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/jobs/login"
                className="pill hidden border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/jobs/register"
                className="pill bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 md:hidden">
        {filteredLinks.map((l) => {
          const active = pathname === l.to;
          const Icon = l.icon;
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`pill flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                active 
                  ? "bg-muted text-foreground font-medium shadow-sm" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

const Linkedin = ({ className }) => (
  <svg fill="currentColor" viewBox="0 0 24 24" className={className}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

const Twitter = ({ className }) => (
  <svg fill="currentColor" viewBox="0 0 24 24" className={className}>
    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
  </svg>
);

const Instagram = ({ className }) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-white relative overflow-hidden">
      <div className="mx-auto flex flex-col md:flex-row justify-between items-start max-w-7xl w-full px-6 py-12 gap-10 relative z-10">
        <div className="max-w-xs w-full space-y-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Briefcase className="h-3.5 w-3.5" />
            </div>
            <span className="font-display text-base font-semibold">workly</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A calmer job search. Built for humans, not algorithms.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <a href="#" className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="#" className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="#" className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition">
              <Instagram className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap gap-x-12 gap-y-8 justify-between md:justify-end md:gap-x-16 md:mr-[300px] lg:mr-[360px] xl:mr-[400px]">
          {[
            { t: "Product", i: ["Browse jobs", "Companies", "Resume", "Salary guide"] },
            { t: "Company", i: ["About", "Careers", "Press", "Contact"] },
            { t: "Resources", i: ["Help center", "Privacy", "Terms", "Cookies"] },
          ].map((c) => (
            <div key={c.t} className="min-w-[100px]">
              <div className="text-sm font-semibold text-foreground">{c.t}</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {c.i.map((x) => (
                  <li key={x} className="hover:text-foreground cursor-pointer transition-colors">{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground relative z-10 bg-white/80 backdrop-blur-sm">
        © 2026 Workly · Designed with care
      </div>
    </footer>
  );
}
