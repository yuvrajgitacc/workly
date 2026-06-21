import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Play, Copy } from "lucide-react";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { portalKeys } from "../../lib/portalApi";

const SECTIONS = [
  { id: "getting-started", title: "Getting Started" },
  { id: "authentication", title: "Authentication" },
  { id: "sessions", title: "Sessions" },
  { id: "resume-ingestion", title: "Resume Ingestion", 
    sub: [
       { id: "file-upload", title: "File Upload" },
       { id: "gmail-sync", title: "Gmail Sync" },
       { id: "google-drive", title: "Google Drive" },
       { id: "ats-import", title: "ATS Import" },
     ]
  },
  { id: "candidates", title: "Candidates" },
  { id: "job-matching", title: "Job Matching" },
  { id: "ai-chatbot", title: "AI Chatbot" },
  { id: "fraud-detection", title: "Fraud Detection" },
  { id: "webhooks", title: "Webhooks" },
  { id: "rate-limits", title: "Rate Limits & Errors" },
  { id: "sdks", title: "SDKs & Examples" }
];

export default function DeveloperDocs() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [pgEndpoint, setPgEndpoint] = useState(null);

  const [apiKey, setApiKey] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [scanType, setScanType] = useState("user");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseJson, setResponseJson] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // New playground fields
  const [requestBodyJson, setRequestBodyJson] = useState("");
  const [candidateIdParam, setCandidateIdParam] = useState("cnd_12345");

  const { data: keysData } = useQuery({
    queryKey: ["portal-keys"],
    queryFn: portalKeys.list,
    enabled: playgroundOpen,
  });

  useEffect(() => {
    if (keysData) {
      const allKeys = [
        ...(keysData.production_keys || []),
        ...(keysData.test_keys || [])
      ];
      const activeKey = allKeys.find(k => k.is_active);
      if (activeKey) {
        setApiKey(activeKey.secret_key || activeKey.secret_key_masked || "");
      }
    }
  }, [keysData]);

  useEffect(() => {
    const allIds = [
      "getting-started","authentication","sessions",
      "resume-ingestion","file-upload","gmail-sync","google-drive","ats-import",
      "candidates","job-matching","ai-chatbot","fraud-detection",
      "webhooks","rate-limits","sdks"
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openPlayground = (endpoint) => {
     setPgEndpoint(endpoint);
     setPlaygroundOpen(true);
     setResponseJson(null);
     setErrorMsg(null);
     setSelectedFile(null);
     setPortfolioUrl("");
     setJobTitle("");
     setJobDescription("");
     setCandidateIdParam("cnd_12345");

     // Pre-populate default bodies based on endpoint
     if (endpoint.path === "/api/v1/sessions" && endpoint.method === "POST") {
       setRequestBodyJson(JSON.stringify({ 
         name: "Q3 Engineering Hire", 
         job_title: "Software Engineer", 
         job_description: "We are looking for a software engineer proficient in Python and React." 
       }, null, 2));
     } else if (endpoint.path === "/api/v1/ingest/gmail") {
       setRequestBodyJson(JSON.stringify({ oauth_token: "ya29.xxx", label: "HR/Resumes" }, null, 2));
     } else if (endpoint.path === "/api/v1/ingest/drive") {
       setRequestBodyJson(JSON.stringify({ oauth_token: "ya29.xxx", folder_id: "1BxiMVs0XRA...", recursive: true }, null, 2));
     } else if (endpoint.path === "/api/v1/ingest/ats") {
       setRequestBodyJson(JSON.stringify({ platform: "greenhouse", job_id: "7291028" }, null, 2));
     } else if (endpoint.path === "/api/v1/match") {
       setRequestBodyJson(JSON.stringify({ job_title: "Senior React Developer", job_description: "5+ years React, TypeScript...", top_k: 5 }, null, 2));
     } else if (endpoint.path === "/api/v1/chat") {
       setRequestBodyJson(JSON.stringify({ message: "Find React devs with 3+ years experience", session_id: "" }, null, 2));
     } else if (endpoint.path === "/api/v1/protection/scan") {
       setPortfolioUrl("https://github.com/torvalds");
       setJobTitle("Senior Linux Kernel Developer");
       setJobDescription("We are looking for an expert C developer with deep Linux kernel experience.");
       setRequestBodyJson("{}");
     } else {
       setRequestBodyJson("{}");
     }
  };

  const sendPlaygroundRequest = async () => {
    if (!apiKey) {
      toast.error("API Key is required");
      return;
    }

    setLoading(true);
    setResponseJson(null);
    setErrorMsg(null);

    try {
      const rawBase = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) || "http://127.0.0.1:8000/api/v1";
      const domain = rawBase.replace("/api/v1", "");
      
      let path = pgEndpoint?.path || "";
      if (path.includes("/:id")) {
        path = path.replace("/:id", `/${candidateIdParam}`);
      }
      const url = domain + path;

      const headers = {
        "X-API-Key": apiKey
      };

      const portalJwt = localStorage.getItem("portal_jwt");
      if (portalJwt && portalJwt !== "undefined") {
        headers["Authorization"] = `Bearer ${portalJwt}`;
      }

      let body;
      if (pgEndpoint?.path === "/api/v1/parse") {
        if (!selectedFile) {
          throw new Error("Please select a resume file to parse.");
        }
        body = new FormData();
        body.append("file", selectedFile);
      } else if (pgEndpoint?.path === "/api/v1/protection/scan") {
        body = new FormData();
        body.append("scan_type", scanType);
        if (scanType === "user") {
          if (selectedFile) {
            body.append("file", selectedFile);
          }
          if (portfolioUrl) {
            body.append("url", portfolioUrl);
          }
          if (!selectedFile && !portfolioUrl) {
            throw new Error("Please upload a resume file or enter a portfolio URL to scan.");
          }
        } else {
          if (!jobTitle || !jobDescription) {
            throw new Error("Job title and description are required for job scanning.");
          }
          body.append("job_title", jobTitle);
          body.append("job_description", jobDescription);
        }
      } else if (pgEndpoint?.method === "POST" && requestBodyJson) {
        headers["Content-Type"] = "application/json";
        try {
          body = JSON.stringify(JSON.parse(requestBodyJson));
        } catch (e) {
          throw new Error("Invalid request JSON body format.");
        }
      }

      const res = await fetch(url, {
        method: pgEndpoint?.method || "GET",
        headers,
        body
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `HTTP ${res.status} Error`);
      }

      setResponseJson(data);
      toast.success("Request executed successfully!");
    } catch (err) {
      setErrorMsg(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex">
      {/* LEFT NAV */}
      <nav className="hidden lg:block w-64 shrink-0 pr-8 sticky top-8 max-h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
         <h2 className="text-xl font-black text-charcoal mb-6">Documentation</h2>
         <ul className="flex flex-col gap-1.5 text-sm font-semibold">
           {SECTIONS.map(sec => (
             <li key={sec.id}>
               <button 
                 onClick={() => scrollTo(sec.id)} 
                 className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === sec.id ? "bg-accent/10 text-accent" : "text-gray-500 hover:text-charcoal hover:bg-gray-100"}`}
               >
                 {sec.title}
               </button>
               {sec.sub && (
                 <ul className="flex flex-col gap-1 mt-1 mb-2 ml-4 border-l-2 border-gray-100 pl-2">
                   {sec.sub.map(subSec => (
                     <li key={subSec.id}>
                        <button 
                          onClick={() => scrollTo(subSec.id)} 
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${activeSection === subSec.id ? "text-accent font-bold" : "text-gray-400 hover:text-charcoal"}`}
                        >
                          {subSec.title}
                        </button>
                     </li>
                   ))}
                 </ul>
               )}
             </li>
           ))}
         </ul>
      </nav>

      {/* RIGHT CONTENT */}
      <main className="flex-1 pb-32 max-w-4xl min-w-0 px-2 lg:px-8">
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.15}}>
          
          <section id="getting-started" className="mb-16 pt-8">
            <h1 className="text-4xl font-black text-charcoal mb-4">Getting Started</h1>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Welcome to the Vishleshan Developer API. Our REST API allows you to programmatically ingest resumes, match candidate skills to job descriptions, interact with our AI-powered candidate querying chatbot, and stream structural entity extraction securely into your HR infrastructure.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
              <h3 className="font-bold text-charcoal mb-4">Quick Start</h3>
              <ol className="flex flex-col gap-4 text-sm font-medium text-gray-600 list-decimal pl-4 marker:text-gray-400 marker:font-black">
                 <li><strong className="text-charcoal">Generate an API Key</strong> from the Keys dashboard.</li>
                 <li><strong className="text-charcoal">Send your first request</strong> attaching the <code className="bg-white border border-gray-200 rounded px-1.5">X-API-Key</code> header.</li>
                 <li><strong className="text-charcoal">Listen for Webhooks</strong> to be notified asynchronously when parsing completes.</li>
              </ol>
            </div>
          </section>

          <section id="authentication" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Authentication</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              All API endpoints are authenticated using specific secret keys. Pass your key through the <code className="bg-gray-100 text-charcoal rounded px-1">X-API-Key</code> HTTP header.
            </p>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 mb-6 text-sm font-semibold text-amber-800">
               Test keys have the prefix <code>vish_test_</code> and do not incur billing charges, but are tightly rate-limited. Production keys use <code>vish_live_</code>.
            </div>
            <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "13px" }}>
{`curl -X GET "https://api.vishleshan.ai/api/v1/sessions" \\
  -H "X-API-Key: vish_live_xxxxxxxx"`}
            </SyntaxHighlighter>
          </section>

          
          <section id="sessions" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Sessions</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Sessions represent a scoped workspace for a hiring pipeline. Create a session to group resume ingestion, candidate matching, and chat operations together.
            </p>
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-green-100 text-green-700 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">GET</span>
               <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/sessions</h3>
               <button onClick={() => openPlayground({method:'GET', path:'/api/v1/sessions'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
            </div>
            <p className="text-gray-600 font-medium text-sm mb-4">List all active sessions for your account.</p>
            <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", marginBottom: "24px" }}>
{`curl -X GET "https://api.vishleshan.ai/api/v1/sessions" \
  -H "X-API-Key: YOUR_KEY"`}
            </SyntaxHighlighter>
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
               <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/sessions</h3>
               <button onClick={() => openPlayground({method:'POST', path:'/api/v1/sessions'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
            </div>
            <p className="text-gray-600 font-medium text-sm mb-4">Create a new session for grouping candidate operations.</p>
            <div className="grid md:grid-cols-2 gap-4">
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Request</span>
                 <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/sessions" \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Q3 Engineering Hire"}'`}
                 </SyntaxHighlighter>
               </div>
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Response</span>
                 <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`{
  "success": true,
  "data": {
    "session_id": "ses_abc123",
    "name": "Q3 Engineering Hire",
    "created_at": "2024-06-01T10:00:00Z"
  }
}`}
                 </SyntaxHighlighter>
               </div>
            </div>
          </section>
<section id="resume-ingestion" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Resume Ingestion</h2>
            
            <div id="file-upload" className="mb-12 pt-4">
              <div className="flex items-center gap-3 mb-4">
                 <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
                 <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/parse</h3>
                 <button onClick={() => openPlayground({method:'POST', path:'/api/v1/parse'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
              </div>
              <p className="text-gray-600 font-medium text-sm mb-6">Extracts structured data from a raw resume file synchronously.</p>
              
              <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">Parameters</h4>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b-2 border-gray-100 text-charcoal font-bold bg-gray-50">
                      <th className="p-3 rounded-tl-xl">Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Required</th>
                      <th className="p-3 w-full rounded-tr-xl">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-500 font-medium">
                    <tr className="border-b border-gray-50">
                      <td className="p-3 font-mono text-charcoal">file</td>
                      <td className="p-3 text-blue-500">binary</td>
                      <td className="p-3 text-red-500 font-bold">Yes</td>
                      <td className="p-3">The resume file. Supported: pdf, docx, txt.</td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="p-3 font-mono text-charcoal">webhook_url</td>
                      <td className="p-3 text-blue-500">string</td>
                      <td className="p-3 text-gray-400">No</td>
                      <td className="p-3">URL to receive "resume.parsed" event.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                 <div className="flex flex-col">
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Request</span>
                   <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", flex: 1, margin: 0 }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/parse" \\
  -H "X-API-Key: YOUR_KEY" \\
  -F "file=@resume.pdf"`}
                   </SyntaxHighlighter>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Response</span>
                   <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", flex: 1, margin: 0 }}>
{`{
  "success": true,
  "data": {
    "candidate_id": "cnd_12345",
    "status": "processing",
    "name": "Jane Doe",
    "skills": ["Python", "React"]
  }
}`}
                   </SyntaxHighlighter>
                 </div>
              </div>
            </div>
          </section>

          
            <div id="gmail-sync" className="mb-12 pt-4 border-t border-dashed border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                 <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
                 <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/ingest/gmail</h3>
                 <button onClick={() => openPlayground({method:'POST', path:'/api/v1/ingest/gmail'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
              </div>
              <p className="text-gray-600 font-medium text-sm mb-4">Sync resumes directly from a Gmail inbox using OAuth credentials.</p>
              <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/ingest/gmail" \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"oauth_token": "ya29.xxx", "label": "HR/Resumes"}'`}
              </SyntaxHighlighter>
            </div>

            <div id="google-drive" className="mb-12 pt-4 border-t border-dashed border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                 <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
                 <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/ingest/drive</h3>
                 <button onClick={() => openPlayground({method:'POST', path:'/api/v1/ingest/drive'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
              </div>
              <p className="text-gray-600 font-medium text-sm mb-4">Ingest resumes from a Google Drive folder. Supports recursive folder scanning and deduplication.</p>
              <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/ingest/drive" \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"oauth_token": "ya29.xxx", "folder_id": "1BxiMVs0XRA...", "recursive": true}'`}
              </SyntaxHighlighter>
            </div>

            <div id="ats-import" className="mb-4 pt-4 border-t border-dashed border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                 <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
                 <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/ingest/ats</h3>
                 <button onClick={() => openPlayground({method:'POST', path:'/api/v1/ingest/ats'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
              </div>
              <p className="text-gray-600 font-medium text-sm mb-4">Import candidates from ATS platforms (Greenhouse, Lever, Workday). Requires ATS credentials configured in developer portal settings.</p>
              <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/ingest/ats" \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"platform": "greenhouse", "job_id": "7291028"}'`}
              </SyntaxHighlighter>
            </div>

          <section id="candidates" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Candidates</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Retrieve and manage parsed candidate profiles. Each candidate is identified by a <code className="bg-gray-100 rounded px-1">candidate_id</code> returned at ingestion.
            </p>
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-green-100 text-green-700 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">GET</span>
               <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/candidates</h3>
               <button onClick={() => openPlayground({method:'GET', path:'/api/v1/candidates'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
            </div>
            <p className="text-gray-600 font-medium text-sm mb-4">List all parsed candidates. Supports filtering and pagination.</p>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Request</span>
                 <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl "https://api.vishleshan.ai/api/v1/candidates?page=1&limit=20" \
  -H "X-API-Key: YOUR_KEY"`}
                 </SyntaxHighlighter>
               </div>
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Response</span>
                 <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`{
  "success": true,
  "data": {
    "candidates": [
      {"candidate_id": "cnd_12345", "name": "Jane Doe",
       "skills": ["Python","React"], "experience_years": 4}
    ],
    "total": 142, "page": 1
  }
}`}
                 </SyntaxHighlighter>
               </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-green-100 text-green-700 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">GET</span>
               <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/candidates/:id</h3>
               <button onClick={() => openPlayground({method:'GET', path:'/api/v1/candidates/:id'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
            </div>
            <p className="text-gray-600 font-medium text-sm mb-4">Retrieve a single candidate's full structured profile.</p>
            <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl "https://api.vishleshan.ai/api/v1/candidates/cnd_12345" \
  -H "X-API-Key: YOUR_KEY"`}
            </SyntaxHighlighter>
          </section>

          <section id="job-matching" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Job Matching</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Use our AI matching engine to rank candidates by relevance to a job description. Returns a scored list ordered by match confidence.
            </p>
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
               <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/match</h3>
               <button onClick={() => openPlayground({method:'POST', path:'/api/v1/match'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Request</span>
                 <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/match" \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Senior React Developer",
    "job_description": "5+ years React, TypeScript...",
    "top_k": 5
  }'`}
                 </SyntaxHighlighter>
               </div>
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Response</span>
                 <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`{
  "success": true,
  "data": {
    "matches": [
      {
        "candidate_id": "cnd_12345",
        "name": "Jane Doe",
        "match_score": 94.2,
        "matched_skills": ["React","TypeScript"]
      }
    ]
  }
}`}
                 </SyntaxHighlighter>
               </div>
            </div>
          </section>

          <section id="ai-chatbot" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">AI Chatbot</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Query your candidate pool conversationally. Ask natural-language questions and receive structured, AI-curated responses.
            </p>
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
               <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/chat</h3>
               <button onClick={() => openPlayground({method:'POST', path:'/api/v1/chat'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Request</span>
                 <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/chat" \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find React devs with 3+ years experience",
    "session_id": "ses_abc123"
  }'`}
                 </SyntaxHighlighter>
               </div>
               <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 block">Response</span>
                 <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`{
  "success": true,
  "data": {
    "answer": "Found 3 matching candidates.",
    "candidates": [
      {"candidate_id": "cnd_12345", "name": "Jane Doe"}
    ],
    "tokens_used": 180
  }
}`}
                 </SyntaxHighlighter>
               </div>
            </div>
          </section>
<section id="fraud-detection" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Fraud Detection</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Scan candidate portfolios/resumes or job descriptions for plagiarism, AI-generated content probability, and structural manipulations. Available only on Starter, Business, and Enterprise tiers.
            </p>
            
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-blue-100 text-amber-600 font-black text-[10px] px-2 py-1 uppercase tracking-widest rounded">POST</span>
               <h3 className="font-mono text-lg font-bold text-gray-800">/api/v1/protection/scan</h3>
               <button onClick={() => openPlayground({method:'POST', path:'/api/v1/protection/scan'})} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors shadow-sm"><Play size={12}/> Try It</button>
            </div>
            
            <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">Parameters</h4>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-charcoal font-bold bg-gray-50">
                    <th className="p-3 rounded-tl-xl">Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Required</th>
                    <th className="p-3 w-full rounded-tr-xl">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-500 font-medium">
                  <tr className="border-b border-gray-50">
                    <td className="p-3 font-mono text-charcoal">scan_type</td>
                    <td className="p-3 text-blue-500">string</td>
                    <td className="p-3 text-gray-400">No</td>
                    <td className="p-3">Type of target to scan. Options: <code>user</code> (default) or <code>job</code>.</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="p-3 font-mono text-charcoal">file</td>
                    <td className="p-3 text-blue-500">binary</td>
                    <td className="p-3 text-gray-400">No</td>
                    <td className="p-3">The candidate resume file (for <code>user</code> type).</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="p-3 font-mono text-charcoal">url</td>
                    <td className="p-3 text-blue-500">string</td>
                    <td className="p-3 text-gray-400">No</td>
                    <td className="p-3">A Github repository or portfolio URL (for <code>user</code> type).</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="p-3 font-mono text-charcoal">job_title</td>
                    <td className="p-3 text-blue-500">string</td>
                    <td className="p-3 text-gray-400">No</td>
                    <td className="p-3">The job title (required if <code>scan_type</code> is <code>job</code>).</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="p-3 font-mono text-charcoal">job_description</td>
                    <td className="p-3 text-blue-500">string</td>
                    <td className="p-3 text-gray-400">No</td>
                    <td className="p-3">The job description body text (required if <code>scan_type</code> is <code>job</code>).</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
               <div className="flex flex-col">
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Request Example</span>
                 <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", flex: 1, margin: 0 }}>
{`curl -X POST "https://api.vishleshan.ai/api/v1/protection/scan" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{
    "scan_type": "job",
    "job_title": "Frontend Lead",
    "job_description": "We are seeking a React developer..."
  }'`}
                 </SyntaxHighlighter>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Response Example</span>
                 <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", flex: 1, margin: 0 }}>
{`{
  "success": true,
  "data": {
    "originality_score": 94,
    "ai_probability": 6,
    "plagiarism_score": 5,
    "status": "Verified Clean",
    "portfolios": ["React Project Showcase"],
    "summary": "Document is original with low AI probability."
  }
}`}
                 </SyntaxHighlighter>
               </div>
            </div>
          </section>

          
          <section id="webhooks" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Webhooks</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Vishleshan sends webhook events to notify your application when async tasks complete. Register your endpoint URL in the developer portal or pass <code className="bg-gray-100 rounded px-1">webhook_url</code> inline with any request.
            </p>
            <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">Event Types</h4>
            <div className="overflow-x-auto mb-6 border border-gray-200 rounded-xl">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-charcoal font-bold">
                    <th className="p-3">Event</th>
                    <th className="p-3 w-full">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-500 font-medium">
                  <tr className="border-b border-gray-50"><td className="p-3 font-mono text-charcoal">resume.parsed</td><td className="p-3">A resume has been fully parsed and structured data is ready.</td></tr>
                  <tr className="border-b border-gray-50"><td className="p-3 font-mono text-charcoal">resume.failed</td><td className="p-3">Resume parsing failed. Includes error details.</td></tr>
                  <tr className="border-b border-gray-50"><td className="p-3 font-mono text-charcoal">scan.completed</td><td className="p-3">A fraud/safety scan has completed with results.</td></tr>
                  <tr className="border-b border-gray-50"><td className="p-3 font-mono text-charcoal">ingest.batch_done</td><td className="p-3">All files in a batch ingestion have been processed.</td></tr>
                </tbody>
              </table>
            </div>
            <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">Webhook Payload</h4>
            <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", marginBottom: "16px" }}>
{`{
  "event": "resume.parsed",
  "timestamp": "2024-06-01T12:00:00Z",
  "data": {
    "candidate_id": "cnd_12345",
    "name": "Jane Doe",
    "skills": ["Python", "React"],
    "status": "completed"
  },
  "signature": "sha256=abc123..."
}`}
            </SyntaxHighlighter>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 font-semibold">
              <strong>Signature Verification:</strong> Each webhook includes a <code>X-Vishleshan-Signature</code> header. Verify it using your webhook secret to ensure authenticity.
            </div>
          </section>
<section id="rate-limits" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">Rate Limits & Errors</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Vishleshan uses standard HTTP response codes to indicate the success or failure of an API request.
            </p>
            
            <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">Plan Quotas</h4>
            <div className="overflow-x-auto mb-8 border border-gray-200 rounded-xl">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-charcoal font-bold">
                    <th className="p-3">Tier</th>
                    <th className="p-3">Parses/mo</th>
                    <th className="p-3">Match Ops/mo</th>
                    <th className="p-3">Chat Queries/mo</th>
                    <th className="p-3">Safety Scans/mo</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 font-medium">
                  <tr className="border-b border-gray-50"><td className="p-3 font-bold text-charcoal">Free</td><td className="p-3">100</td><td className="p-3">500</td><td className="p-3">100</td><td className="p-3">0</td></tr>
                  <tr className="border-b border-gray-50"><td className="p-3 font-bold text-accent">Starter</td><td className="p-3">1,000</td><td className="p-3">10,000</td><td className="p-3">2,000</td><td className="p-3">100</td></tr>
                  <tr className="border-b border-gray-0"><td className="p-3 font-bold text-blue-600">Business</td><td className="p-3">10,000</td><td className="p-3">Unlimited</td><td className="p-3">Unlimited</td><td className="p-3">1,000</td></tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">HTTP Status Codes</h4>
            <div className="overflow-x-auto mb-6">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead>
                   <tr className="border-b-2 border-gray-100 text-charcoal font-bold">
                     <th className="pb-2 pr-4">Code</th>
                     <th className="pb-2 px-4">Status</th>
                     <th className="pb-2 pl-4 w-full">Meaning</th>
                   </tr>
                 </thead>
                 <tbody className="text-gray-500 font-medium">
                   <tr className="border-b border-gray-50">
                     <td className="py-2 pr-4 font-mono font-bold text-amber-600">400</td>
                     <td className="py-2 px-4">Bad Request</td>
                     <td className="py-2 pl-4">The request was unacceptable, often due to missing a required parameter.</td>
                   </tr>
                   <tr className="border-b border-gray-50">
                     <td className="py-2 pr-4 font-mono font-bold text-red-600">401</td>
                     <td className="py-2 px-4">Unauthorized</td>
                     <td className="py-2 pl-4">No valid API key provided.</td>
                   </tr>
                   <tr className="border-b border-gray-50">
                     <td className="py-2 pr-4 font-mono font-bold text-red-600">429</td>
                     <td className="py-2 px-4">Rate Limited</td>
                     <td className="py-2 pl-4">Too many requests hit the API or monthly quota exceeded.</td>
                   </tr>
                 </tbody>
               </table>
            </div>

            <SyntaxHighlighter language="json" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", margin: 0 }}>
{`// 429 Rate Limit Response payload
{
  "success": false,
  "error": "Monthly parse limit reached",
  "data": {
    "limit": 100,
    "used": 100,
    "tier": "free",
    "upgrade_url": "/developer/portal/billing"
  }
}`}
            </SyntaxHighlighter>

          </section>


          <section id="sdks" className="mb-16 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-black text-charcoal mb-4">SDKs &amp; Examples</h2>
            <p className="text-gray-600 font-medium mb-6 leading-relaxed">
              Official client libraries and code examples to help you integrate Vishleshan into your stack quickly.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                { lang: "Python", pkg: "vishleshan-py", icon: "??", install: "pip install vishleshan-py" },
                { lang: "JavaScript", pkg: "vishleshan-js", icon: "?", install: "npm install vishleshan-js" },
                { lang: "Go", pkg: "go-vishleshan", icon: "??", install: "go get vishleshan.ai/go-vishleshan" }
              ].map(sdk => (
                <div key={sdk.lang} className="border border-gray-200 rounded-2xl p-5 bg-gray-50/40 hover:bg-gray-50 transition-colors">
                  <div className="text-2xl mb-2">{sdk.icon}</div>
                  <div className="font-bold text-charcoal text-sm mb-1">{sdk.lang} SDK</div>
                  <code className="text-[11px] text-gray-500 block mb-3">{sdk.pkg}</code>
                  <SyntaxHighlighter language="bash" style={vs2015} customStyle={{ borderRadius: "8px", padding: "8px 12px", fontSize: "11px", margin: 0 }}>
                    {sdk.install}
                  </SyntaxHighlighter>
                </div>
              ))}
            </div>
            <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">Python Example</h4>
            <SyntaxHighlighter language="python" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px", marginBottom: "16px" }}>
{`import vishleshan

client = vishleshan.Client(api_key="vish_live_xxxxxxxx")

# Parse a resume
result = client.parse(file=open("resume.pdf", "rb"))
print(result.candidate_id)  # cnd_12345
print(result.skills)        # ["Python", "React"]

# Match candidates
matches = client.match(job_title="Senior Engineer", job_description="...", top_k=5)
for m in matches:
    print(m.name, m.match_score)`}
            </SyntaxHighlighter>
            <h4 className="font-bold text-charcoal text-sm uppercase mb-3 text-gray-400">JavaScript / Node.js Example</h4>
            <SyntaxHighlighter language="javascript" style={vs2015} customStyle={{ borderRadius: "12px", padding: "16px", fontSize: "12px" }}>
{`import { VishleshanClient } from 'vishleshan-js';
const client = new VishleshanClient({ apiKey: 'vish_live_xxxxxxxx' });

// Parse a resume
const { data } = await client.parse({ file: fs.createReadStream('resume.pdf') });
console.log(data.candidateId);

// Job matching
const matches = await client.match({ jobTitle: 'Senior React Developer', jobDescription: '...', topK: 10 });
console.log(matches.data.matches);`}
            </SyntaxHighlighter>
          </section>
        </motion.div>
      </main>

      {/* PLAYGROUND MODAL */}
      {playgroundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
          <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden relative border border-gray-200 flex flex-col md:flex-row h-[550px]">
             
             <div className="w-full md:w-1/2 p-6 border-r border-gray-100 flex flex-col relative overflow-y-auto custom-scrollbar">
               <button onClick={()=>setPlaygroundOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-charcoal transition-colors">✕</button>
               <h3 className="font-bold text-lg text-charcoal mb-5 flex items-center gap-2"><Play size={16} className="text-accent stroke-[3]" /> Live Playground</h3>
               
               <div className="flex flex-col gap-4 flex-1">
                 <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Endpoint</label>
                   <div className="flex font-mono text-xs border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                     <div className="px-3 py-2 bg-blue-50 text-accent font-bold">{pgEndpoint?.method}</div>
                     <div className="px-3 py-2 text-gray-600 font-medium w-full truncate">{pgEndpoint?.path}</div>
                   </div>
                 </div>
                 
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">API Key (X-API-Key)</label>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 focus-within:border-accent transition-colors">
                      <input 
                        type="text" 
                        placeholder="vish_test_..." 
                        value={apiKey}
                        onChange={(e)=>setApiKey(e.target.value)}
                        className="flex-1 bg-transparent outline-none font-mono text-xs font-bold truncate" 
                      />
                      {apiKey && (
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(apiKey); toast.success("API key copied!"); }}
                          className="shrink-0 text-gray-400 hover:text-accent transition-colors"
                          title="Copy API key"
                        >
                          <Copy size={13} />
                        </button>
                      )}
                    </div>
                    {!apiKey && (
                      <p className="text-[10px] text-amber-600 font-semibold pl-1">⚠ No active key found. Go to <a href="/developer/portal/keys" className="underline">API Keys</a> to create one.</p>
                    )}
                  </div>

                 {pgEndpoint?.path?.includes("/:id") && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Candidate ID (:id)</label>
                      <input 
                        type="text" 
                        value={candidateIdParam}
                        onChange={(e)=>setCandidateIdParam(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-accent outline-none text-xs font-semibold" 
                      />
                    </div>
                 )}

                 {pgEndpoint?.method === "POST" && pgEndpoint?.path !== "/api/v1/parse" && pgEndpoint?.path !== "/api/v1/protection/scan" && (
                    <div className="flex flex-col gap-1 flex-1 min-h-[150px]">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Request Body (JSON)</label>
                      <textarea 
                        rows="8"
                        value={requestBodyJson}
                        onChange={(e)=>setRequestBodyJson(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-accent outline-none text-xs font-mono resize-none flex-1 min-h-[140px]" 
                      />
                    </div>
                 )}

                 {pgEndpoint?.path === "/api/v1/parse" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">File Body</label>
                      <input 
                        type="file" 
                        onChange={(e)=>setSelectedFile(e.target.files[0])}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs text-gray-600" 
                      />
                    </div>
                 )}

                 {pgEndpoint?.path === "/api/v1/protection/scan" && (
                   <>
                     <div className="flex flex-col gap-1">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Scan Type</label>
                       <select 
                         value={scanType} 
                         onChange={(e)=>setScanType(e.target.value)}
                         className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs text-gray-700 font-bold"
                       >
                         <option value="user">User Scan (Resume/Portfolio)</option>
                         <option value="job">Job Scan (Posting Info)</option>
                       </select>
                     </div>

                     {scanType === "user" ? (
                       <>
                         <div className="flex flex-col gap-1">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">File Body (Optional)</label>
                           <input 
                             type="file" 
                             onChange={(e)=>setSelectedFile(e.target.files[0])}
                             className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs text-gray-600" 
                           />
                         </div>
                         <div className="flex flex-col gap-1">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Portfolio URL (Optional)</label>
                           <input 
                             type="url" 
                             placeholder="https://github.com/..." 
                             value={portfolioUrl}
                             onChange={(e)=>setPortfolioUrl(e.target.value)}
                             className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-accent outline-none text-xs font-semibold" 
                           />
                         </div>
                       </>
                     ) : (
                       <>
                         <div className="flex flex-col gap-1">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Job Title</label>
                           <input 
                             type="text" 
                             placeholder="Frontend Engineer" 
                             value={jobTitle}
                             onChange={(e)=>setJobTitle(e.target.value)}
                             className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-accent outline-none text-xs font-semibold" 
                           />
                         </div>
                         <div className="flex flex-col gap-1">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Job Description</label>
                           <textarea 
                             rows="3"
                             placeholder="We are looking for..." 
                             value={jobDescription}
                             onChange={(e)=>setJobDescription(e.target.value)}
                             className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-accent outline-none text-xs font-semibold resize-none" 
                           />
                         </div>
                       </>
                     )}
                   </>
                 )}
               </div>
 
               <button 
                 onClick={sendPlaygroundRequest} 
                 disabled={loading}
                 className="mt-6 w-full bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
               >
                 {loading ? (
                   <>
                     <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                     <span>Sending...</span>
                   </>
                 ) : (
                   "Send Request"
                 )}
               </button>
             </div>
             
             <div className="w-full md:w-1/2 bg-[#1E1E1E] flex flex-col relative h-full md:h-auto">
               <button onClick={()=>setPlaygroundOpen(false)} className="hidden md:block absolute top-4 right-4 text-gray-400 hover:text-white z-10 font-bold">✕</button>
               <div className="px-4 py-3 bg-[#2D2D2D] border-b border-gray-700 font-bold text-xs text-gray-400 uppercase tracking-widest">JSON Response</div>
               <div className="flex-1 overflow-y-auto p-4 text-xs font-mono custom-scrollbar text-[#D4D4D4]">
                 {loading ? (
                   <div className="h-full flex items-center justify-center flex-col gap-3 text-gray-400">
                     <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                     <span className="font-semibold text-xs animate-pulse">Processing request...</span>
                   </div>
                 ) : responseJson ? (
                   <SyntaxHighlighter language="json" style={vs2015} customStyle={{ background: "transparent", padding: 0, margin: 0, fontSize: "11px" }}>
                     {JSON.stringify(responseJson, null, 2)}
                   </SyntaxHighlighter>
                 ) : errorMsg ? (
                   <div className="text-red-400 font-semibold leading-relaxed">
                     Error: {errorMsg}
                   </div>
                 ) : (
                   <div className="text-gray-500 italic">
                     Hit "Send Request" to view output here...
                   </div>
                 )}
               </div>
             </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
