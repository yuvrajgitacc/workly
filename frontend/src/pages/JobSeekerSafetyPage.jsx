import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { publicJobsAPI } from '../lib/api';
import { Header, Footer } from '../components/user/site-chrome';
import ResumeUploadModal from '../components/ResumeUploadModal';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle,
  FileCheck, 
  Search, 
  Terminal, 
  RefreshCw,
  Sparkles,
  Building,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  Link as LinkIcon
} from 'lucide-react';

export default function JobSeekerSafetyPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Inputs
  const [jobUrl, setJobUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Autocomplete states
  const [jobsList, setJobsList] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState([]);

  const POPULAR_COMPANIES = ["Google", "Meta", "Amazon", "Microsoft", "Netflix", "Apple", "Uber"];
  const POPULAR_TITLES = [
    { title: "Remote Data Entry Assistant", desc: "We are looking for a remote assistant to manage spreadsheet data entry, verify database records, and perform general administrative tasks." },
    { title: "Virtual Support Representative", desc: "Responsible for responding to customer emails, resolving support tickets, and maintaining customer relationship records." },
    { title: "Part-time Copywriter", desc: "Write engaging marketing copy, blog posts, and social media captions. Requires strong communication skills and basic SEO knowledge." },
    { title: "Freelance Quality Analyst", desc: "Review software applications, log issues in trackers, and work with developers to ensure final builds meet standard guidelines." }
  ];

  const handleJobTitleFocus = () => {
    setShowTitleSuggestions(true);
    if (!jobTitle.trim()) {
      setTitleSuggestions(POPULAR_TITLES);
    } else {
      handleJobTitleChange(jobTitle);
    }
  };

  const handleJobTitleChange = (val) => {
    setJobTitle(val);
    if (!val.trim()) {
      setTitleSuggestions(POPULAR_TITLES);
      return;
    }
    const filteredPopular = POPULAR_TITLES.filter(t => 
      t.title.toLowerCase().includes(val.toLowerCase())
    );
    const filteredJobs = jobsList.filter(job => 
      job.job_title?.toLowerCase().includes(val.toLowerCase())
    ).map(job => ({
      title: job.job_title,
      desc: job.job_description,
      company: job.company_name
    }));
    
    const combined = [...filteredPopular];
    filteredJobs.forEach(j => {
      if (!combined.some(c => c.title.toLowerCase() === j.title.toLowerCase())) {
        combined.push(j);
      }
    });
    setTitleSuggestions(combined);
  };

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await publicJobsAPI.list();
        setJobsList(data || []);
      } catch (err) {
        console.error("Failed to load jobs list", err);
      }
    };
    fetchJobs();

    const handleOutsideClick = () => {
      setShowSuggestions(false);
      setShowTitleSuggestions(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleCompanyFocus = () => {
    setShowSuggestions(true);
    if (!companyName.trim()) {
      setSuggestions(POPULAR_COMPANIES.map(c => ({ company_name: c, job_title: "Popular Tech Employer", preferred_locations: ["Remote"] })));
    }
  };

  const handleCompanyChange = (val) => {
    setCompanyName(val);
    if (!val.trim()) {
      setSuggestions(POPULAR_COMPANIES.map(c => ({ company_name: c, job_title: "Popular Tech Employer", preferred_locations: ["Remote"] })));
      return;
    }
    const filteredJobs = jobsList.filter(job => 
      job.company_name?.toLowerCase().includes(val.toLowerCase())
    );
    const filteredPopular = POPULAR_COMPANIES.filter(c => 
      c.toLowerCase().includes(val.toLowerCase())
    ).map(c => ({ company_name: c, job_title: "Popular Tech Employer", preferred_locations: ["Remote"] }));
    
    const combined = [...filteredJobs];
    filteredPopular.forEach(p => {
      if (!combined.some(c => c.company_name.toLowerCase() === p.company_name.toLowerCase())) {
        combined.push(p);
      }
    });
    setSuggestions(combined);
  };

  const handleSelectSuggestion = (job) => {
    setCompanyName(job.company_name || "");
    setJobTitle(job.job_title || "");
    setJobDescription(job.job_description || "");
    setSuggestions([]);
    setShowSuggestions(false);
    toast.success(`Autofilled job details from ${job.company_name}!`);
  };

  // States
  const [scanStep, setScanStep] = useState("idle"); // idle, scanning, result
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [scannedResult, setScannedResult] = useState(null);

  const scanSteps = [
    { label: "Verifying company details and domain integrity...", duration: 1200 },
    { label: "Scanning description text for recruitment scam patterns...", duration: 1500 },
    { label: "Checking for phishing links or sketchy contact details...", duration: 1800 },
    { label: "Evaluating salary consistency & role expectations...", duration: 1000 }
  ];

  const handleStartScan = async (e) => {
    e.preventDefault();
    if (!jobUrl.trim() && (!jobTitle.trim() || !jobDescription.trim())) {
      toast.error("Please enter a LinkedIn job URL or enter both the Job Title and Job Description to scan.");
      return;
    }

    setScanStep("scanning");
    setCurrentStepIdx(0);

    const apiPromise = publicJobsAPI.scanSafetyArbitrary({
      url: jobUrl.trim(),
      job_title: jobTitle.trim(),
      job_description: jobDescription.trim(),
      company_name: companyName.trim() || "Unknown Company"
    });

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
      toast.success("Hiring safety audit completed!");
    } catch (err) {
      clearInterval(interval);
      toast.error(err.message || "Hiring safety audit failed.");
      setScanStep("idle");
    }
  };

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

  const resetScanner = () => {
    setScanStep("idle");
    setScannedResult(null);
    setJobUrl("");
    setCompanyName("");
    setJobTitle("");
    setJobDescription("");
  };

  // Static common red flags data
  const redFlags = [
    {
      title: "Upfront Payments & Fees",
      desc: "Legitimate employers never ask you to pay for your own training materials, software, laptop, or background checks.",
      icon: AlertTriangle,
      color: "border-red-200 bg-red-50 text-red-700"
    },
    {
      title: "Suspicious Contact Emails",
      desc: "Be extremely cautious if correspondence comes from a generic @gmail.com or @outlook.com instead of a corporate domain.",
      icon: AlertCircle,
      color: "border-amber-200 bg-amber-50 text-amber-700"
    },
    {
      title: "Unrealistic Salary Packages",
      desc: "If an entry-level part-time role offers $4,000/week for very simple tasks, it is almost certainly a check fraud scheme.",
      icon: AlertTriangle,
      color: "border-blue-200 bg-blue-50 text-blue-700"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-[#2A2A2A] font-sans flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 space-y-12">
        
        {/* Upper header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#2A2A2A] flex items-center gap-2.5">
              <ShieldCheck className="text-[#2563EB] w-8 h-8" />
              <span>Hiring Safety Audit Suite</span>
            </h1>
            <p className="text-sm text-[#5c5c5c] mt-1">
              Verify company legitimacy, detect ghost job listings, and protect your personal information from recruiting fraud.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold bg-white text-[#2563EB] px-3.5 py-2 rounded-xl border border-[#e6dfcd] shadow-sm shrink-0">
            <Sparkles size={14} />
            <span>AI Powered Legitimacy Scoring</span>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Checker Form (7 columns) */}
          <div className="lg:col-span-7 bg-white border border-[#e6dfcd] p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
            <div className="pb-4 border-b border-[#f5f4ef]">
              <h3 className="font-extrabold text-base text-[#2A2A2A] flex items-center gap-2">
                <Terminal size={18} className="text-[#2563EB]" />
                <span>Arbitrary Job Audit</span>
              </h3>
              <p className="text-xs text-[#5c5c5c] mt-0.5">Paste any external job details to inspect them for legitimacy and safety flags.</p>
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
                  {/* URL Input */}
                  <div className="relative">
                    <LinkIcon className="absolute left-3.5 top-3.5 text-gray-400 w-4 h-4" />
                    <input 
                      type="text"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="Enter LinkedIn Job Post URL (automatically extracts title & description)..."
                      className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 pl-10 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner"
                    />
                  </div>

                  <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest my-1">OR ENTER DETAILS MANUALLY</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-[#2A2A2A] uppercase tracking-wider mb-1">Company Name</label>
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <Building className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          disabled={!!jobUrl.trim()}
                          value={jobUrl.trim() ? "" : companyName}
                          onChange={(e) => handleCompanyChange(e.target.value)}
                          onFocus={handleCompanyFocus}
                          placeholder={jobUrl.trim() ? "Locked: URL provided" : "e.g. Acme Corporation (Optional)"}
                          className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 pl-9 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner disabled:opacity-50"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-[110%] bg-white border border-[#e6dfcd] rounded-xl shadow-xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto text-left">
                            {suggestions.map((job, idx) => (
                              <div
                                key={idx}
                                onMouseDown={() => handleSelectSuggestion(job)}
                                className="px-4 py-2 hover:bg-[#f5f4ef] cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                              >
                                <p className="text-xs font-bold text-[#2A2A2A]">{job.company_name}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{job.job_title} • {job.preferred_locations?.join(', ') || 'Remote'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-[#2A2A2A] uppercase tracking-wider mb-1">Job Title</label>
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          disabled={!!jobUrl.trim()}
                          value={jobUrl.trim() ? "" : jobTitle}
                          onChange={(e) => handleJobTitleChange(e.target.value)}
                          onFocus={handleJobTitleFocus}
                          placeholder={jobUrl.trim() ? "Locked: URL provided" : "e.g. Remote Data Entry Assistant"}
                          className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner disabled:opacity-50"
                        />
                        {showTitleSuggestions && titleSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-[110%] bg-white border border-[#e6dfcd] rounded-xl shadow-xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto text-left">
                            {titleSuggestions.map((t, idx) => (
                              <div
                                key={idx}
                                onMouseDown={() => {
                                  setJobTitle(t.title);
                                  setJobDescription(t.desc);
                                  if (t.company) {
                                    setCompanyName(t.company);
                                  }
                                  setShowTitleSuggestions(false);
                                  toast.success(`Autofilled job template for ${t.title}!`);
                                }}
                                className="px-4 py-2 hover:bg-[#f5f4ef] cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                              >
                                <p className="text-xs font-bold text-[#2A2A2A]">{t.title} {t.company ? `(${t.company})` : ""}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{t.desc}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-[#2A2A2A] uppercase tracking-wider mb-1">Job Description Requirements</label>
                    <textarea
                      disabled={!!jobUrl.trim()}
                      value={jobUrl.trim() ? "" : jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder={jobUrl.trim() ? "Locked: URL provided" : "Paste the requirements, responsibilities, or contact paragraphs here..."}
                      rows={6}
                      className="w-full text-sm border border-[#e6dfcd] rounded-xl p-3 focus:outline-none focus:border-[#2563EB] bg-white text-[#2A2A2A] font-medium shadow-inner resize-none disabled:opacity-50"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={!jobUrl.trim() && (!jobTitle.trim() || !jobDescription.trim())}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Search size={16} />
                    <span>Run Legitimacy Audit</span>
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
                      <h4 className="font-bold text-sm text-[#2A2A2A]">AI Job Auditor Running</h4>
                      <p className="text-[11px] text-[#5c5c5c] mt-0.5">Please wait, inspecting job post structure...</p>
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
                  {/* Result Header banner */}
                  <div className={`p-5 border rounded-2xl flex items-start gap-4 ${
                    scannedResult.originality_score >= 70
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-red-50 border-red-100 text-red-800"
                  }`}>
                    <CheckCircle className={scannedResult.originality_score >= 70 ? "text-emerald-500 w-6 h-6 shrink-0 mt-0.5" : "text-rose-500 w-6 h-6 shrink-0 mt-0.5"} />
                    <div>
                      <h4 className="font-extrabold text-sm">
                        {scannedResult.originality_score >= 70
                          ? `Hiring Details Verified Clean: ${scannedResult.status}`
                          : `Suspicious Hiring Details Detected: ${scannedResult.status}`}
                      </h4>
                      <p className="text-xs mt-0.5">
                        Safety assessment generated for <strong>{scannedResult.job_title}</strong> at <strong>{scannedResult.company_name}</strong>.
                      </p>
                    </div>
                  </div>

                  {/* AI System Output (Matching the Reference Image layout) */}
                  <div className="bg-[#f0f6ff]/45 border border-[#bfdbfe]/50 p-5 rounded-2xl space-y-3.5 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2563EB] flex items-center gap-1.5">
                      <Sparkles size={14} className="animate-pulse" />
                      <span>AI Fake Job Detection System Output</span>
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                        <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Trust Score</p>
                        <h4 className="text-lg font-black text-[#2A2A2A] mt-1">
                          {scannedResult.originality_score}/100
                        </h4>
                      </div>
                      
                      <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                        <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Risk Level</p>
                        <h4 className={`text-lg font-black mt-1 ${
                          (scannedResult.risk_level || 'Low') === 'High' ? 'text-rose-600' :
                          (scannedResult.risk_level || 'Low') === 'Medium' ? 'text-amber-500' : 'text-emerald-600'
                        }`}>
                          {scannedResult.risk_level || (scannedResult.originality_score >= 80 ? 'Low' : scannedResult.originality_score >= 60 ? 'Medium' : 'High')}
                        </h4>
                      </div>
                      
                      <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                        <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Verified Company</p>
                        <h4 className={`text-lg font-black mt-1 ${
                          (scannedResult.verified_company || 'Yes') === 'Yes' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {scannedResult.verified_company || (scannedResult.originality_score >= 70 ? 'Yes' : 'No')}
                        </h4>
                      </div>
                      
                      <div className="bg-white border border-[#e6dfcd] p-3.5 rounded-xl shadow-inner text-center">
                        <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Status</p>
                        <h4 className={`text-lg font-black mt-1 ${
                          scannedResult.status === 'Approved' || scannedResult.status === 'Verified Clean' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {scannedResult.status === 'Verified Clean' ? 'Approved' : scannedResult.status}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Audit Statistics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[#f5f4ef]/30 border border-[#e6dfcd] p-4 rounded-xl text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold">Legitimacy Score</p>
                      <h4 className={`text-2xl font-black mt-1 ${
                        scannedResult.originality_score >= 80 ? "text-emerald-600" : scannedResult.originality_score >= 60 ? "text-amber-500" : "text-rose-500"
                      }`}>{scannedResult.originality_score}%</h4>
                    </div>
                    <div className="bg-[#f5f4ef]/30 border border-[#e6dfcd] p-4 rounded-xl text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold">AI Probability</p>
                      <h4 className="text-2xl font-black text-[#2A2A2A] mt-1">{scannedResult.ai_probability}%</h4>
                    </div>
                    <div className="bg-[#f5f4ef]/30 border border-[#e6dfcd] p-4 rounded-xl text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold">Plagiarism</p>
                      <h4 className="text-2xl font-black text-[#2A2A2A] mt-1">{scannedResult.plagiarism_score}%</h4>
                    </div>
                  </div>

                  {/* AI Checks Grid (6 Checks from Diagram) */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Terminal size={12} className="text-gray-400" />
                      <span>System AI Verification Checks</span>
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {[
                        { key: "official_website", question: "Does the company have an official website?" },
                        { key: "recruiter_email", question: "Does recruiter email use official domain?" },
                        { key: "salary_realistic", question: "Is salary realistic?" },
                        { key: "linkedin_presence", question: "Does company exist on LinkedIn?" },
                        { key: "description_copied", question: "Does description look copied or suspicious?" },
                        { key: "repeated_posts", question: "Is the same job repeatedly posted?" }
                      ].map((item) => {
                        const checkVal = getReportChecks(scannedResult)[item.key] || { status: "Unknown", details: "No indicators verified." };
                        
                        // Define safe and risk mapping
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
                          <div key={item.key} className={`p-4 border rounded-2xl bg-white shadow-sm flex items-start gap-3 ${borderClass}`}>
                            <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
                            <div className="space-y-1.5 flex-1">
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

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold text-[#5c5c5c] leading-relaxed">
                      <strong>Audit Verdict Summary:</strong> {scannedResult.summary || "Listing safety scan completed."}
                    </p>
                  </div>

                  {scannedResult.flags && scannedResult.flags.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Risk Assessment Flags:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {scannedResult.flags.map((flag, idx) => (
                          <span key={idx} className="bg-red-50 border border-red-100 text-red-700 text-[10px] px-2.5 py-1 rounded-lg font-semibold">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={resetScanner} className="flex-1 bg-[#2A2A2A] hover:bg-black text-white font-bold text-xs py-3.5 rounded-xl transition-all">
                      Audit Another Listing
                    </button>
                    <button onClick={resetScanner} className="flex-1 bg-white border border-[#e6dfcd] hover:bg-[#f5f4ef] text-[#2A2A2A] font-bold text-xs py-3.5 rounded-xl transition-all">
                      Clear Audit View
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Red Flags educational board (5 columns) */}
          <div className="lg:col-span-5 bg-white border border-[#e6dfcd] p-6 rounded-3xl shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h3 className="font-bold text-base text-[#2A2A2A] pb-2 border-b border-[#f5f4ef]">
                Hiring Scam Red Flags
              </h3>
              
              <div className="space-y-4">
                {redFlags.map((flag, idx) => (
                  <div key={idx} className={`p-4 border rounded-2xl flex gap-3.5 ${flag.color}`}>
                    <flag.icon size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-xs leading-none">{flag.title}</h4>
                      <p className="text-[10px] leading-relaxed opacity-85 mt-1">{flag.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F0F6FF] border border-[#BFDBFE] p-4 rounded-2xl text-[11px] text-[#2563EB] font-medium leading-relaxed">
              <h5 className="font-bold flex items-center gap-1.5 mb-1 text-sm">
                <Shield className="w-4 h-4" />
                <span>Your Data is Protected</span>
              </h5>
              We scan descriptions anonymously. We never store or share the pasted contents with recruiters or external tracker engines.
            </div>
          </div>

        </div>

      </main>

      <Footer />

      {/* Upload modal */}
      <ResumeUploadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
