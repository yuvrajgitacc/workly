import React from 'react';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Check, Zap, Brain, Sparkles, X, MapPin, Mail, Briefcase, CheckCircle2, XCircle, Trophy, Star, Award, Phone, Play } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

export default function SmartAnalyzerPage() {
  const [step, setStep] = useState('idle');
  const [jdText, setJdText] = useState('');
  const [resumes, setResumes] = useState([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [analysisStats, setAnalysisStats] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const onDrop = useCallback((files) => {
    setResumes(prev => [...prev, ...files]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  });

  const handleAnalysis = async () => {
    if (jdText.length < 30) { toast.error("Please enter a meaningful job description"); return; }
    if (resumes.length === 0) { toast.error("Upload at least one resume"); return; }

    setStep('analyzing');
    setProgress(0);

    const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1");

    // Step 1: Create a temporary session
    let progressVal = 5;
    setProgress(progressVal);

    try {
      const headers = {};
      const apiKey = localStorage.getItem("vish_api_key");
      if (apiKey) headers["X-API-Key"] = String(apiKey).replace(/[^\x20-\x7E]/g, "");
      const jwt = localStorage.getItem("vish_jwt");
      if (jwt && jwt !== "undefined") headers["Authorization"] = `Bearer ${jwt}`;

      // Create session
      headers["Content-Type"] = "application/json";
      const sessRes = await fetch(`${BASE}/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `Smart Analysis — ${new Date().toLocaleDateString()}`,
          job_title: "Smart Analyzer Session",
          job_description: jdText,
          rounds: [{ name: "Analysis", order: 1 }]
        })
      });
      const sessData = await sessRes.json();
      if (!sessData.success) throw new Error(sessData.error);
      const sessionId = sessData.data.id;
      progressVal = 15;
      setProgress(progressVal);

      // Infer skills from JD
      delete headers["Content-Type"];
      headers["Content-Type"] = "application/json";
      let inferredSkills = null;
      try {
        const infRes = await fetch(`${BASE}/sessions/${sessionId}/infer-skills`, {
          method: "POST", headers, body: JSON.stringify({ job_description: jdText })
        });
        const infData = await infRes.json();
        if (infData.success) {
          inferredSkills = infData.data;
        }
      } catch (e) { /* non-critical */ }

      // Set criteria
      try {
        await fetch(`${BASE}/sessions/${sessionId}/criteria`, {
          method: "POST", headers, body: JSON.stringify({
            required_skills: inferredSkills?.required_skills || [],
            nice_to_have: inferredSkills?.nice_to_have_skills || [],
            preferred_locations: inferredSkills?.preferred_locations || [],
            min_experience: inferredSkills?.minimum_experience_years || 0,
            min_match_score: 0,
            weights: { skills: 0.5, experience: 0.3, location: 0.2 }
          })
        });
      } catch (e) { /* non-critical */ }

      progressVal = 25;
      setProgress(progressVal);

      // Upload resumes
      delete headers["Content-Type"];
      const fd = new FormData();
      fd.append("session_id", sessionId);
      resumes.forEach(f => fd.append("files", f));

      const uploadHeaders = {};
      if (apiKey) uploadHeaders["X-API-Key"] = String(apiKey).replace(/[^\x20-\x7E]/g, "");
      if (jwt && jwt !== "undefined") uploadHeaders["Authorization"] = `Bearer ${jwt}`;

      const uploadRes = await fetch(`${BASE}/ingest/upload`, {
        method: "POST", headers: uploadHeaders, body: fd
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error);
      const jobId = uploadData.data.job_id;
      progressVal = 40;
      setProgress(progressVal);

      // Poll for job completion (< 10s per resume)
      headers["Content-Type"] = "application/json";
      let jobDone = false;
      let polls = 0;
      while (!jobDone && polls < 40) {
        polls++;
        await new Promise(r => setTimeout(r, 1500));
        const statusRes = await fetch(`${BASE}/ingest/status/${jobId}`, { headers });
        const statusData = await statusRes.json();
        if (statusData.success) {
          const status = statusData.data;
          const pct = status.progress_percent || 0;
          progressVal = Math.min(40 + (pct * 0.4), 80); // 40-80%
          setProgress(progressVal);
          if (status.status === "done" || status.status === "failed") {
            jobDone = true;
          }
        }
      }

      progressVal = 82;
      setProgress(progressVal);

      // Match all
      const matchRes = await fetch(`${BASE}/sessions/${sessionId}/match-all`, {
        method: "POST", headers
      });
      const matchData = await matchRes.json();

      if (matchData.success && matchData.data?.job_id) {
        // Poll match job
        const matchJobId = matchData.data.job_id;
        let matchDone = false;
        let mPolls = 0;
        while (!matchDone && mPolls < 20) {
          mPolls++;
          await new Promise(r => setTimeout(r, 1000));
          const mStatus = await fetch(`${BASE}/ingest/status/${matchJobId}`, { headers });
          const mData = await mStatus.json();
          if (mData.success && (mData.data.status === "done" || mData.data.status === "failed")) {
            matchDone = true;
          }
          progressVal = Math.min(82 + (mPolls * 1), 95);
          setProgress(progressVal);
        }
      }

      progressVal = 96;
      setProgress(progressVal);

      // Fetch final results
      const candRes = await fetch(`${BASE}/sessions/${sessionId}/candidates?limit=100&sort_by=match_score&sort_order=desc`, { headers });
      const candResJson = await candRes.json();

      if (candResJson.success) {
        const candidates = candResJson.data?.candidates || candResJson.data || [];
        setResults(candidates);
        
        const totalParsed = candidates.length;
        const avgScore = totalParsed > 0 ? Math.round(candidates.reduce((s, c) => s + (c.match_score || 0), 0) / totalParsed) : 0;
        const strongCount = candidates.filter(c => (c.match_score || 0) >= 70).length;
        setAnalysisStats({ totalParsed, avgScore, strongCount, sessionId });
      }
      
      setProgress(100);
      setTimeout(() => setStep('results'), 600);

    } catch (err) {
      console.error(err);
      toast.error(err.message || "Analysis failed");
      setStep('idle');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  const getScoreBg = (score) => {
    if (score >= 75) return "bg-success/15 text-success";
    if (score >= 50) return "bg-warning/15 text-warning";
    return "bg-destructive/10 text-destructive";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <div className="inline-flex items-center gap-2 text-primary text-xs font-medium uppercase tracking-[0.18em] mb-2">
          <Sparkles size={14} /> AI Analyzer
        </div>
        <h1 className="font-display text-[22px] sm:text-[28px] text-foreground">Smart Analyzer</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload resumes and a job description. We'll rank candidates in seconds.</p>
      </header>

      <AnimatePresence mode="wait">
        {(step === 'idle' || step === 'uploading') && (
          <motion.div key="upload" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* JD Card */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base text-foreground flex items-center gap-2">
                    <span className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                      <FileText size={16} />
                    </span>
                    Job description
                  </h2>
                  <span className="text-xs text-muted-foreground">{jdText.length} chars</span>
                </div>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="w-full h-56 p-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground transition"
                />
              </div>

              {/* Resume upload */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display text-base text-foreground flex items-center gap-2 mb-4">
                  <span className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                    <Brain size={16} />
                  </span>
                  Resumes
                </h2>
                <div
                  {...getRootProps()}
                  className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-secondary/40 transition"
                >
                  <input {...getRootProps().onClick ? getInputProps() : {}} />
                  <Upload className="text-primary mx-auto mb-3" size={28} />
                  <p className="font-display text-foreground">Drop files or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF and DOCX supported</p>
                </div>
                {resumes.length > 0 && (
                  <ul className="mt-4 space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                    {resumes.map((r, i) => (
                      <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted relative">
                        <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground truncate flex-1 pr-6">{r.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setResumes(prev => prev.filter((_, idx) => idx !== i));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAnalysis}
                disabled={jdText.length < 30 || resumes.length === 0}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-display font-medium shadow-google-1 hover:shadow-google-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={18} /> Run analysis
              </button>
            </div>
          </motion.div>
        )}

        {step === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-[55vh] flex flex-col items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="mb-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-google-2">
                <Zap size={36} className="text-white" />
              </div>
            </motion.div>

            <h2 className="text-2xl font-display text-foreground mb-2">Analyzing {resumes.length} Resume{resumes.length > 1 ? 's' : ''}...</h2>
            <p className="text-muted-foreground text-sm mb-6">AI is parsing, extracting skills, and matching criteria.</p>

            <div className="w-full max-w-md">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2">
                <span>Progress</span>
                <span className="text-primary">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            <div className="mt-8 space-y-2 w-full max-w-xs">
              {[
                { text: "Extracting skills from JD", done: progress > 15 },
                { text: "Parsing resumes with OCR", done: progress > 35 },
                { text: "Normalizing resume skills", done: progress > 55 },
                { text: "Computing matching score matrix", done: progress > 80 },
                { text: "Generating leaderboards", done: progress > 95 },
              ].map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 text-xs font-semibold transition-colors duration-300 ${s.done ? 'text-foreground' : 'text-muted-foreground opacity-50'}`}
                >
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${s.done ? 'bg-[color:var(--success)] text-white' : 'bg-muted'}`}>
                    <Check size={10} strokeWidth={3} />
                  </div>
                  {s.text}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'results' && (
          <motion.div key="results" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="font-display text-[20px] sm:text-[22px] text-foreground">Analysis Complete</h2>
                <p className="text-muted-foreground text-xs">{results.length} candidate{results.length !== 1 ? 's' : ''} ranked by AI scoring alignment.</p>
              </div>
              <button
                onClick={() => { setStep('idle'); setResults([]); setResumes([]); setJdText(''); setProgress(0); }}
                className="inline-flex items-center h-9 px-4 rounded-full border border-border text-xs font-semibold text-foreground hover:bg-muted transition"
              >
                New Analysis
              </button>
            </div>

            {/* Stat Cards */}
            {analysisStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  { label: "Total Parsed", value: analysisStats.totalParsed, tone: "muted" },
                  { label: "Average Score", value: `${analysisStats.avgScore}%`, tone: "primary" },
                  { label: "Strong Matches", value: analysisStats.strongCount, tone: "success" },
                  { label: "Scan Time", value: "< 10s", tone: "warning" }
                ].map((stat, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-1">{stat.label}</div>
                    <div className="font-display text-[22px] text-foreground leading-tight">{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Results list */}
            <div className="space-y-3">
              {results.map((cand, i) => {
                const score = cand.match_score || 0;
                const isExpanded = expandedId === cand.id;
                const matchedSkills = cand.matched_skills || [];
                const missingSkills = cand.missing_skills || [];
                const otherSkills = cand.other_skills || [];
                const experience = cand.experience || [];
                const education = cand.education || [];

                return (
                  <article key={cand.id} className="bg-card border border-border rounded-2xl hover:shadow-google-1 transition overflow-hidden">
                    <div
                      className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : cand.id)}
                    >
                      {/* Badge / Rank */}
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display text-sm font-semibold ${getScoreBg(score)}`}>
                          #{i + 1}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-sm font-bold text-foreground truncate">{cand.name || 'Unnamed Candidate'}</h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          {cand.current_role && <span className="text-primary font-semibold">{cand.current_role}</span>}
                          {cand.current_role && <span>·</span>}
                          {cand.location && <span className="flex items-center gap-0.5"><MapPin size={10} /> {cand.location}</span>}
                          {cand.total_experience_years > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5"><Briefcase size={10} /> {cand.total_experience_years} yrs exp</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Skills match highlights */}
                      <div className="hidden md:flex gap-1 items-center max-w-[200px] overflow-hidden">
                        {matchedSkills.slice(0, 3).map((s, j) => (
                          <span key={j} className="bg-success/15 text-success border border-green-100 px-2 py-0.5 rounded text-[10px] font-bold">
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* Score Indicator */}
                      <div className="text-right shrink-0">
                        <div className={`font-display text-lg font-bold leading-tight ${getScoreColor(score)}`}>
                          {score}%
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                          {cand.recommendation || (score >= 70 ? 'Strong' : score >= 40 ? 'Moderate' : 'Weak')}
                        </div>
                      </div>
                    </div>

                    {/* Expanded view */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          <div className="px-5 pb-5 pt-2 border-t border-border space-y-4 bg-muted/20">
                            {/* Score bars */}
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: "Skills Match", value: cand.skill_score || 0 },
                                { label: "Experience Match", value: cand.experience_score || 0 },
                                { label: "Location Match", value: cand.location_score || 0 }
                              ].map((sc, j) => (
                                <div key={j} className="flex flex-col">
                                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                    <span>{sc.label}</span>
                                    <span className="text-primary">{sc.value}%</span>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${sc.value}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Skills Tag Cloud */}
                            {(matchedSkills.length > 0 || missingSkills.length > 0 || otherSkills.length > 0) && (
                              <div className="space-y-1.5">
                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Skill break down</h4>
                                <div className="flex flex-wrap gap-1">
                                  {matchedSkills.map((s, j) => (
                                    <span key={`m-${j}`} className="bg-success/15 text-success border border-green-200 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5">
                                      ✓ {s}
                                    </span>
                                  ))}
                                  {missingSkills.map((s, j) => (
                                    <span key={`x-${j}`} className="bg-destructive/10 text-destructive border border-red-200 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5">
                                      ✗ {s}
                                    </span>
                                  ))}
                                  {otherSkills.map((s, j) => (
                                    <span key={`o-${j}`} className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Contact Details */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                              {cand.email && <span className="flex items-center gap-1"><Mail size={12} /> {cand.email}</span>}
                              {cand.phone && <span className="flex items-center gap-1"><Phone size={12} /> {cand.phone}</span>}
                            </div>

                            {/* Experience details */}
                            {experience.length > 0 && (
                              <div className="space-y-1.5">
                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Experience History</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {experience.slice(0, 3).map((exp, j) => (
                                    <div key={j} className="bg-card border border-border p-3 rounded-xl">
                                      <div className="font-bold text-xs text-foreground">{exp.role || exp.title}</div>
                                      <div className="text-[10px] text-primary font-semibold mt-0.5">{exp.company}</div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{exp.start_date} — {exp.end_date || 'Present'}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Education details */}
                            {education.length > 0 && (
                              <div className="space-y-1.5">
                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Education Details</h4>
                                <div className="flex flex-wrap gap-2">
                                  {education.map((edu, j) => (
                                    <div key={j} className="bg-card border border-border px-3 py-2 rounded-xl text-xs">
                                      <span className="font-bold text-foreground">{edu.degree}</span>
                                      {edu.institution && <span className="text-muted-foreground ml-1">— {edu.institution}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
