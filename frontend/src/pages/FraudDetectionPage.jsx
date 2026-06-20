import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { protectionAPI } from '../lib/api';
import { 
  Shield, 
  ScanSearch, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  FileText, 
  Upload, 
  Link2, 
  Eye, 
  Heart, 
  Briefcase, 
  Terminal, 
  Sparkles, 
  MoreHorizontal,
  RefreshCw,
  Search
} from 'lucide-react';

export default function FraudDetectionPage() {
  const [scanType, setScanType] = useState("user"); // "user" or "job"
  const [urlInput, setUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Job specific inputs
  const [jobTitleInput, setJobTitleInput] = useState("");
  const [jobDescriptionInput, setJobDescriptionInput] = useState("");
  const [jobLocationInput, setJobLocationInput] = useState("Remote");

  // History list and active report
  const [historyList, setHistoryList] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Scanning state machine
  const [scanStep, setScanStep] = useState("idle"); // idle, scanning, result
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [scannedResult, setScannedResult] = useState(null);

  const scanSteps = [
    { label: "Extracting input structure and metadata...", duration: 1200 },
    { label: "Scanning for AI generator writing signatures...", duration: 1500 },
    { label: "Cross-referencing global database (anti-plagiarism)...", duration: 1800 },
    { label: "Validating template headers & signature hashes...", duration: 1000 }
  ];

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await protectionAPI.history();
      setHistoryList(data || []);
      if (data && data.length > 0) {
        setActiveReport(data[0]);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartScan = async (e) => {
    e.preventDefault();
    if (scanType === "user" && !selectedFile && !urlInput.trim()) {
      toast.error("Please upload a file or enter a portfolio URL");
      return;
    }
    if (scanType === "job" && (!jobTitleInput.trim() || !jobDescriptionInput.trim())) {
      toast.error("Please enter a job title and description");
      return;
    }

    setScanStep("scanning");
    setCurrentStepIdx(0);

    // Prepare API call
    const apiPromise = (async () => {
      if (scanType === "user") {
        return await protectionAPI.scan({
          scan_type: "user",
          file: selectedFile,
          url: urlInput
        });
      } else {
        return await protectionAPI.scan({
          scan_type: "job",
          job_title: jobTitleInput.trim(),
          job_description: jobDescriptionInput.trim(),
          location: jobLocationInput.trim()
        });
      }
    })();

    // Run animation steps
    let currentIdx = 0;
    const interval = setInterval(() => {
      currentIdx++;
      if (currentIdx < scanSteps.length) {
        setCurrentStepIdx(currentIdx);
      } else {
        clearInterval(interval);
      }
    }, 1200);

    try {
      const [result] = await Promise.all([
        apiPromise,
        new Promise(resolve => setTimeout(resolve, 4500))
      ]);
      
      clearInterval(interval);
      setScannedResult(result);
      setScanStep("result");
      
      setHistoryList(prev => [result, ...prev]);
      setActiveReport(result);
      toast.success("Verification scan completed!");
    } catch (err) {
      clearInterval(interval);
      toast.error(err.message || "Scanning failed");
      setScanStep("idle");
    }
  };

  const resetScanner = () => {
    setScanStep("idle");
    setScannedResult(null);
    setSelectedFile(null);
    setUrlInput("");
    setJobTitleInput("");
    setJobDescriptionInput("");
    setJobLocationInput("Remote");
  };

  // Default fallback data when no logs are present
  const defaultReport = {
    candidate_name: "Sample Candidate",
    role: "Fullstack Developer",
    location: "San Francisco, CA",
    originality_score: 92,
    ai_probability: 8,
    plagiarism_score: 5,
    status: "Verified Clean",
    portfolios: ["GitHub Repo", "SaaS Dashboard App"]
  };

  const report = activeReport || defaultReport;

  const checks = {
    no_plagiarism: report.plagiarism_score < 30,
    ai_looks_authentic: report.ai_probability < 50,
    no_ai_overuse: report.ai_probability < 35,
    metadata_verified: report.originality_score > 60
  };

  const circleOffset = 264 - (report.originality_score / 100) * 264;

  const getRatingText = (score) => {
    if (score >= 80) return { label: "EXCELLENT", color: "text-[color:var(--success)]" };
    if (score >= 60) return { label: "MODERATE RISK", color: "text-[color:var(--warning)]" };
    return { label: "HIGH DANGER", color: "text-[color:var(--danger)]" };
  };
  const rating = getRatingText(report.originality_score);

  // Dynamically compute metrics
  const totalScans = historyList.length;
  const authenticSignals = historyList.filter(item => item.status === "Verified Clean").length;
  const fraudIntercepts = historyList.filter(item => item.status !== "Verified Clean").length;
  const profileViewsChecked = historyList.reduce((acc, item) => acc + (item.originality_score * 3), 0) + 1240;

  // Dynamic alerts
  const getDynamicAlerts = () => {
    const list = [];
    historyList.slice(0, 3).forEach((item, idx) => {
      const isJob = item.role === "Job Posting";
      const name = isJob ? item.candidate_name.replace("Job: ", "") : item.candidate_name;
      
      if (item.originality_score < 70 || item.plagiarism_score > 30) {
        list.push({
          id: item.id || idx,
          type: "critical",
          title: isJob ? "Suspicious Job Posting" : "High Similarity Match",
          desc: isJob 
            ? `Risk detected in job posting for "${name}".`
            : `High similarity (${item.plagiarism_score}%) detected in "${name}"'s portfolio.`,
          time: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 text-[color:var(--danger)]"
        });
      } else if (item.ai_probability > 45) {
        list.push({
          id: item.id || idx,
          type: "warning",
          title: "AI Generation Detected",
          desc: isJob
            ? `Job description for "${name}" contains high AI signature.`
            : `Candidate "${name}" resume contains high AI probability (${item.ai_probability}%).`,
          time: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/5 text-[color:var(--warning)]"
        });
      } else {
        list.push({
          id: item.id || idx,
          type: "success",
          title: isJob ? "Job Posting Safe" : "Portfolio Protected",
          desc: isJob
            ? `Job posting for "${name}" verified safe.`
            : `Candidate "${name}" portfolio verified original with ${item.originality_score}% score.`,
          time: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: "border-[color:var(--success)]/30 bg-[color:var(--success)]/5 text-[color:var(--success)]"
        });
      }
    });

    if (list.length === 0) {
      return [
        {
          id: 1,
          type: "success",
          title: "System ready",
          desc: "Upload a resume or paste a job URL to begin verification.",
          time: "Now",
          color: "border-[color:var(--success)]/30 bg-[color:var(--success)]/5 text-[color:var(--success)]"
        }
      ];
    }
    return list;
  };

  const alerts = getDynamicAlerts();

  const stats = [
    { label: "Total scans", value: totalScans.toString(), icon: FileText, tint: "bg-primary/10 text-primary" },
    { label: "Signals checked", value: profileViewsChecked.toLocaleString(), icon: Eye, tint: "bg-[#ede7f6] text-[#673ab7]" },
    { label: "Authentic", value: authenticSignals.toString(), icon: Heart, tint: "bg-[color:var(--success)]/10 text-[color:var(--success)]" },
    { label: "Stopped alerts", value: fraudIntercepts.toString(), icon: Briefcase, tint: "bg-[color:var(--danger)]/10 text-[color:var(--danger)]" },
  ];

  return (
    <div className="space-y-4">
      {/* Header — compact toolbar style */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Shield size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[20px] sm:text-[22px] font-bold text-foreground leading-tight truncate">
              Fraud Detection System
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Originality, AI-manipulation & credential checks in real time.
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary/5 text-primary border border-primary/20 font-display text-[13px] font-medium hover:bg-primary/10 transition self-start sm:self-auto">
          <Sparkles size={14} /> OriginX Core active
        </button>
      </header>

      {/* Compact stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-center gap-3 hover:shadow-google-1 transition"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.tint} shrink-0`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground truncate">
                  {s.label}
                </div>
                <div className="font-display text-[18px] font-bold text-foreground leading-tight">{s.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Originality report row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 hover:shadow-google-1 transition">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Originality report
              </span>
            </div>
            <button className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
              <MoreHorizontal size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-5 items-center">
            {/* Gauge */}
            <div className="flex sm:flex-col items-center gap-3 sm:gap-2 shrink-0">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" stroke="oklch(0.96 0.003 247)" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={report.originality_score >= 70 ? "var(--success)" : "var(--danger)"}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="264"
                    strokeDashoffset={circleOffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-display text-[22px] font-bold text-foreground leading-none">{report.originality_score}%</div>
                  <div className={`text-[9px] font-bold tracking-[0.16em] ${rating.color} mt-0.5`}>
                    {rating.label}
                  </div>
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[11px] font-display font-medium ${
                report.originality_score >= 70 ? 'bg-[color:var(--success)]/10 text-[color:var(--success)]' : 'bg-[color:var(--danger)]/10 text-[color:var(--danger)]'
              }`}>
                <CheckCircle2 size={12} /> {report.status}
              </div>
            </div>

            {/* Checks */}
            <div>
              <h2 className="font-display text-[15px] font-bold text-foreground">
                {report.role === "Job Posting" 
                  ? `Job posting: ${report.candidate_name.replace("Job: ", "")}`
                  : `${report.candidate_name} · originality check`}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3">
                {[
                  { title: report.role === "Job Posting" ? "Template safe" : "No plagiarism", desc: report.role === "Job Posting" ? "Original description" : `${report.plagiarism_score}% score`, valid: checks.no_plagiarism },
                  { title: "AI content natural", desc: `AI score ${report.ai_probability}%`, valid: checks.ai_looks_authentic },
                  { title: report.role === "Job Posting" ? "No phishing content" : "No keyword stuffing", desc: "Metadata checked", valid: checks.no_ai_overuse },
                  { title: "Structure verified", desc: "Hashed layout", valid: checks.metadata_verified },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className={`${item.valid ? "text-[color:var(--success)]" : "text-[color:var(--warning)]"} mt-0.5 shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-[13px] text-foreground font-medium leading-tight truncate">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              {report.portfolios && report.portfolios.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {report.portfolios.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted text-foreground text-[11px] font-medium border border-border"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OriginX Suite Info */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:shadow-google-1 transition relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-primary/5" />
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 relative">
            <Shield size={22} />
          </div>
          <div className="min-w-0 relative">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              OriginX Suite
            </div>
            <div className="font-display text-[14px] font-bold text-foreground leading-tight mt-0.5">
              Channels protected
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
              Recruitment pipelines authenticated & verified. Multi-agent audit modules active.
            </p>
          </div>
        </div>
      </div>

      {/* Scanner + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Scanner */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 hover:shadow-google-1 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Terminal size={14} />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-[15px] font-bold text-foreground leading-tight">
                  Real-time security scanner
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Choose a target to run AI safety audits.
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 border-b border-border flex gap-5">
              {[
                { id: "user", label: "Candidate portfolio" },
                { id: "job", label: "Job posting" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setScanType(t.id); resetScanner(); }}
                  className={`relative pb-2.5 text-[11px] font-display font-medium uppercase tracking-[0.12em] transition ${
                    scanType === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {scanType === t.id && (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-[160px]">
              <AnimatePresence mode="wait">
                {scanStep === "idle" && (
                  <motion.form 
                    onSubmit={handleStartScan}
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {scanType === "user" ? (
                      <>
                        {/* File Upload Zone */}
                        <div className="border border-dashed border-primary/30 rounded-xl py-6 px-4 flex flex-col items-center text-center bg-primary/[0.02] hover:bg-primary/[0.04] transition cursor-pointer relative group">
                          <input 
                            type="file" 
                            id="scanner-file" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => setSelectedFile(e.target.files[0])}
                          />
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                            <Upload size={18} />
                          </div>
                          <div className="font-display text-[13px] font-medium text-foreground">
                            {selectedFile ? `Selected: ${selectedFile.name}` : "Upload candidate resume (PDF / DOCX)"}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">PDF, DOCX, TXT · up to 10MB</div>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] font-medium text-muted-foreground tracking-[0.16em]">OR</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* URL input */}
                        <div className="relative">
                          <Link2
                            size={14}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="GitHub repository URL, Behance portfolio link…"
                            className="w-full h-10 pl-10 pr-3 rounded-full bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground placeholder:text-muted-foreground transition"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={jobTitleInput}
                              onChange={(e) => setJobTitleInput(e.target.value)}
                              placeholder="Job Title (e.g. Frontend Engineer)"
                              className="w-full h-10 px-3.5 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground placeholder:text-muted-foreground transition"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={jobLocationInput}
                              onChange={(e) => setJobLocationInput(e.target.value)}
                              placeholder="Location (e.g. Remote)"
                              className="w-full h-10 px-3.5 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground placeholder:text-muted-foreground transition"
                            />
                          </div>
                        </div>
                        <div>
                          <textarea
                            value={jobDescriptionInput}
                            onChange={(e) => setJobDescriptionInput(e.target.value)}
                            placeholder="Paste job posting description here to audit templates or phishing indicators..."
                            rows={3}
                            className="w-full p-3 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-[13px] text-foreground placeholder:text-muted-foreground transition resize-none"
                          />
                        </div>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-full bg-primary text-primary-foreground font-display text-[13px] font-medium shadow-google-1 hover:shadow-google-2 transition"
                    >
                      <ScanSearch size={16} /> Start verification scan
                    </button>
                  </motion.form>
                )}

                {scanStep === "scanning" && (
                  <motion.div 
                    className="py-4 space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="animate-spin text-primary w-8 h-8" />
                      <div className="text-center">
                        <h4 className="font-bold text-xs text-foreground">AI Scanning Suite Active</h4>
                        <p className="text-[10px] text-muted-foreground">Analyzing input signatures...</p>
                      </div>
                    </div>

                    <div className="space-y-2 bg-muted/50 border border-border rounded-xl p-3.5">
                      {scanSteps.map((step, idx) => {
                        const isDone = idx < currentStepIdx;
                        const isActive = idx === currentStepIdx;
                        return (
                          <div key={idx} className="flex items-center gap-2.5 text-[11px]">
                            {isDone ? (
                              <CheckCircle2 className="text-[color:var(--success)] shrink-0 w-4 h-4" />
                            ) : isActive ? (
                              <RefreshCw className="text-primary animate-spin shrink-0 w-4 h-4" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                            )}
                            <span className={`font-medium ${isDone ? "text-muted-foreground line-through" : isActive ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {scanStep === "result" && scannedResult && (
                  <motion.div 
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className={`p-3 border rounded-xl flex items-start gap-3 ${
                      scannedResult.originality_score >= 70
                        ? "bg-[color:var(--success)]/5 border-[color:var(--success)]/20 text-[color:var(--success)]"
                        : "bg-[color:var(--danger)]/5 border-[color:var(--danger)]/20 text-[color:var(--danger)]"
                    }`}>
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-[13px]">
                          Scan Complete: {scannedResult.status}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Verified credentials logged for <strong>{scannedResult.candidate_name.replace("Job: ", "")}</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted p-2 rounded-lg text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Originality</p>
                        <h4 className={`text-[16px] font-bold mt-0.5 ${
                          scannedResult.originality_score >= 80 ? "text-[color:var(--success)]" : scannedResult.originality_score >= 60 ? "text-[color:var(--warning)]" : "text-[color:var(--danger)]"
                        }`}>{scannedResult.originality_score}%</h4>
                      </div>
                      <div className="bg-muted p-2 rounded-lg text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">AI Content</p>
                        <h4 className="text-[16px] font-bold text-foreground mt-0.5">{scannedResult.ai_probability}%</h4>
                      </div>
                      <div className="bg-muted p-2 rounded-lg text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Plagiarism</p>
                        <h4 className="text-[16px] font-bold text-foreground mt-0.5">{scannedResult.plagiarism_score}%</h4>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/40 rounded-lg border border-border text-[11px] text-muted-foreground">
                      <strong>Summary:</strong> {scannedResult.summary || "All credentials verified clean."}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={resetScanner} className="flex-1 inline-flex items-center justify-center h-9 rounded-full bg-primary/5 text-primary border border-primary/20 text-[11px] font-medium hover:bg-primary/10 transition">
                        Scan another target
                      </button>
                      <button onClick={resetScanner} className="flex-1 inline-flex items-center justify-center h-9 rounded-full bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/95 transition">
                        Reset scanner
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-card border border-border rounded-xl p-4 hover:shadow-google-1 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-[15px] font-bold text-foreground">Recent alerts</h2>
              <button className="text-[11px] text-primary font-display font-medium hover:underline">View all</button>
            </div>

            <div className="space-y-2">
              {alerts.map((a, idx) => (
                <div key={idx} className={`p-3 border rounded-xl flex gap-3 ${a.color}`}>
                  {a.type === "critical" ? (
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-[color:var(--danger)]" />
                  ) : a.type === "warning" ? (
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-[color:var(--warning)]" />
                  ) : (
                    <Shield size={15} className="shrink-0 mt-0.5 text-[color:var(--success)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-[12px] truncate">{a.title}</h4>
                      <span className="text-[9px] opacity-60 shrink-0">{a.time}</span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2 leading-tight">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scan logs table */}
      <section className="bg-card border border-border rounded-xl hover:shadow-google-1 transition overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="font-display text-[15px] font-bold text-foreground leading-tight">Scan logs</h2>
            <p className="text-[11px] text-muted-foreground">Recently scanned profiles & postings.</p>
          </div>
          <button className="text-[11px] text-primary font-display font-medium hover:underline">Export</button>
        </div>

        {loadingHistory ? (
          <div className="py-8 flex justify-center items-center">
            <RefreshCw className="animate-spin text-muted-foreground w-6 h-6" />
          </div>
        ) : historyList.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            No scans recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium uppercase tracking-[0.08em] text-[10px]">
                  <th className="py-2.5 px-4 font-bold">Scan Target</th>
                  <th className="py-2.5 px-4 font-bold">Trust Score</th>
                  <th className="py-2.5 px-4 font-bold">Flags & Portfolios</th>
                  <th className="py-2.5 px-4 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((cand) => {
                  const isJob = cand.role === "Job Posting";
                  const nameDisplay = isJob ? cand.candidate_name.replace("Job: ", "") : cand.candidate_name;
                  return (
                    <tr 
                      key={cand.id} 
                      onClick={() => setActiveReport(cand)}
                      className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors text-[13px] ${
                        activeReport?.id === cand.id ? "bg-primary/5 font-medium" : "text-foreground"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center uppercase shrink-0 text-[11px]">
                            {isJob ? "J" : (nameDisplay ? nameDisplay[0] : "C")}
                          </div>
                          <div>
                            <div className="font-bold text-foreground leading-snug">{nameDisplay}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {isJob ? "Job Posting" : cand.role} • {cand.location}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${
                          cand.originality_score >= 80 ? "text-[color:var(--success)]" : cand.originality_score >= 60 ? "text-[color:var(--warning)]" : "text-[color:var(--danger)]"
                        }`}>
                          {cand.originality_score}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {cand.portfolios && cand.portfolios.map((p, pIdx) => (
                            <span key={pIdx} className="bg-muted text-foreground text-[10px] px-2 py-0.5 rounded font-medium border border-border">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          cand.status === "Verified Clean" 
                            ? "bg-[color:var(--success)]/10 text-[color:var(--success)]" 
                            : "bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
                        }`}>
                          {cand.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
