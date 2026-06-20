import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Upload, 
  Archive, 
  Mail, 
  Link as LinkIcon, 
  Download, 
  Zap, 
  Settings, 
  RefreshCw, 
  X, 
  ChevronDown, 
  Check, 
  Trash2, 
  Building2, 
  Users, 
  BarChart3, 
  Search,
  Filter,
  Sparkles
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

import { sessionsAPI, ingestAPI, candidatesAPI, exportAPI } from '../lib/api';
import { useIngestStore } from '../stores/ingestStore';
import { useCandidateStore } from '../stores/candidateStore';
import ChatPanel from '../components/ChatPanel';
import CandidateCard from '../components/CandidateCard';
import PremiumBadge from '../components/PremiumBadge';
import PageTransition from '../components/PageTransition';

export default function SessionWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { jobs, addJob, updateJob, removeJob } = useIngestStore();
  const { highlightedIds } = useCandidateStore();

  const [activeTab, setActiveTab] = useState("upload");
  const [activeRound, setActiveRound] = useState(null);
  const [filters, setFilters] = useState({ search: "", location: "", min_score: 0, skill: "", sort: "Match Score ↓" });
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [driveUrl, setDriveUrl] = useState("");
  const [atsFile, setAtsFile] = useState(null);

  // Recruiter analytics & seeker applicant table states
  const [analyticsData, setAnalyticsData] = useState(null);
  const [applicantsTable, setApplicantsTable] = useState([]);
  const [tableSearch, setTableSearch] = useState("");
  const [tableSource, setTableSource] = useState("");
  const [tableStatus, setTableStatus] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch Session Analytics
  useEffect(() => {
    if (activeTab === "analytics") {
      fetch(`http://127.0.0.1:8000/api/v1/sessions/${id}/analytics`, {
        headers: {
          "X-API-Key": localStorage.getItem("vish_api_key") || "",
          "Authorization": `Bearer ${localStorage.getItem("vish_jwt") || ""}`
        }
      })
      .then(res => res.json())
      .then(resData => {
        if (resData.success) {
          setAnalyticsData(resData.data);
        }
      })
      .catch(err => console.error("Failed to fetch session analytics:", err));
    }
  }, [activeTab, id]);

  // Fetch Session Applicants list
  useEffect(() => {
    if (activeTab === "analytics") {
      const query = new URLSearchParams({
        search: tableSearch,
        source: tableSource,
        status: tableStatus,
        page: tablePage.toString(),
        per_page: "10"
      }).toString();
      
      fetch(`http://127.0.0.1:8000/api/v1/sessions/${id}/applicants?${query}`, {
        headers: {
          "X-API-Key": localStorage.getItem("vish_api_key") || "",
          "Authorization": `Bearer ${localStorage.getItem("vish_jwt") || ""}`
        }
      })
      .then(res => res.json())
      .then(resData => {
        if (resData.success) {
          setApplicantsTable(resData.data.applicants || []);
          setTotalPages(resData.data.pages || 1);
        }
      })
      .catch(err => console.error("Failed to fetch applicants list:", err));
    }
  }, [activeTab, id, tableSearch, tableSource, tableStatus, tablePage]);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionsAPI.get(id)
  });

  // Sync activeRound with session data once loaded
  useEffect(() => {
    if (session && session.rounds?.length > 0 && activeRound === null) {
      setActiveRound(session.rounds[0].order);
    }
  }, [session, activeRound]);

  const buildQS = () => {
    const params = new URLSearchParams();
    if (activeRound === "hired") {
      params.set("status", "hired");
    } else if (activeRound === "rejected") {
      params.set("status", "rejected");
    } else {
      if (activeRound !== null) {
        params.set("round_index", activeRound.toString());
      }
      params.set("status", "new,active,forwarded");
    }
    if (filters.search) params.set("search", filters.search);
    if (filters.min_score) params.set("min_score", filters.min_score.toString());
    if (filters.location) params.set("location", filters.location);
    if (filters.sort) params.set("sort", filters.sort);
    return "?" + params.toString();
  };

  const { data: candidatesData } = useQuery({
    key: ["candidates", id, activeRound, filters],
    queryKey: ["candidates", id, activeRound, filters],
    queryFn: () => candidatesAPI.list(id, buildQS()),
    refetchInterval: 15000,
    enabled: activeTab === "candidates" || activeTab === "analytics"
  });

  const { data: allCandidatesData } = useQuery({
    queryKey: ["all_candidates", id],
    queryFn: () => candidatesAPI.list(id, "?per_page=1000"),
    enabled: !!id
  });

  useEffect(() => {
    const activeJobs = Object.values(jobs);
    if (activeJobs.length === 0) return;

    const interval = setInterval(() => {
      activeJobs.forEach(job => {
        if (job.status !== "done" && job.status !== "failed") {
          ingestAPI.getStatus(job.id).then(data => {
            updateJob(job.id, data);
            if (data.status === "done" || data.status === "failed") {
              if (data.status === "done") {
                if (data.job_type === "match_all") {
                  toast.success(`Matched ${data.processed_files || 0} candidates successfully!`);
                } else {
                  toast.success(`${data.processed_files || 0} resumes processed!`);
                }
                queryClient.invalidateQueries({ queryKey: ["candidates", id] });
                queryClient.invalidateQueries({ queryKey: ["all_candidates", id] });
                queryClient.invalidateQueries({ queryKey: ["session", id] });
              }
              setTimeout(() => removeJob(job.id), 5000);
            }
          }).catch(err => console.error("Poll error:", err));
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, updateJob, removeJob, queryClient, id]);

  const onDropDirect = (acceptedFiles) => {
    const cleanFiles = acceptedFiles.map(f => new File([f], f.name, { type: f.type }));
    setSelectedFiles(prev => [...prev, ...cleanFiles]);
  };
  const { getRootProps: getDirectProps, getInputProps: getDirectInput } = useDropzone({
    onDrop: onDropDirect,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
  });

  const onDropZip = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    try {
      const { job_id } = await ingestAPI.uploadZip(id, acceptedFiles[0]);
      addJob(job_id, "zip");
      toast.success("ZIP upload started!");
    } catch(e) {
      toast.error(e.message);
    }
  };

  const { getRootProps: getAtsProps, getInputProps: getAtsInput } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) setAtsFile(acceptedFiles[0]);
    },
    accept: { 'text/csv': ['.csv'], 'application/json': ['.json'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1
  });

  useEffect(() => {
    const handleMessage = async (e) => {
      if (e.data.type === "GMAIL_AUTH_CODE") {
        try {
          await ingestAPI.connectGmail({ session_id: id, auth_code: e.data.code });
          queryClient.invalidateQueries({ queryKey: ["session", id] });
          toast.success("Gmail connected!");
        } catch(err) {
          toast.error("Failed to connect Gmail");
        }
      } else if (e.data.type === "GDRIVE_AUTH_CODE") {
        try {
          await ingestAPI.connectGDrive({ session_id: id, folder_url: driveUrl, auth_code: e.data.code });
          toast.success("Google Drive connected!");
          const { job_id } = await ingestAPI.syncGDrive({ session_id: id });
          addJob(job_id, "gdrive");
          toast.success("Google Drive sync started!");
        } catch(err) {
          toast.error("Failed to connect or sync Google Drive.");
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [id, queryClient, driveUrl, addJob]);

  if (isLoading) return <div className="p-8 h-[calc(100vh-80px)] flex items-center justify-center font-bold text-muted-foreground">Loading session workspace...</div>;
  if (!session) return <div className="p-8 h-[calc(100vh-80px)] flex items-center justify-center font-bold text-muted-foreground">Session not found.</div>;

  const handleMatchAll = async () => {
    try {
      toast("Matching all candidates...", { icon: "⚙️" });
      const { job_id } = await sessionsAPI.matchAll(id);
      addJob(job_id, "match_all");
    } catch(e) { toast.error(e.message); }
  };

  const handleEndSession = async () => {
    if (window.confirm("Are you sure you want to end this session?")) {
      try {
        await sessionsAPI.update(id, { status: "completed" });
        queryClient.invalidateQueries({ queryKey: ["session", id] });
        toast.success("Session completed.");
      } catch(e) { toast.error(e.message); }
    }
  };

  const candidatesList = Array.isArray(candidatesData?.candidates)
    ? candidatesData.candidates
    : Array.isArray(candidatesData)
      ? candidatesData
      : [];
  const validRoundIndex = session.rounds?.findIndex(r => r.order === session.current_round);
  const currentRoundIndex = validRoundIndex !== undefined && validRoundIndex !== -1 ? validRoundIndex : 0;

  // Analytics Computations
  const allCandidatesList = Array.isArray(allCandidatesData?.candidates)
    ? allCandidatesData.candidates
    : Array.isArray(allCandidatesData)
      ? allCandidatesData
      : [];

  const totalParsed = allCandidatesList.length;
  const hiredFinal = allCandidatesList.filter(c => c.status === "hired").length;
  const rejectedCount = allCandidatesList.filter(c => c.status === "rejected").length;
  const scoredActive = totalParsed - hiredFinal - rejectedCount;
  const avgMatchScore = totalParsed ? Math.round(allCandidatesList.reduce((acc, c) => acc + (c.match_score || 0), 0) / totalParsed) : 0;

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden -m-4 sm:-m-6 md:-m-8">
      {/* Workspace panel */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col hide-scrollbar bg-background">
        
        {/* Workspace Page Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-[22px] sm:text-[28px] font-bold text-foreground leading-tight truncate">
                {session.name}
              </h1>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {session.job_title} · Workspace Area
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium uppercase tracking-[0.06em] border ${
                session.status === "completed" ? "bg-secondary text-secondary-foreground border-primary/20" :
                session.status === "archived" ? "bg-muted text-muted-foreground border-border" :
                "bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {((session.status || "Active").charAt(0).toUpperCase() + (session.status || "Active").slice(1).toLowerCase())}
              </span>
              <span className="inline-flex items-center h-7 px-3 rounded-full bg-muted text-foreground text-xs font-medium border border-border">
                Round {currentRoundIndex + 1} of {session.rounds?.length || 1}
              </span>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-b border-border pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={handleMatchAll} 
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground font-display text-[13px] font-medium shadow-google-1 hover:shadow-google-2 transition"
              >
                <Zap size={14} fill="currentColor" /> Match Candidates
              </button>
              <button 
                onClick={() => {
                  const url = exportAPI.candidatesUrl(id);
                  if (url) window.open(url);
                }} 
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-card border border-border text-[13px] font-medium text-foreground hover:bg-muted transition"
              >
                <Download size={14} /> Export Hired
              </button>
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/jobs/${id}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Public Apply Link copied to clipboard!");
                }}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-card border border-border text-[13px] font-medium text-foreground hover:bg-muted transition"
              >
                <LinkIcon size={14} /> Apply link
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {session.status !== "completed" && (
                <button 
                  onClick={handleEndSession} 
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-card border border-border text-[13px] font-medium text-destructive hover:bg-destructive/5 transition"
                >
                  <X size={14} /> Complete session
                </button>
              )}
              <button 
                onClick={async () => {
                  if (window.confirm(`Permanently delete session "${session.name}"? This will delete all candidates and cannot be undone.`)) {
                    try {
                      await sessionsAPI.delete(id, { delete_candidates: true, hard_delete: true });
                      toast.success('Session deleted');
                      navigate('/admin/dashboard/sessions');
                    } catch(e) { toast.error(e.message); }
                  }
                }} 
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-card border border-border text-[13px] font-medium text-destructive hover:bg-destructive/5 transition"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </header>

        {/* TABS Selector */}
        <div className="flex gap-6 mt-4 border-b border-border">
          {[
            { id: "upload", label: "Upload Resumes", icon: Upload },
            { id: "candidates", label: "Candidates Workspace", icon: Users },
            { id: "analytics", label: "Analytics Report", icon: BarChart3 }
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`relative pb-3 text-sm font-display font-medium transition ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={16} />
                  {t.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="activeWorkspaceTabIndicator"
                    className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 flex flex-col py-5">
          
          {/* UPLOAD TAB */}
          {activeTab === "upload" && (
             <div className="max-w-4xl space-y-6">
                <div>
                  <h3 className="font-display text-[16px] font-bold text-foreground">Add Candidates to Pipeline</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Select a data ingest channel to parse applicant resumes.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Direct Upload */}
                  <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-google-1 transition flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <Upload size={20} />
                      </div>
                      <h4 className="font-display text-base font-bold text-foreground mb-1">Direct file upload</h4>
                      <p className="text-xs text-muted-foreground mb-4">Upload candidate resume PDF / DOCX directly.</p>
                    </div>

                    <div {...getDirectProps()} className="border border-dashed border-primary/30 rounded-xl py-6 px-4 flex flex-col items-center justify-center text-center bg-primary/[0.02] hover:bg-primary/[0.04] transition cursor-pointer relative">
                      <input {...getDirectInput()} webkitdirectory="true" directory="" />
                      <p className="text-[13px] font-medium text-primary">Drop files here or click to browse</p>
                      <span className="text-[10px] text-muted-foreground mt-1">Accepts PDF, DOCX and folders</span>
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="mt-4 bg-muted/50 p-3 rounded-xl border border-border">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold text-foreground">{selectedFiles.length} files selected</span>
                          <button onClick={() => setSelectedFiles([])} className="text-[11px] font-bold text-[color:var(--danger)] hover:underline">Clear</button>
                        </div>
                        <ul className="max-h-24 overflow-y-auto space-y-1 pr-1 text-xs">
                          {selectedFiles.slice(0, 3).map((f, i) => (
                            <li key={i} className="text-muted-foreground flex justify-between bg-card border border-border p-1.5 rounded-lg">
                              <span className="truncate pr-2 font-medium">{f.name}</span>
                              <span className="text-muted-foreground/75 font-mono">{(f.size / 1024).toFixed(0)}KB</span>
                            </li>
                          ))}
                          {selectedFiles.length > 3 && (
                            <li className="text-[10px] text-muted-foreground text-center italic pt-1">+ {selectedFiles.length - 3} more files</li>
                          )}
                        </ul>
                        <button 
                          onClick={async () => {
                            try {
                              const { job_id } = await ingestAPI.uploadFiles(id, selectedFiles);
                              addJob(job_id, "upload");
                              setSelectedFiles([]);
                              toast.success("Upload job started!");
                            } catch (e) { toast.error(e.message); }
                          }} 
                          className="w-full mt-3 h-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-[13px] font-medium shadow-google-1 hover:shadow-google-2 transition"
                        >
                          Process {selectedFiles.length} Resumes
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ZIP Upload */}
                  <div className="relative">
                    <PremiumBadge tooltip="Bulk ZIP uploads are available on Business tier plans">
                      <div className="bg-card border border-border rounded-2xl p-5 opacity-70 flex flex-col justify-between h-full">
                        <div>
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                            <Archive size={20} />
                          </div>
                          <h4 className="font-display text-base font-bold text-foreground mb-1">ZIP Archive Upload</h4>
                          <p className="text-xs text-muted-foreground mb-4">Provide a compressed batch folder of candidate profiles.</p>
                        </div>
                        <div className="border border-dashed border-border rounded-xl py-6 px-4 flex items-center justify-center text-center bg-muted/20">
                          <p className="text-xs font-medium text-muted-foreground">Premium batch processing locked</p>
                        </div>
                      </div>
                    </PremiumBadge>
                  </div>

                  {/* Gmail Sync */}
                  <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-google-1 transition flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <Mail size={20} />
                      </div>
                      <h4 className="font-display text-base font-bold text-foreground mb-1">Gmail Sync channel</h4>
                      <p className="text-xs text-muted-foreground mb-4">Monitor inbox folders to auto-extract incoming resume attachments.</p>
                    </div>

                    {!session.gmail_address ? (
                      <div className="flex flex-col py-4 justify-center items-center bg-muted/30 border border-border rounded-xl">
                        <button 
                          onClick={async () => {
                            try {
                              const { auth_url } = await ingestAPI.getOAuthUrl("gmail", id);
                              window.open(auth_url, "gmail_oauth", "width=500,height=600,left=200,top=100");
                            } catch(e) { toast.error(e.message) }
                          }} 
                          className="h-9 px-4 rounded-full border border-border text-[13px] font-medium text-foreground hover:bg-muted bg-card shadow-sm transition"
                        >
                          Connect Gmail Account
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col bg-secondary/35 rounded-xl border border-primary/10 p-3.5">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs bg-card px-2.5 py-1 rounded-full border border-primary/20 self-start">
                          <Check size={14} /> {session.gmail_address}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 pl-0.5">
                          Last sync: {session.last_gmail_sync ? new Date(session.last_gmail_sync).toLocaleString() : 'Never'}
                        </p>
                        <button 
                          onClick={async () => {
                            try {
                              const { job_id } = await ingestAPI.syncGmail({ session_id: id });
                              addJob(job_id, "gmail");
                              toast.success("Gmail checking job queued");
                            } catch(e) { toast.error(e.message) }
                          }} 
                          className="mt-3 h-9 w-full inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-[13px] font-medium shadow-google-1 hover:shadow-google-2 transition"
                        >
                          Trigger Sync Scan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Drive Sync */}
                  <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-google-1 transition flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <LinkIcon size={20} />
                      </div>
                      <h4 className="font-display text-base font-bold text-foreground mb-1">Google Drive shared folder</h4>
                      <p className="text-xs text-muted-foreground mb-4">Pull applications automatically from a designated Drive folder link.</p>
                    </div>

                    <div className="space-y-2 mt-2">
                      <input 
                        type="text" 
                        placeholder="Google Drive Folder link..." 
                        value={driveUrl} 
                        onChange={e=>setDriveUrl(e.target.value)} 
                        className="w-full h-10 px-3 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground placeholder:text-muted-foreground transition font-medium"
                      />
                      <button 
                        onClick={async () => {
                          try {
                            const { auth_url } = await ingestAPI.getOAuthUrl("gdrive", id);
                            window.open(auth_url, "gdrive_oauth", "width=500,height=600,left=200,top=100");
                          } catch (e) { toast.error(e.message); }
                        }}
                        className="h-9 w-full inline-flex items-center justify-center rounded-full bg-primary/5 text-primary border border-primary/20 text-[13px] font-medium hover:bg-primary/10 transition"
                      >
                        Authenticate & Sync Drive
                      </button>
                    </div>
                  </div>
                </div>

                {/* ATS Import */}
                <details className="bg-card border border-border rounded-2xl hover:shadow-google-1 transition overflow-hidden group">
                  <summary className="font-display font-bold text-foreground p-4 cursor-pointer bg-muted/40 flex items-center justify-between text-sm select-none">
                    <span className="flex items-center gap-2">
                      <Building2 size={16} className="text-primary" />
                      <span>ATS / Enterprise Import Matrix</span>
                    </span>
                    <ChevronDown size={18} className="text-muted-foreground group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="p-5 border-t border-border space-y-4">
                    <div className="flex gap-2">
                      <span className="bg-secondary text-primary border border-primary/20 text-[11px] px-3.5 py-1 rounded-full font-bold">CSV schema</span>
                      <span className="text-muted-foreground border border-border text-[11px] px-3.5 py-1 rounded-full font-medium">JSON array</span>
                    </div>
                    <div className="bg-muted/50 border border-border text-foreground p-3.5 rounded-xl text-xs space-y-1">
                      <strong className="block mb-1">Standard ATS columns expected:</strong> 
                      <div className="flex flex-wrap gap-1 mt-1 font-mono text-[10px]">
                        {["name", "email", "phone", "location", "skills", "experience_years"].map((col) => (
                          <span key={col} className="bg-card border border-border px-2 py-0.5 rounded text-foreground">{col}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch" {...getAtsProps()}>
                      <div className={`border-2 border-dashed rounded-xl flex-1 py-6 px-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center ${atsFile ? 'border-primary bg-secondary/15' : 'border-border bg-muted/20 hover:bg-muted/40'}`}>
                        <input {...getAtsInput()} />
                        <span className="text-xl mb-1.5">📄</span>
                        <span className="text-xs text-muted-foreground font-bold">{atsFile ? atsFile.name : 'Click to load ATS template data'}</span>
                      </div>
                      <div className="flex flex-col justify-center gap-2 min-w-[200px]">
                        <button 
                          onClick={async () => {
                            if (!atsFile) return;
                            try {
                              toast.success("Importing candidates...");
                              const res = await ingestAPI.importATS(id, atsFile.name.endsWith(".json") ? "json" : atsFile.name.endsWith(".xlsx") ? "xlsx" : "csv", atsFile);
                              toast.success(`Imported ${res.imported} profiles. Failed: ${res.failed}`);
                              setAtsFile(null);
                              queryClient.invalidateQueries({ queryKey: ["candidates", id] });
                            } catch (e) { toast.error(e.message); }
                          }}
                          disabled={!atsFile}
                          className={`h-10 px-4 rounded-full font-display text-[13px] font-medium transition flex items-center justify-center gap-1.5 ${
                            atsFile ? 'bg-primary text-primary-foreground shadow-google-1 hover:shadow-google-2' : 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                          }`}
                        >
                          Import Records
                        </button>
                      </div>
                    </div>
                  </div>
                </details>

                {/* Active Jobs Tracking */}
                {Object.values(jobs).length > 0 && (
                  <div className="pt-4">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.16em] mb-3 flex items-center gap-1.5 pl-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      Active Background Ingestion Jobs
                    </h3>
                    <div className="space-y-2.5">
                      {Object.values(jobs).map((job) => (
                        <div key={job.id} className="bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 flex items-center justify-between hover:shadow-google-1 transition">
                          <div className="flex-1 mr-6 min-w-0">
                            <div className="flex justify-between items-end mb-1 text-[13px]">
                              <div className="font-bold text-foreground capitalize flex items-center gap-2">
                                <RefreshCw size={12} className={job.status === 'processing' ? 'animate-spin text-primary' : 'text-muted-foreground'} />
                                {job.type} sync pipeline
                              </div>
                              <div className="text-[11px] font-bold font-mono text-muted-foreground">{job.processed || 0} / {job.total || 0} parsed</div>
                            </div>
                            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${job.progress_percent || 0}%` }}></div>
                            </div>
                          </div>
                          <div className="shrink-0 pl-4">
                            {job.status === 'pending' && <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider bg-muted px-2.5 py-1 rounded-full border border-border">Pending</span>}
                            {job.status === 'processing' && <span className="text-[10px] text-primary font-bold uppercase tracking-wider bg-secondary px-2.5 py-1 rounded-full border border-primary/20">Processing</span>}
                            {job.status === 'done' && <span className="text-[10px] text-[color:var(--success)] font-bold uppercase tracking-wider bg-[color:var(--success)]/10 px-2.5 py-1 rounded-full border border-[color:var(--success)]/20">Complete</span>}
                            {job.status === 'failed' && <span className="text-[10px] text-[color:var(--danger)] font-bold uppercase tracking-wider bg-[color:var(--danger)]/10 px-2.5 py-1 rounded-full border border-[color:var(--danger)]/20">Failed ({job.failed})</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          )}

          {/* CANDIDATES TAB */}
          {activeTab === "candidates" && (
            <div className="flex-1 flex flex-col space-y-4">
              
              {/* Pipeline Rounds Headers */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border hide-scrollbar relative z-0">
                {session.rounds?.map(r => (
                  <button 
                    key={r.id || r.order}
                    type="button"
                    onClick={() => setActiveRound(r.order)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-display font-medium uppercase tracking-[0.06em] relative group transition-colors duration-200 border border-border/80 shrink-0"
                  >
                    {activeRound === r.order && (
                      <motion.div
                        layoutId="activeWorkspaceRoundIndicator"
                        className="absolute inset-0 bg-secondary rounded-full -z-10 border border-primary/20"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className={activeRound === r.order ? "text-secondary-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"}>
                      {r.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeRound === r.order ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                      {session.candidate_counts_per_round?.[String(r.order)] || 0}
                    </span>
                  </button>
                ))}
                
                <div className="h-4 w-px bg-border shrink-0 mx-1" />

                <button 
                  type="button"
                  onClick={() => setActiveRound("hired")}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-display font-medium uppercase tracking-[0.06em] relative group transition-colors duration-200 border border-border/80 shrink-0"
                >
                  {activeRound === "hired" && (
                    <motion.div
                      layoutId="activeWorkspaceRoundIndicator"
                      className="absolute inset-0 bg-[color:var(--success)]/10 rounded-full -z-10 border border-[color:var(--success)]/20"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={activeRound === "hired" ? "text-[color:var(--success)] font-medium" : "text-muted-foreground group-hover:text-[color:var(--success)]"}>
                    Hired
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeRound === "hired" ? 'bg-[color:var(--success)] text-white' : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {candidatesData?.total_hired ?? session?.total_hired ?? 0}
                  </span>
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveRound("rejected")}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-display font-medium uppercase tracking-[0.06em] relative group transition-colors duration-200 border border-border/80 shrink-0"
                >
                  {activeRound === "rejected" && (
                    <motion.div
                      layoutId="activeWorkspaceRoundIndicator"
                      className="absolute inset-0 bg-[color:var(--danger)]/10 rounded-full -z-10 border border-[color:var(--danger)]/20"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={activeRound === "rejected" ? "text-[color:var(--danger)] font-medium" : "text-muted-foreground group-hover:text-[color:var(--danger)]"}>
                    Rejected
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeRound === "rejected" ? 'bg-[color:var(--danger)] text-white' : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {candidatesData?.total_rejected ?? session?.total_rejected ?? 0}
                  </span>
                </button>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-card border border-border p-3 rounded-2xl shadow-google-1">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search candidate names…" 
                    value={filters.search} 
                    onChange={e=>setFilters({...filters, search: e.target.value})} 
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground placeholder:text-muted-foreground transition font-medium" 
                  />
                </div>

                <div className="relative">
                  <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <select 
                    value={filters.location} 
                    onChange={e=>setFilters({...filters, location: e.target.value})} 
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground transition font-medium cursor-pointer appearance-none"
                  >
                    <option value="">All locations</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 bg-muted px-3 rounded-xl h-10">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">Match &gt;</span>
                  <input 
                    type="range" min="0" max="100" step="5" 
                    value={filters.min_score} 
                    onChange={e=>setFilters({...filters, min_score: parseInt(e.target.value)})} 
                    className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary" 
                  />
                  <span className="text-xs font-bold font-mono text-foreground">{filters.min_score}%</span>
                </div>

                <input 
                  type="text" 
                  placeholder="Required skill keyword…" 
                  value={filters.skill} 
                  onChange={e=>setFilters({...filters, skill: e.target.value})} 
                  className="w-full h-10 px-3.5 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground placeholder:text-muted-foreground transition font-medium" 
                />

                <select 
                  value={filters.sort} 
                  onChange={e=>setFilters({...filters, sort: e.target.value})} 
                  className="w-full h-10 px-3.5 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground transition font-medium cursor-pointer"
                >
                  <option>Match Score ↓</option>
                  <option>Name A-Z</option>
                  <option>Newest</option>
                </select>
              </div>

              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em] pl-1 py-1">
                Found {candidatesData?.total ?? candidatesList.length} match profiles
              </div>

              {/* Grid lists */}
              <div className="flex-1 overflow-y-auto pr-1">
                {candidatesList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
                    {candidatesList.map(cand => (
                       <CandidateCard 
                         key={cand.id} 
                         candidate={cand}
                         sessionId={id}
                         rounds={session?.rounds || []}
                         onAction={() => {
                           queryClient.invalidateQueries({ queryKey: ["candidates", id] });
                           queryClient.invalidateQueries({ queryKey: ["all_candidates", id] });
                           queryClient.invalidateQueries({ queryKey: ["session", id] });
                         }}
                         isHighlighted={highlightedIds?.includes(cand.id)}
                       />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-card border border-border border-dashed rounded-2xl h-64 text-center">
                    <Search size={32} className="text-muted-foreground mb-3" />
                    <h3 className="font-display font-bold text-foreground text-sm">No workspace results</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                      No candidate profile matches this filter range in this pipeline round.
                    </p>
                    {activeRound === 1 && Object.values(jobs).length === 0 && (
                      <button 
                        onClick={()=>setActiveTab("upload")} 
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary/5 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/10 transition"
                      >
                        <Upload size={13}/> Ingest candidate resumes
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <div className="space-y-6 pb-10">
              {/* Stat panel */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Total Ingested", val: analyticsData ? analyticsData.total_applicants : totalParsed, c: "text-foreground", bg: "bg-muted" },
                  { label: "Active pipeline", val: analyticsData ? (analyticsData.total_applicants - analyticsData.hired_count - analyticsData.rejected_count) : scoredActive, c: "text-primary", bg: "bg-secondary" },
                  { label: "Selected Hires", val: analyticsData ? analyticsData.hired_count : hiredFinal, c: "text-[color:var(--success)]", bg: "bg-[color:var(--success)]/10" },
                  { label: "Rejected Profiles", val: analyticsData ? analyticsData.rejected_count : rejectedCount, c: "text-[color:var(--danger)]", bg: "bg-[color:var(--danger)]/10" },
                  { label: "Average match", val: `${analyticsData ? analyticsData.avg_match_score : avgMatchScore}%`, c: "text-primary", bg: "bg-secondary" },
                ].map((s,i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-google-1 relative overflow-hidden flex flex-col justify-between">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-2">{s.label}</div>
                    <div className={`font-display text-2xl font-bold ${s.c}`}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Funnel Stage Conversion Chart */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-google-1 h-[320px] flex flex-col">
                  <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-primary rounded-full" />
                    Hiring Funnel Conversion
                  </h3>
                  <div className="flex-1 text-xs">
                    {analyticsData?.funnel && analyticsData.funnel.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.funnel}>
                          <XAxis dataKey="name" tick={{fontSize:10, fill:'var(--color-muted-foreground)'}} axisLine={{stroke:'var(--color-border)'}} tickLine={false} />
                          <YAxis tick={{fontSize:10, fill:'var(--color-muted-foreground)'}} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{borderRadius:12, border:'1px solid var(--color-border)', backgroundColor:'var(--color-card)'}}/>
                          <Bar dataKey="reached" fill="var(--primary)" name="Reached Stage" radius={[4,4,0,0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground italic text-xs">
                        Pipeline stages not initialized yet.
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Application Sources Ratio */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-google-1 h-[320px] flex flex-col">
                  <h3 className="font-display text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-primary rounded-full" />
                    Application Ingest Channels
                  </h3>
                  <div className="flex-1 flex justify-center items-center relative text-xs">
                    {analyticsData?.sources && (analyticsData.sources.portal > 0 || analyticsData.sources.manual > 0) ? (
                      <>
                        <div className="w-[180px] h-[180px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie 
                                data={[
                                  {name:"Portal Apply", value: analyticsData.sources.portal}, 
                                  {name:"Manual Upload", value: analyticsData.sources.manual}
                                ].filter(d => d.value > 0)} 
                                dataKey="value" innerRadius={55} outerRadius={70} paddingAngle={4}
                                stroke="none"
                              >
                                <Cell fill="var(--primary)"/>
                                <Cell fill="oklch(0.65 0.17 145)"/>
                              </Pie>
                              <Tooltip contentStyle={{borderRadius:12, border:'1px solid var(--color-border)', backgroundColor:'var(--color-card)'}}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="font-display text-xl font-bold text-foreground">{analyticsData.total_applicants}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Applicants</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground italic text-xs">No applicant channel data.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Comprehensive Applicants Table with Search, Filter & CSV Export */}
              <div className="bg-card border border-border rounded-2xl shadow-google-1 overflow-hidden">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-muted/20">
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">Applicant Database</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Full registry of seeker profiles and application sources.</p>
                  </div>
                  
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch(`http://127.0.0.1:8000/api/v1/sessions/${id}/applicants?page=all`, {
                          headers: {
                            "X-API-Key": localStorage.getItem("vish_api_key") || "",
                            "Authorization": `Bearer ${localStorage.getItem("vish_jwt") || ""}`
                          }
                        });
                        const resData = await res.json();
                        if (!resData.success) throw new Error(resData.error || "Failed to fetch applicants");
                        
                        const applicants = resData.data.applicants || [];
                        if (applicants.length === 0) {
                          toast.error("No applicants to export");
                          return;
                        }
                        
                        // Build CSV
                        const headers = ["Name", "Email", "Phone", "Location", "Match Score", "Current Stage", "Status", "Source", "Applied Date"];
                        const rows = applicants.map(a => [
                          `"${a.name.replace(/"/g, '""')}"`,
                          `"${a.email}"`,
                          `"${a.phone || ''}"`,
                          `"${(a.location || '').replace(/"/g, '""')}"`,
                          a.match_score !== null ? `${a.match_score}%` : "N/A",
                          `"${a.current_round_name}"`,
                          a.status,
                          a.application_source,
                          new Date(a.created_at).toLocaleDateString()
                        ]);
                        
                        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.setAttribute("href", url);
                        link.setAttribute("download", `applicants_session_${id}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success("CSV export downloaded!");
                      } catch (err) {
                        console.error(err);
                        toast.error("Failed to export CSV");
                      }
                    }}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground font-display text-[13px] font-medium shadow-sm hover:opacity-90 transition self-start sm:self-auto"
                  >
                    <Download size={14} /> Export CSV Registry
                  </button>
                </div>

                {/* Table Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border-b border-border bg-card">
                  <input 
                    type="text" 
                    placeholder="Search applicant names..." 
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setTablePage(1);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground font-medium"
                  />
                  
                  <select 
                    value={tableSource}
                    onChange={(e) => {
                      setTableSource(e.target.value);
                      setTablePage(1);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground font-medium"
                  >
                    <option value="">All Sources</option>
                    <option value="portal">Platform (Self-Apply)</option>
                    <option value="manual">Manual Resumes</option>
                  </select>

                  <select 
                    value={tableStatus}
                    onChange={(e) => {
                      setTableStatus(e.target.value);
                      setTablePage(1);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground font-medium"
                  >
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="forwarded">Shortlisted / Forwarded</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium uppercase tracking-[0.08em] text-[10px]">
                        <th className="py-3 px-4 pl-6 font-bold">Applicant Name</th>
                        <th className="py-3 px-4 font-bold">Source Channel</th>
                        <th className="py-3 px-4 font-bold">Match Score</th>
                        <th className="py-3 px-4 font-bold">Current Stage</th>
                        <th className="py-3 px-4 text-right pr-6 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicantsTable.map((cand) => (
                        <tr key={cand.id} className="border-b last:border-b-0 border-border hover:bg-muted/30 transition-colors text-[13px] text-foreground">
                          <td className="py-3.5 px-4 pl-6 font-bold flex flex-col">
                            <span>{cand.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">{cand.email}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`pill text-[10px] font-bold px-2 py-0.5 border ${
                              cand.application_source === "portal" 
                                ? "bg-primary/5 text-primary border-primary/20" 
                                : "bg-[color:var(--success)]/5 text-[color:var(--success)] border-[color:var(--success)]/20"
                            }`}>
                              {cand.application_source === "portal" ? "Portal Apply" : "Manual Ingest"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {cand.match_score !== null ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[color:var(--success)]/10 text-[color:var(--success)] font-bold text-xs">
                                {cand.match_score}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">Calculating...</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground text-xs font-medium">{cand.current_round_name}</td>
                          <td className="py-3.5 px-4 text-right pr-6">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              cand.status === "hired" ? "bg-[color:var(--success)]/10 text-[color:var(--success)]" : 
                              cand.status === "rejected" ? "bg-[color:var(--danger)]/10 text-[color:var(--danger)]" : 
                              "bg-primary/10 text-primary"
                            }`}>
                              {cand.status || "Active"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {applicantsTable.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground text-xs font-medium">
                            No applicant listings match the specified filter parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-6 py-4 bg-muted/10 border-t border-border">
                    <span className="text-xs text-muted-foreground font-medium">
                      Page {tablePage} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTablePage(prev => Math.max(1, prev - 1))}
                        disabled={tablePage === 1}
                        className="pill border border-border px-3 py-1.5 text-xs font-semibold bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setTablePage(prev => Math.min(totalPages, prev + 1))}
                        disabled={tablePage === totalPages}
                        className="pill border border-border px-3 py-1.5 text-xs font-semibold bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ChatPanel sessionId={id} />
    </div>
  );
}
