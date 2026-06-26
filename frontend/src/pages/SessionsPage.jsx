import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Building2, Search, Plus, MoreVertical, Archive, Trash2, FolderOpen, Filter } from 'lucide-react';
import { sessionsAPI } from '../lib/api';

export default function SessionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const POPULAR_ROLES = ["React Developers", "Backend Python Engineer", "Product Design Lead", "Data Analyst", "Sales Representative", "DevOps Engineer"];
  const menuRef = useRef(null);

  // Click outside to close dropdown menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsAPI.list()
  });

  const getFilteredSessions = () => {
    if (!sessions) return [];
    let result = [...sessions];

    if (searchTerm) {
      result = result.filter(s => 
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.job_title || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== "All") {
      result = result.filter(s => (s.status || "Active").toLowerCase() === statusFilter.toLowerCase());
    }

    // Sort order
    if (sortOrder === "newest") {
      result.sort((a, b) => new Date(b.created_at || new Date()) - new Date(a.created_at || new Date()));
    } else {
      result.sort((a, b) => new Date(a.created_at || new Date()) - new Date(b.created_at || new Date()));
    }

    return result;
  };

  const filteredSessions = getFilteredSessions();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] sm:text-[28px] text-foreground">Recruitment sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all your hiring rounds in one place.</p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <div className="flex items-center h-11 bg-muted rounded-full px-4 gap-2 w-full focus-within:bg-card focus-within:shadow-google-1 transition">
            <Search size={18} className="text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search sessions"
              className="bg-transparent outline-none flex-1 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {showSuggestions && (
            <div className="absolute top-[105%] left-0 right-0 bg-white border border-border rounded-2xl shadow-lg z-50 py-1.5 max-h-48 overflow-y-auto">
              {POPULAR_ROLES.map((s, i) => (
                <div 
                  key={i} 
                  onMouseDown={() => setSearchTerm(s)}
                  className="px-4 py-2 hover:bg-gray-50 text-xs text-foreground cursor-pointer font-medium text-left"
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-full p-1 relative z-0">
          {["All", "Active", "Completed", "Draft"].map((f) => {
            const active = statusFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className="h-9 px-4 rounded-full text-sm font-medium relative transition-colors duration-200"
              >
                {active && (
                  <motion.div
                    layoutId="activeSessionsFilterIndicator"
                    className="absolute inset-0 bg-card rounded-full -z-10 shadow-google-1 border border-border/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}>
                  {f}
                </span>
              </button>
            );
          })}
        </div>
        <button 
          onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-border text-sm font-medium text-foreground hover:bg-muted transition"
        >
          <Filter size={16} /> Sort {sortOrder === 'newest' ? '↓' : '↑'}
        </button>
      </div>

      {/* Grid view */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl border border-border"></div>
          ))}
        </div>
      ) : filteredSessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSessions.map((s) => (
            <article
              key={s.id}
              onClick={() => navigate(`/admin/dashboard/sessions/${s.id}`)}
              className="bg-card border border-border rounded-2xl p-5 hover:shadow-google-1 hover:border-primary/30 transition cursor-pointer relative group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#e8f0fe] text-[#1967d2] flex items-center justify-center shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base text-foreground truncate group-hover:text-primary transition-colors">{s.job_title || 'Untitled Role'}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.name || 'Hiring session'} · {s.rounds?.length || 3} rounds</p>
                  </div>
                </div>
                
                {/* Actions Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setActiveMenuId(activeMenuId === s.id ? null : s.id)}
                    className="w-9 h-9 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center transition"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {activeMenuId === s.id && (
                    <div 
                      ref={menuRef}
                      className="absolute right-0 mt-1.5 w-40 bg-card border border-border rounded-xl shadow-google-2 z-50 overflow-hidden py-1"
                    >
                      <button 
                        onClick={() => {
                          setActiveMenuId(null);
                          navigate(`/admin/dashboard/sessions/${s.id}`);
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2"
                      >
                        <FolderOpen size={13} className="text-muted-foreground" />
                        Open Session
                      </button>
                      <button 
                        onClick={async () => {
                          setActiveMenuId(null);
                          if (window.confirm(`Archive session "${s.job_title || s.name}"?`)) {
                            try {
                              await sessionsAPI.delete(s.id, { delete_candidates: false });
                              queryClient.invalidateQueries({ queryKey: ['sessions'] });
                              toast.success('Session archived');
                            } catch(e) { toast.error(e.message); }
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2"
                      >
                        <Archive size={13} className="text-muted-foreground" />
                        Archive
                      </button>
                      <button 
                        onClick={async () => {
                          setActiveMenuId(null);
                          if (window.confirm(`Permanently delete session "${s.job_title || s.name}"? This will delete all candidates.`)) {
                            try {
                              await sessionsAPI.delete(s.id, { delete_candidates: true, hard_delete: true });
                              queryClient.invalidateQueries({ queryKey: ['sessions'] });
                              toast.success('Session deleted');
                            } catch(e) { toast.error(e.message); }
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-destructive hover:bg-destructive/10 flex items-center gap-2"
                      >
                        <Trash2 size={13} className="text-destructive" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 mt-4 px-3 h-7 rounded-full text-xs font-medium ${
                  (s.status || "active").toLowerCase() === "completed"
                    ? "bg-[#e8f0fe] text-[#1967d2]"
                    : (s.status || "active").toLowerCase() === "draft"
                      ? "bg-[#f1f3f4] text-[#5f6368]"
                      : "bg-[#1e8e3e]/15 text-[#1e8e3e]"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> {((s.status || "Active").charAt(0).toUpperCase() + (s.status || "Active").slice(1).toLowerCase())}
              </span>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <Stat label="Total" value={s.total_candidates || 0} />
                <Stat label="Hired" value={s.hired || 0} accent="success" />
                <Stat label="Rejected" value={s.rejected || 0} accent="destructive" />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-16 bg-card rounded-2xl border border-border min-h-[350px]">
          <Building2 size={48} className="text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-lg font-display text-foreground mb-1">No sessions yet</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
            Create your first recruitment drive to start parsing resumes intelligently.
          </p>
          <button 
            onClick={() => navigate('/admin/dashboard/sessions/new')}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground font-display font-medium text-sm shadow-google-1 hover:shadow-google-2 transition"
          >
            Create Session
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/admin/dashboard/sessions/new')}
        aria-label="New session"
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 h-14 pl-5 pr-6 rounded-2xl bg-primary text-primary-foreground font-display font-medium inline-flex items-center gap-2 shadow-google-fab hover:shadow-google-2 transition z-30 active:scale-95"
      >
        <Plus size={20} /> Create
      </button>
    </div>
  );
}

function Stat({ label, value, accent }) {
  const color =
    accent === "success"
      ? "text-[#1e8e3e]"
      : accent === "destructive"
        ? "text-[#d93025]"
        : "text-[#202124]";
  return (
    <div className="rounded-xl bg-[#f1f3f4] p-3 text-center">
      <div className={`font-display text-xl leading-none font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] font-medium text-[#5f6368] uppercase tracking-wider mt-1.5">{label}</div>
    </div>
  );
}
