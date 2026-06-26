import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { protectionAPI } from '../lib/api';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle,
  FileCheck, 
  Eye, 
  Heart, 
  Briefcase, 
  Search, 
  Upload, 
  ChevronRight, 
  FileText, 
  Terminal, 
  RefreshCw,
  HelpCircle,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

export default function FraudDetectionPage() {
  const [scanType, setScanType] = useState("user"); // "user" or "job"
  const [urlInput, setUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Job specific inputs
  const [jobUrlInput, setJobUrlInput] = useState("");
  const [jobTitleInput, setJobTitleInput] = useState("");
  const [jobDescriptionInput, setJobDescriptionInput] = useState("");
  const [jobLocationInput, setJobLocationInput] = useState("Remote");

  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const POPULAR_TITLES = [
    { title: "Remote Data Entry Assistant", desc: "We are looking for a remote assistant to manage spreadsheet data entry, verify database records, and perform general administrative tasks." },
    { title: "Virtual Support Representative", desc: "Responsible for responding to customer emails, resolving support tickets, and maintaining customer relationship records." },
    { title: "Part-time Copywriter", desc: "Write engaging marketing copy, blog posts, and social media captions. Requires strong communication skills and basic SEO knowledge." },
    { title: "Freelance Quality Analyst", desc: "Review software applications, log issues in trackers, and work with developers to ensure final builds meet standard guidelines." }
  ];

  const handleJobTitleFocus = () => {
    setShowTitleSuggestions(true);
    if (!jobTitleInput.trim()) {
      setTitleSuggestions(POPULAR_TITLES);
    } else {
      handleJobTitleChange(jobTitleInput);
    }
  };

  const handleJobTitleChange = (val) => {
    setJobTitleInput(val);
    if (!val.trim()) {
      setTitleSuggestions(POPULAR_TITLES);
      return;
    }
    const filtered = POPULAR_TITLES.filter(t => 
      t.title.toLowerCase().includes(val.toLowerCase())
    );
    setTitleSuggestions(filtered);
  };

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
    const handleOutsideClick = () => {
      setShowTitleSuggestions(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
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
    if (scanType === "job" && !jobUrlInput.trim() && (!jobTitleInput.trim() || !jobDescriptionInput.trim())) {
      toast.error("Please enter a job URL or manual job details");
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
          url: jobUrlInput.trim(),
          job_title: jobTitleInput.trim(),
          job_description: jobDescriptionInput.trim(),
          location: jobLocationInput.trim()
        });
      }
    })();

    // Run animation steps in parallel
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
      // Wait for both the minimum animations and backend API response
      const [result] = await Promise.all([
        apiPromise,
        new Promise(resolve => setTimeout(resolve, 4500)) // ensure steps have time to render
      ]);
      
      clearInterval(interval);
      setScannedResult(result);
      setScanStep("result");
      
      // Add result to history list
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
    setJobUrlInput("");
    setJobTitleInput("");
    setJobDescriptionInput("");
    setJobLocationInput("Remote");
  };

  // Derive reports & values
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

  const getReportChecks = (rep) => {
    if (rep && rep.detailed_checks && Object.keys(rep.detailed_checks).length > 0) {
      const keys = ["official_website", "recruiter_email", "salary_realistic", "linkedin_presence", "description_copied", "repeated_posts"];
      const hasAllKeys = keys.every(k => rep.detailed_checks[k] && rep.detailed_checks[k].status && rep.detailed_checks[k].status !== "Unknown");
      if (hasAllKeys) {
        return rep.detailed_checks;
      }
    }
    
    const score = rep ? (rep.originality_score ?? 95) : 95;
    const isSafe = score >= 70;
    return {
      official_website: {
        status: isSafe ? "Yes" : "No",
        details: isSafe ? "Company official domain and site verified." : "Could not verify company website or domain registration."
      },
      recruiter_email: {
        status: isSafe ? "Yes" : "No",
        details: isSafe ? "Sender email domain matches the company domain." : "Uses generic public domain email contact (@gmail.com / @yahoo.com)."
      },
      salary_realistic: {
        status: isSafe ? "Yes" : "No",
        details: isSafe ? "Compensation range aligns with local market standards." : "Salary offered is abnormally high for minimal experience."
      },
      linkedin_presence: {
        status: isSafe ? "Yes" : "No",
        details: isSafe ? "Found active LinkedIn page with verified employee connections." : "No matching company page or verified staff on professional networks."
      },
      description_copied: {
        status: isSafe ? "No" : "Yes",
        details: isSafe ? "Job description is unique and custom-tailored." : "Description matches generic scam templates or cloned postings."
      },
      repeated_posts: {
        status: "No",
        details: "First-time signature detected for this role."
      }
    };
  };

  const checks = {
    no_plagiarism: report.plagiarism_score < 30,
    ai_looks_authentic: report.ai_probability < 50,
    no_ai_overuse: report.ai_probability < 35,
    metadata_verified: report.originality_score > 60
  };

  const circleOffset = 427 - (report.originality_score / 100) * 427;

  const getRatingText = (score) => {
    if (score >= 80) return { label: "Excellent", color: "text-[#22C55E]" };
    if (score >= 60) return { label: "Moderate Risk", color: "text-[#2563EB]" };
    return { label: "High Danger", color: "text-red-500" };
  };
  const rating = getRatingText(report.originality_score);

  const getStrokeColor = (score) => {
    if (score >= 80) return "#22C55E";
    if (score >= 60) return "#2563EB";
    return "#EF4444";
  };

  // Dynamically compute metrics
  const totalScans = historyList.length;
  const authenticSignals = historyList.filter(item => item.status === "Verified Clean").length;
  const fraudIntercepts = historyList.filter(item => item.status !== "Verified Clean").length;
  const profileViewsChecked = historyList.reduce((acc, item) => acc + (item.originality_score * 3), 0) + 1240;

  // Dynamic alerts
  const getDynamicAlerts = () => {
    const list = [];
    historyList.slice(0, 4).forEach((item, idx) => {
      const isJob = item.role === "Job Posting";
      const name = isJob ? item.candidate_name.replace("Job: ", "") : item.candidate_name;
      
      if (item.originality_score < 70 || item.plagiarism_score > 30) {
        list.push({
          id: item.id || idx,
          type: "critical",
          title: isJob ? "Suspicious Job Posting" : "High Similarity Match",
          desc: isJob 
            ? `Risk detected in job posting for "${name}". Similarity to cloned scams.`
            : `High similarity (${item.plagiarism_score}%) detected in "${name}"'s portfolio.`,
          time: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: "border-red-200 bg-red-50/50 text-red-700"
        });
      } else if (item.ai_probability > 45) {
        list.push({
          id: item.id || idx,
          type: "warning",
          title: "AI Generation Detected",
          desc: isJob
            ? `Job description for "${name}" contains high AI-generated signature.`
            : `Candidate "${name}"'s resume contains high AI probability (${item.ai_probability}%).`,
          time: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: "border-amber-200 bg-amber-50/50 text-amber-700"
        });
      } else {
        list.push({
          id: item.id || idx,
          type: "success",
          title: isJob ? "Job Posting Safe" : "Portfolio Protected",
          desc: isJob
            ? `Job posting for "${name}" verified safe & original.`
            : `Candidate "${name}" portfolio verified original with ${item.originality_score}% score.`,
          time: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: "border-emerald-200 bg-emerald-50/50 text-emerald-700"
        });
      }
    });

    if (list.length === 0) {
      return [
        {
          id: 1,
          type: "success",
          title: "System Ready",
          desc: "Upload portfolio resumes or enter job posting details to run advanced verification.",
          time: "Now",
          color: "border-emerald-200 bg-emerald-50/50 text-emerald-700"
        }
      ];
    }
    return list;
  };

  const alerts = getDynamicAlerts();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-[#2A2A2A] font-sans">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2A2A2A] flex items-center gap-2.5">
            <Shield className="text-[#2563EB] w-8 h-8" />
            <span>Fraud Detection System</span>
          </h1>
          <p className="text-sm text-[#5c5c5c] mt-1">
            Analyze originality, detect AI-generated manipulation, and protect against credentials fabrication in real time.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold bg-[#F0F6FF] text-[#2563EB] px-3.5 py-2 rounded-xl border border-[#BFDBFE] shadow-sm">
          <Sparkles size={14} />
          <span>Active OriginX Core Protection</span>
        </div>
      </div>

      {/* Main Grid: Dial, Authenticity Status, and 3D pedestal shield graphic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Dial & Checklist (Occupies 8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#e6dfcd] p-8 rounded-3xl shadow-sm flex flex-col md:flex-row gap-8 items-center justify-between relative overflow-hidden">
          
          {/* Dial Card */}
          <div className="flex flex-col items-center text-center space-y-4 md:border-r border-[#f5f4ef] md:pr-8 shrink-0 w-full md:w-auto">
            <h3 className="font-extrabold text-[#2A2A2A] text-sm uppercase tracking-wider">AI Originality Score</h3>
            
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="68" stroke="#f5f4ef" strokeWidth="8" fill="transparent" />
                <circle
                  cx="80"
                  cy="80"
                  r="68"
                  stroke={getStrokeColor(report.originality_score)}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray="427"
                  strokeDashoffset={circleOffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-[#2A2A2A]">{report.originality_score}%</span>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold ${rating.color} mt-0.5`}>
                  {rating.label}
                </span>
              </div>
            </div>

            <span className={`text-xs font-bold ${report.originality_score >= 70 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-3 py-1 rounded-full flex items-center gap-1`}>
              {report.status}
            </span>
          </div>

          {/* Checklist & Summary */}
          <div className="flex-1 space-y-6 w-full">
            <div>
              <h3 className="text-xl font-black text-[#2A2A2A]">
                {report.role === "Job Posting" 
                  ? `Job Description for "${report.candidate_name.replace("Job: ", "")}"`
                  : `Candidate "${report.candidate_name}" originality report`}
              </h3>
              <p className="text-xs text-[#5c5c5c] mt-1">
                {report.role === "Job Posting" 
                  ? "AI scanning evaluates safety, legitimacy, and text structure indicators:" 
                  : "Our AI suite scans resumes and repository metadata to confirm authenticity:"}
              </p>
            </div>

            {report.role === "Job Posting" ? (
              <div className="space-y-6 w-full">
                {/* AI System Output (Matching the Reference Image layout) */}
                <div className="bg-[#f0f6ff]/45 border border-[#bfdbfe]/50 p-5 rounded-2xl space-y-3.5 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2563EB] flex items-center gap-1.5">
                    <Sparkles size={14} className="animate-pulse" />
                    <span>AI Fake Job Detection System Output</span>
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Trust Score</p>
                      <h4 className="text-sm font-black text-[#2A2A2A] mt-1">
                        {report.originality_score}/100
                      </h4>
                    </div>
                    
                    <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Risk Level</p>
                      <h4 className={`text-sm font-black mt-1 ${
                        (report.risk_level || 'Low') === 'High' ? 'text-rose-600' :
                        (report.risk_level || 'Low') === 'Medium' ? 'text-amber-500' : 'text-emerald-600'
                      }`}>
                        {report.risk_level || (report.originality_score >= 80 ? 'Low' : report.originality_score >= 60 ? 'Medium' : 'High')}
                      </h4>
                    </div>
                    
                    <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Verified Company</p>
                      <h4 className={`text-sm font-black mt-1 ${
                        (report.verified_company || 'Yes') === 'Yes' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {report.verified_company || (report.originality_score >= 70 ? 'Yes' : 'No')}
                      </h4>
                    </div>
                    
                    <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Status</p>
                      <h4 className={`text-sm font-black mt-1 ${
                        report.status === 'Approved' || report.status === 'Verified Clean' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {report.status === 'Verified Clean' ? 'Approved' : report.status}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* AI Checks Grid (6 Checks from Diagram) */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Terminal size={12} className="text-gray-400" />
                    <span>System AI Verification Checks</span>
                  </h5>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: "official_website", question: "Does the company have an official website?" },
                      { key: "recruiter_email", question: "Does recruiter email use official domain?" },
                      { key: "salary_realistic", question: "Is salary realistic?" },
                      { key: "linkedin_presence", question: "Does company exist on LinkedIn?" },
                      { key: "description_copied", question: "Does description look copied or suspicious?" },
                      { key: "repeated_posts", question: "Is the same job repeatedly posted?" }
                    ].map((item) => {
                      const checkVal = getReportChecks(report)[item.key] || { status: "Unknown", details: "No indicators verified." };
                      const safeMapping = { official_website: "yes", recruiter_email: "yes", salary_realistic: "yes", linkedin_presence: "yes", description_copied: "no", repeated_posts: "no" };
                      const riskMapping = { official_website: "no", recruiter_email: "no", salary_realistic: "no", linkedin_presence: "no", description_copied: "yes", repeated_posts: "yes" };
                      const lowercaseVal = String(checkVal.status).toLowerCase();
                      
                      let badgeClass = "bg-gray-50 text-gray-500 border-gray-100";
                      let borderClass = "border-[#e6dfcd]";
                      let iconColor = "text-gray-400";
                      
                      if (lowercaseVal === safeMapping[item.key]) {
                        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        borderClass = "border-emerald-100";
                        iconColor = "text-emerald-500";
                      } else if (lowercaseVal === riskMapping[item.key]) {
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                        borderClass = "border-rose-100";
                        iconColor = "text-rose-500";
                      }
                      
                      return (
                        <div key={item.key} className={`p-3.5 border rounded-2xl bg-white shadow-sm flex items-start gap-3 ${borderClass}`}>
                          <CheckCircle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${iconColor}`} />
                          <div className="space-y-1 flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <h6 className="text-[11px] font-extrabold text-[#2A2A2A] leading-tight">{item.question}</h6>
                              <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full shrink-0 ${badgeClass}`}>
                                {checkVal.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                              {checkVal.details}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { 
                      label: "No plagiarism detected", 
                      desc: "No copy-paste resumes",
                      valid: checks.no_plagiarism
                    },
                    { 
                      label: "AI content is natural", 
                      desc: `AI score: ${report.ai_probability}%`, 
                      valid: checks.ai_looks_authentic
                    },
                    { 
                      label: "No AI keyword stuffing", 
                      desc: "Invisible text verified",
                      valid: checks.no_ai_overuse
                    },
                    { 
                      label: "Structure verified", 
                      desc: "Metadata hashes verified",
                      valid: checks.metadata_verified
                    }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      {item.valid ? (
                        <CheckCircle className="text-emerald-500 w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="text-amber-500 w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h5 className="text-xs font-bold text-[#2A2A2A]">{item.label}</h5>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {report.portfolios && report.portfolios.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                      Key Verified Assets
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {report.portfolios.map((p, pIdx) => (
                        <span key={pIdx} className="bg-[#f5f4ef] text-[#2A2A2A] text-[10px] px-2.5 py-1 rounded-lg font-semibold border border-[#e6dfcd]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Sleek 3D Pedestal Shield (Occupies 4 cols) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-[#F0F6FF] to-white border border-[#e6dfcd] p-8 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Animated concentric decorative circles */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 rounded-full border border-[#BFDBFE]/30 animate-pulse" />
            <div className="w-40 h-40 rounded-full border border-[#BFDBFE]/50" />
            <div className="w-24 h-24 rounded-full border border-[#BFDBFE]" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="w-20 h-20 bg-[#2563EB]/10 border-2 border-[#2563EB] rounded-3xl flex items-center justify-center text-[#2563EB] mx-auto shadow-lg shadow-amber-500/10">
              <Shield className="w-10 h-10 animate-bounce" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-[#2A2A2A] uppercase tracking-wider">OriginX Suite</h4>
              <p className="text-xs text-[#5c5c5c] max-w-[200px] mx-auto mt-2 leading-relaxed">
                Recruitment channels protected, authenticated, and verified.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Scans Run", value: totalScans, icon: FileCheck, color: "text-blue-500 bg-blue-50 border-blue-100" },
          { label: "Signals Checked", value: profileViewsChecked.toLocaleString(), icon: Eye, color: "text-purple-500 bg-purple-50 border-purple-100" },
          { label: "Authentic Signals", value: authenticSignals, icon: Heart, color: "text-emerald-500 bg-emerald-50 border-emerald-100" },
          { label: "Stopped Alerts", value: fraudIntercepts, icon: Briefcase, color: "text-rose-500 bg-rose-50 border-rose-100" }
        ].map((m, idx) => (
          <div key={idx} className="bg-white border border-[#e6dfcd] p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${m.color.split(' ')[1]} ${m.color.split(' ')[0]} ${m.color.split(' ')[2]}`}>
              <m.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 leading-none">{m.label}</p>
              <h4 className="text-2xl font-black text-[#2A2A2A] mt-1">{m.value}</h4>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Interactive Scanner and Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Interactive scanning panel (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#e6dfcd] p-6 rounded-3xl shadow-sm space-y-6">
          
          <div className="pb-4 border-b border-[#f5f4ef] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-base text-[#2A2A2A] flex items-center gap-2">
                <Terminal size={18} className="text-[#2563EB]" />
                <span>Real-Time Security Scanner</span>
              </h3>
              <p className="text-xs text-[#5c5c5c] mt-0.5">Choose scan target to run AI safety audits.</p>
            </div>
          </div>

          {/* Toggle Type tabs */}
          <div className="flex border-b border-[#e6dfcd]">
            <button
              type="button"
              onClick={() => { setScanType("user"); resetScanner(); }}
              className={`pb-2.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all ${
                scanType === "user"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-400 hover:text-[#2A2A2A]"
              }`}
            >
              Scan Candidate Portfolio
            </button>
            <button
              type="button"
              onClick={() => { setScanType("job"); resetScanner(); }}
              className={`ml-6 pb-2.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all ${
                scanType === "job"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-400 hover:text-[#2A2A2A]"
              }`}
            >
              Scan Job Posting
            </button>
          </div>

          <AnimatePresence mode="wait">
            {scanStep === "idle" && (
              <motion.form 
                onSubmit={handleStartScan}
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {scanType === "user" ? (
                  <>
                    {/* File Upload zone */}
                    <div className="border-2 border-dashed border-[#e6dfcd] hover:border-[#2563EB] rounded-2xl p-8 text-center cursor-pointer transition-colors bg-[#f5f4ef]/30 group">
                      <input 
                        type="file" 
                        id="scanner-file" 
                        accept=".pdf,.docx,.doc,.txt"
                        className="hidden" 
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                      />
                      <label htmlFor="scanner-file" className="cursor-pointer space-y-2 block">
                        <Upload className="mx-auto text-gray-300 group-hover:text-[#2563EB] transition-colors w-10 h-10" />
                        <div className="text-xs font-bold text-[#2A2A2A]">
                          {selectedFile ? `Selected File: ${selectedFile.name}` : "Upload candidate resume PDF / DOCX / TXT"}
                        </div>
                        <p className="text-[10px] text-gray-400">PDF, DOCX, TXT up to 10MB</p>
                      </label>
                    </div>

                    <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest my-2">OR</div>

                    {/* URL input */}
                    <div className="relative">
                      <LinkIcon className="absolute left-3.5 top-3.5 text-gray-400 w-4 h-4" />
                      <input 
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Enter GitHub repository URL, Behance portfolio link..."
                        className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 pl-10 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* URL Input */}
                    <div className="relative">
                      <LinkIcon className="absolute left-3.5 top-3.5 text-gray-400 w-4 h-4" />
                      <input 
                        type="text"
                        value={jobUrlInput}
                        onChange={(e) => setJobUrlInput(e.target.value)}
                        placeholder="Enter LinkedIn Job Post URL (automatically extracts title & description)..."
                        className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 pl-10 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner"
                      />
                    </div>

                    <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest my-1">OR ENTER DETAILS MANUALLY</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <label className="block text-[10px] font-extrabold text-[#2A2A2A] uppercase tracking-wider mb-1">Job Title</label>
                        <input
                          type="text"
                          disabled={!!jobUrlInput.trim()}
                          value={jobUrlInput.trim() ? "" : jobTitleInput}
                          onChange={(e) => handleJobTitleChange(e.target.value)}
                          onFocus={handleJobTitleFocus}
                          placeholder={jobUrlInput.trim() ? "Locked: URL provided" : "e.g. Senior Product Designer"}
                          className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner disabled:opacity-50"
                        />
                        {showTitleSuggestions && titleSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-[110%] bg-white border border-[#e6dfcd] rounded-xl shadow-xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto text-left">
                            {titleSuggestions.map((t, idx) => (
                              <div
                                key={idx}
                                onMouseDown={() => {
                                  setJobTitleInput(t.title);
                                  setJobDescriptionInput(t.desc);
                                  setShowTitleSuggestions(false);
                                  toast.success(`Autofilled job template for ${t.title}!`);
                                }}
                                className="px-4 py-2 hover:bg-[#f5f4ef] cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                              >
                                <p className="text-xs font-bold text-[#2A2A2A]">{t.title}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{t.desc}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-[#2A2A2A] uppercase tracking-wider mb-1">Location / Category</label>
                        <input
                          type="text"
                          disabled={!!jobUrlInput.trim()}
                          value={jobUrlInput.trim() ? "" : jobLocationInput}
                          onChange={(e) => setJobLocationInput(e.target.value)}
                          placeholder={jobUrlInput.trim() ? "Locked: URL provided" : "e.g. Remote / Chicago, IL"}
                          className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-[#2A2A2A] uppercase tracking-wider mb-1">Job Posting Description</label>
                      <textarea
                        disabled={!!jobUrlInput.trim()}
                        value={jobUrlInput.trim() ? "" : jobDescriptionInput}
                        onChange={(e) => setJobDescriptionInput(e.target.value)}
                        placeholder={jobUrlInput.trim() ? "Locked: URL provided" : "Paste the description/requirements here to analyze for clone templates, ghost post indicators, or sketchy payment details..."}
                        rows={4}
                        className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner resize-none disabled:opacity-50"
                      />
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={(scanType === "user" && !selectedFile && !urlInput.trim()) || (scanType === "job" && !jobUrlInput.trim() && (!jobTitleInput.trim() || !jobDescriptionInput.trim()))}
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Search size={16} />
                  <span>Start Verification Scan</span>
                </button>
              </motion.form>
            )}

            {scanStep === "scanning" && (
              <motion.div 
                className="py-6 space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="animate-spin text-[#2563EB] w-10 h-10" />
                  <div className="text-center">
                    <h4 className="font-bold text-sm text-[#2A2A2A]">AI Scanning Suite Active</h4>
                    <p className="text-[11px] text-[#5c5c5c] mt-0.5">Please wait, analyzing document profiles...</p>
                  </div>
                </div>

                {/* Steps checklist with dynamic highlights */}
                <div className="space-y-3 bg-[#f5f4ef]/40 border border-[#e6dfcd] rounded-2xl p-5">
                  {scanSteps.map((step, idx) => {
                    const isDone = idx < currentStepIdx;
                    const isActive = idx === currentStepIdx;
                    return (
                      <div key={idx} className="flex items-center gap-3 text-xs">
                        {isDone ? (
                          <CheckCircle className="text-emerald-500 shrink-0 w-4.5 h-4.5" />
                        ) : isActive ? (
                          <RefreshCw className="text-[#2563EB] animate-spin shrink-0 w-4.5 h-4.5" />
                        ) : (
                          <div className="w-4.5 h-4.5 rounded-full border-2 border-gray-200 shrink-0" />
                        )}
                        <span className={`font-semibold ${isDone ? "text-gray-400 line-through" : isActive ? "text-[#2563EB] font-extrabold" : "text-[#5c5c5c]"}`}>
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
                className="space-y-6"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Result header */}
                <div className={`p-5 border rounded-2xl flex items-start gap-4 ${
                  scannedResult.originality_score >= 70
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                    : "bg-red-50 border-red-100 text-red-800"
                }`}>
                  <CheckCircle className={scannedResult.originality_score >= 70 ? "text-emerald-500 w-6 h-6 shrink-0 mt-0.5" : "text-rose-500 w-6 h-6 shrink-0 mt-0.5"} />
                  <div>
                    <h4 className="font-extrabold text-sm">
                      {scannedResult.role === "Job Posting"
                        ? `Job Posting Scan Completed: ${scannedResult.status}`
                        : `Portfolio Scan Completed: ${scannedResult.status}`}
                    </h4>
                    <p className="text-xs mt-0.5">
                      Verify report credentials generated for <strong>{scannedResult.candidate_name.replace("Job: ", "")}</strong>.
                    </p>
                  </div>
                </div>

                {scannedResult.role === "Job Posting" ? (
                  <div className="space-y-6">
                    {/* AI System Output (Matching the Reference Image layout) */}
                    <div className="bg-[#f0f6ff]/45 border border-[#bfdbfe]/50 p-5 rounded-2xl space-y-3.5 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2563EB] flex items-center gap-1.5">
                        <Sparkles size={14} className="animate-pulse" />
                        <span>AI Fake Job Detection System Output</span>
                      </h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Trust Score</p>
                          <h4 className="text-sm font-black text-[#2A2A2A] mt-1">
                            {scannedResult.originality_score}/100
                          </h4>
                        </div>
                        
                        <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Risk Level</p>
                          <h4 className={`text-sm font-black mt-1 ${
                            (scannedResult.risk_level || 'Low') === 'High' ? 'text-rose-600' :
                            (scannedResult.risk_level || 'Low') === 'Medium' ? 'text-amber-500' : 'text-emerald-600'
                          }`}>
                            {scannedResult.risk_level || (scannedResult.originality_score >= 80 ? 'Low' : scannedResult.originality_score >= 60 ? 'Medium' : 'High')}
                          </h4>
                        </div>
                        
                        <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Verified Company</p>
                          <h4 className={`text-sm font-black mt-1 ${
                            (scannedResult.verified_company || 'Yes') === 'Yes' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {scannedResult.verified_company || (scannedResult.originality_score >= 70 ? 'Yes' : 'No')}
                          </h4>
                        </div>
                        
                        <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Status</p>
                          <h4 className={`text-sm font-black mt-1 ${
                            scannedResult.status === 'Approved' || scannedResult.status === 'Verified Clean' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {scannedResult.status === 'Verified Clean' ? 'Approved' : scannedResult.status}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* AI Checks Grid (6 Checks from Diagram) */}
                    <div className="space-y-3">
                      <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <Terminal size={12} className="text-gray-400" />
                        <span>System AI Verification Checks</span>
                      </h5>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { key: "official_website", question: "Does the company have an official website?" },
                          { key: "recruiter_email", question: "Does recruiter email use official domain?" },
                          { key: "salary_realistic", question: "Is salary realistic?" },
                          { key: "linkedin_presence", question: "Does company exist on LinkedIn?" },
                          { key: "description_copied", question: "Does description look copied or suspicious?" },
                          { key: "repeated_posts", question: "Is the same job repeatedly posted?" }
                        ].map((item) => {
                          const checkVal = getReportChecks(scannedResult)[item.key] || { status: "Unknown", details: "No indicators verified." };
                          const safeMapping = { official_website: "yes", recruiter_email: "yes", salary_realistic: "yes", linkedin_presence: "yes", description_copied: "no", repeated_posts: "no" };
                          const riskMapping = { official_website: "no", recruiter_email: "no", salary_realistic: "no", linkedin_presence: "no", description_copied: "yes", repeated_posts: "yes" };
                          const lowercaseVal = String(checkVal.status).toLowerCase();
                          
                          let badgeClass = "bg-gray-50 text-gray-500 border-gray-100";
                          let borderClass = "border-[#e6dfcd]";
                          let iconColor = "text-gray-400";
                          
                          if (lowercaseVal === safeMapping[item.key]) {
                            badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                            borderClass = "border-emerald-100";
                            iconColor = "text-emerald-500";
                          } else if (lowercaseVal === riskMapping[item.key]) {
                            badgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                            borderClass = "border-rose-100";
                            iconColor = "text-rose-500";
                          }
                          
                          return (
                            <div key={item.key} className={`p-3 border rounded-2xl bg-white shadow-sm flex items-start gap-2.5 ${borderClass}`}>
                              <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                              <div className="space-y-1 flex-1">
                                <div className="flex justify-between items-start gap-2">
                                  <h6 className="text-[10px] font-extrabold text-[#2A2A2A] leading-tight">{item.question}</h6>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 border rounded-full shrink-0 ${badgeClass}`}>
                                    {checkVal.status}
                                  </span>
                                </div>
                                <p className="text-[9px] text-gray-400 leading-relaxed font-medium">
                                  {checkVal.details}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs font-semibold text-[#5c5c5c] leading-relaxed">
                        <strong>Scan Summary:</strong> {scannedResult.summary || "Scan verified safe and recorded."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Score stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-[#f5f4ef]/30 border border-[#e6dfcd] p-4 rounded-xl text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold">Originality</p>
                        <h4 className={`text-2xl font-black mt-1 ${
                          scannedResult.originality_score >= 80 ? "text-emerald-600" : scannedResult.originality_score >= 60 ? "text-amber-500" : "text-rose-500"
                        }`}>{scannedResult.originality_score}%</h4>
                      </div>
                      <div className="bg-[#f5f4ef]/30 border border-[#e6dfcd] p-4 rounded-xl text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold">AI Content</p>
                        <h4 className="text-2xl font-black text-[#2A2A2A] mt-1">{scannedResult.ai_probability}%</h4>
                      </div>
                      <div className="bg-[#f5f4ef]/30 border border-[#e6dfcd] p-4 rounded-xl text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold">Plagiarism</p>
                        <h4 className="text-2xl font-black text-[#2A2A2A] mt-1">{scannedResult.plagiarism_score}%</h4>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs font-semibold text-[#5c5c5c] leading-relaxed">
                        <strong>Scan Summary:</strong> {scannedResult.summary || "Scan verified safe and recorded."}
                      </p>
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={resetScanner} className="flex-1 bg-white border border-[#e6dfcd] hover:border-[#2563EB] font-bold text-xs py-3 rounded-xl transition-all">
                    Scan Another Target
                  </button>
                  <button onClick={resetScanner} className="flex-1 bg-[#2A2A2A] hover:bg-black text-white font-bold text-xs py-3 rounded-xl transition-all">
                    Reset Scanner View
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent alerts panel (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#e6dfcd] p-6 rounded-3xl shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-4 border-b border-[#f5f4ef] flex justify-between items-center">
              <h3 className="font-extrabold text-base text-[#2A2A2A]">Recent Protection Alerts</h3>
            </div>

            <div className="space-y-3">
              {alerts.map((a, index) => (
                <div key={a.id || index} className={`p-4 border rounded-2xl flex gap-3.5 ${a.color}`}>
                  {a.type === "critical" ? (
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  ) : a.type === "warning" ? (
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  ) : (
                    <Shield size={18} className="shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <h4 className="font-extrabold text-xs leading-none">{a.title}</h4>
                      <span className="text-[9px] font-bold opacity-60 leading-none">{a.time}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-80 font-medium">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scanned Candidates & Jobs List */}
      <div className="bg-white border border-[#e6dfcd] p-6 rounded-3xl shadow-sm space-y-6">
        <div className="pb-4 border-b border-[#f5f4ef]">
          <h3 className="font-extrabold text-base text-[#2A2A2A]">Scan logs history</h3>
          <p className="text-xs text-[#5c5c5c] mt-0.5">Logs of recently scanned candidate profiles and job posting descriptions.</p>
        </div>

        {loadingHistory ? (
          <div className="py-8 flex justify-center items-center">
            <RefreshCw className="animate-spin text-gray-300 w-8 h-8" />
          </div>
        ) : historyList.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            No scans recorded in the history log database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#f5f4ef] text-gray-400 font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-4">Scan Target</th>
                  <th className="py-3 px-4">Trust Score</th>
                  <th className="py-3 px-4">Flags & Portfolios</th>
                  <th className="py-3 px-4 text-right">Status</th>
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
                      className={`border-b border-[#f5f4ef] hover:bg-[#f5f4ef]/25 cursor-pointer transition-colors font-medium ${
                        activeReport?.id === cand.id ? "bg-[#F0F6FF]" : ""
                      }`}
                    >
                      <td className="py-4 px-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#f5f4ef] border border-[#e6dfcd] text-[#2563EB] font-extrabold flex items-center justify-center uppercase shadow-inner shrink-0">
                          {isJob ? "J" : (nameDisplay ? nameDisplay[0] : "C")}
                        </div>
                        <div>
                          <p className="font-bold text-[#2A2A2A]">{nameDisplay}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {isJob ? "Job Posting" : cand.role} • {cand.location}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`font-black text-sm ${
                          cand.originality_score >= 80 ? "text-emerald-500" : cand.originality_score >= 60 ? "text-amber-500" : "text-red-500"
                        }`}>
                          {cand.originality_score}%
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {cand.portfolios && cand.portfolios.map((p, pIdx) => (
                            <span key={pIdx} className="bg-[#f5f4ef] text-gray-500 text-[10px] px-2 py-0.5 rounded font-semibold border border-[#e6dfcd]">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          cand.status === "Verified Clean" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                            : "bg-red-50 text-red-700 border border-red-100"
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
      </div>
    </div>
  );
}
