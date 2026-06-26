import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Check, Menu, X, Search, FileText, Brain, Cpu, Zap, Lock } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { portalBilling, portalAuth } from "../../lib/portalApi";
import { usePortalAuthStore } from "../../stores/portalAuthStore";



export default function DeveloperLandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState("Python");
  const [plans, setPlans] = useState([
    { id: "free", name: "Free", price: 0, features: ["100 free parses/month", "Community support", "Basic formatting", "No SLA"] },
    { id: "starter", name: "Starter", price: 2999, features: ["1000 parses/month", "Email support", "All output formats", "99% uptime"] },
    { id: "business", name: "Business", price: 9999, features: ["10000 parses/month", "Priority support", "Custom prompts", "99.9% uptime SLA"] }
  ]);

  const { tier, jwt, initFromStorage, setAuth } = usePortalAuthStore();
  const [isDevLoggedIn, setIsDevLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("portal_jwt");
    if (token && token !== "undefined") {
      setIsDevLoggedIn(true);
      initFromStorage();
      
      // Fetch latest profile from backend to ensure tier is up-to-date
      portalAuth.getMe()
        .then((meData) => {
          setAuth(meData);
        })
        .catch((err) => {
          console.error("Failed to sync developer info on landing page:", err);
        });
    } else {
      setIsDevLoggedIn(false);
    }
  }, [jwt, initFromStorage, setAuth]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await portalBilling.plans();
        if (data && data.length > 0) setPlans(data);
      } catch (err) {
        console.error("Failed to fetch plans", err);
      }
    };
    fetchPlans();

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const heroCode = `// One API call. Complete intelligence.
const response = await fetch(
  'https://api.vishleshan.ai/api/v1/parse',
  {
    method: 'POST',
    headers: {
      'X-API-Key': 'vishleshan_live_abc123...'
    },
    body: formData  // attach resume PDF
  }
);

const { data } = await response.json();

// Returns structured intelligence:
// {
//   match_score: 87.4,
//   matched_skills: ["Python", "React", "AWS"],
//   missing_skills: ["Kubernetes"],
//   recommendation: "Strong Match",
//   candidate: { name, email, experience... }
// }`;

  const tabs = {
    Python: `import requests
response = requests.post(
    "https://api.vishleshan.ai/api/v1/ingest/upload",
    headers={"X-API-Key": "vishleshan_live_your_key"},
    files={"files": open("resume.pdf", "rb")},
    data={"session_id": "your_session_id"}
)
result = response.json()`,
    JavaScript: `const formData = new FormData();
formData.append('files', resumeFile);
formData.append('session_id', 'your_session_id');

const response = await fetch(
  'https://api.vishleshan.ai/api/v1/ingest/upload',
  {
    method: 'POST',
    headers: { 'X-API-Key': 'vishleshan_live_your_key' },
    body: formData
  }
);`,
    cURL: `curl -X POST \
  https://api.vishleshan.ai/api/v1/ingest/upload \
  -H "X-API-Key: vishleshan_live_your_key" \\
  -F "session_id=your_session_id" \
  -F "files=@resume.pdf"`
  };

  return (
    <div className="min-h-screen font-sans text-charcoal bg-bg developer-page">
      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white shadow-md py-1" : "bg-white/90 backdrop-blur-md py-2"}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-accent cursor-pointer" onClick={() => window.scrollTo(0, 0)}>Vishleshan</span>
            <span className="text-[13px] text-gray-500 font-medium">for Developers</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <Link to="/" className="hover:text-accent transition-colors">Home</Link>
            <a href="#features" className="hover:text-accent transition-colors">Features</a>
            <a href="#pricing" className="hover:text-accent transition-colors">Pricing</a>
            <a href="#docs" className="hover:text-accent transition-colors">Docs</a>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {isDevLoggedIn ? (
              <Link to="/developer/portal" className="px-5 py-2 rounded-lg text-accent border border-accent font-semibold hover:bg-accent-light transition-colors">Dashboard</Link>
            ) : (
              <Link to="/developer/login" className="px-5 py-2 rounded-lg text-accent border border-accent font-semibold hover:bg-accent-light transition-colors">Sign In</Link>
            )}
            <Link to="/developer/register" className="px-5 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent-dark transition-colors shadow-sm">Get API Key</Link>
          </div>
          <button className="md:hidden text-charcoal" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {mobileMenu && (
        <div className="fixed inset-0 top-[60px] bg-white z-40 p-6 flex flex-col gap-6 md:hidden">
            <Link to="/" className="text-lg font-semibold text-gray-700" onClick={() => setMobileMenu(false)}>Home</Link>
            <a href="#features" className="text-lg font-semibold text-gray-700" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#pricing" className="text-lg font-semibold text-gray-700" onClick={() => setMobileMenu(false)}>Pricing</a>
            <a href="#docs" className="text-lg font-semibold text-gray-700" onClick={() => setMobileMenu(false)}>Docs</a>
            <div className="border-t pt-6 flex flex-col gap-4">
               {isDevLoggedIn ? (
                  <Link to="/developer/portal" className="w-full text-center px-5 py-3 rounded-lg text-accent border border-accent font-semibold" onClick={() => setMobileMenu(false)}>Dashboard</Link>
               ) : (
                  <Link to="/developer/login" className="w-full text-center px-5 py-3 rounded-lg text-accent border border-accent font-semibold" onClick={() => setMobileMenu(false)}>Sign In</Link>
               )}
               <Link to="/developer/register" className="w-full text-center px-5 py-3 rounded-lg bg-accent text-white font-semibold" onClick={() => setMobileMenu(false)}>Get API Key</Link>
            </div>
        </div>
      )}

      {/* HERO */}
      <header className="pt-32 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-5 flex flex-col items-start gap-6">
          <span className="px-4 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-semibold flex flex-row items-center gap-2">
            <Cpu size={14} /> AI-Powered Talent API
          </span>
          <h1 className="text-4xl lg:text-[48px] font-black text-charcoal leading-[1.1] tracking-tight">
            Resume Intelligence API<br />for HR Platforms
          </h1>
          <p className="text-lg text-gray-600 max-w-[480px] leading-relaxed">
            Parse resumes semantically, match skills intelligently, and rank candidates — all through a simple REST API. Integrate in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
             <Link to={isDevLoggedIn ? "/developer/portal" : "/developer/register"} className="flex justify-center items-center px-6 py-3.5 rounded-xl bg-accent text-white font-bold hover:bg-accent-dark transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/30 gap-2">
               {isDevLoggedIn ? "Go to Dashboard" : "Get Free API Key"} <span className="text-xl leading-none">→</span>
             </Link>
             <a href="#docs" className="flex justify-center items-center px-6 py-3.5 rounded-xl border-2 border-accent text-accent font-bold hover:bg-accent/5 transition-all">
               View Documentation
             </a>
          </div>
          <div className="flex flex-col gap-2 mt-4 text-sm font-medium text-gray-500">
             <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" /> No credit card required
             </div>
             <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" /> 100 free parses/month
             </div>
             <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" /> 99.9% uptime SLA
             </div>
          </div>
        </div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="md:col-span-7 bg-[#1E1E1E] rounded-2xl p-6 shadow-2xl overflow-hidden relative border border-gray-800"
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="mt-4">
            <SyntaxHighlighter language="javascript" style={vs2015} customStyle={{ background: "transparent", padding: 0, margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
              {heroCode}
            </SyntaxHighlighter>
          </div>
        </motion.div>
      </header>

      {/* STATS BAR */}
      <section className="w-full bg-accent py-8">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x divide-white/20">
           <div className="flex flex-col px-4 text-white">
             <span className="text-2xl font-bold">500+</span>
             <span className="text-sm font-medium text-white/90 uppercase tracking-wide">Resumes/min</span>
           </div>
           <div className="flex flex-col px-4 text-white">
             <span className="text-2xl font-bold">&lt;10ms</span>
             <span className="text-sm font-medium text-white/90 uppercase tracking-wide">Latency</span>
           </div>
           <div className="flex flex-col px-4 text-white">
             <span className="text-2xl font-bold">99.9%</span>
             <span className="text-sm font-medium text-white/90 uppercase tracking-wide">Uptime</span>
           </div>
           <div className="flex flex-col px-4 text-white">
             <span className="text-2xl font-bold">5,000+</span>
             <span className="text-sm font-medium text-white/90 uppercase tracking-wide">Skills</span>
           </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 max-w-7xl mx-auto px-6" id="how-it-works">
         <div className="text-center mb-16">
           <h2 className="text-3xl font-bold text-charcoal">How it works</h2>
           <p className="text-gray-500 mt-4">Integrate automated intelligence into your platform in 3 easy steps.</p>
         </div>
         <div className="flex flex-col md:flex-row gap-8 items-start relative">
            <div className="hidden md:block absolute top-[44px] left-[15%] right-[15%] h-[2px] bg-gray-200 z-0"></div>
            
            <div className="flex-1 flex flex-col items-center text-center relative z-10">
               <div className="w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center justify-center text-4xl mb-6 font-bold text-accent">1</div>
               <h3 className="text-xl font-bold mb-3 flex items-center justify-center gap-2">Get API Key</h3>
               <p className="text-gray-500 font-medium">Create an account and generate a live API key in your developer dashboard to authenticate your application.</p>
            </div>
            
            <div className="flex-1 flex flex-col items-center text-center relative z-10">
               <div className="w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center justify-center text-4xl mb-6 font-bold text-accent">2</div>
               <h3 className="text-xl font-bold mb-3 flex items-center justify-center gap-2">Send Resumes</h3>
               <p className="text-gray-500 font-medium">Post PDF, DOCX, ZIP files or raw text to our secure endpoints. We process them synchronously or asynchronously.</p>
            </div>
            
            <div className="flex-1 flex flex-col items-center text-center relative z-10">
               <div className="w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center justify-center text-4xl mb-6 font-bold text-accent">3</div>
               <h3 className="text-xl font-bold mb-3 flex items-center justify-center gap-2">Get Results</h3>
               <p className="text-gray-500 font-medium">Receive structured JSON containing normalized skills, normalized job titles, experience data and contextual rankings.</p>
            </div>
         </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-24 bg-white border-y border-gray-100" id="features">
         <div className="max-w-7xl mx-auto px-6">
           <div className="mb-16">
             <h2 className="text-3xl lg:text-4xl font-bold text-charcoal text-center">Everything you need for intelligent hiring</h2>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             
             <div className="p-8 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-accent hover:bg-white hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group">
               <Search size={32} className="text-accent mb-4 group-hover:scale-110 transition-transform origin-left" />
               <h3 className="text-xl font-bold mb-3">Semantic Matching</h3>
               <p className="text-gray-500 leading-relaxed font-medium">"React.js = ReactJS = react js — we understand it all."</p>
             </div>
             
             <div className="p-8 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-accent hover:bg-white hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group">
               <FileText size={32} className="text-accent mb-4 group-hover:scale-110 transition-transform origin-left" />
               <h3 className="text-xl font-bold mb-3">Multi-Format Parsing</h3>
               <p className="text-gray-500 leading-relaxed font-medium">"PDF, DOCX, plain text, ZIP archives, Google Drive directly connected."</p>
             </div>
             
             <div className="p-8 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-accent hover:bg-white hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group">
               <Brain size={32} className="text-accent mb-4 group-hover:scale-110 transition-transform origin-left" />
               <h3 className="text-xl font-bold mb-3">Skill Normalization</h3>
               <p className="text-gray-500 leading-relaxed font-medium">"Auto-maps synonyms, infers related skills implicitly mentioned, detects proficiency levels."</p>
             </div>
             
             <div className="p-8 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-accent hover:bg-white hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group">
               <Cpu size={32} className="text-accent mb-4 group-hover:scale-110 transition-transform origin-left" />
               <h3 className="text-xl font-bold mb-3">AI Chatbot API</h3>
               <p className="text-gray-500 leading-relaxed font-medium">"Query your candidate database in natural language through our API interface."</p>
             </div>

             <div className="p-8 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-accent hover:bg-white hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group">
               <Zap size={32} className="text-accent mb-4 group-hover:scale-110 transition-transform origin-left" />
               <h3 className="text-xl font-bold mb-3">Batch Processing</h3>
               <p className="text-gray-500 leading-relaxed font-medium">"Process 500 resumes asynchronously at once with webhook notifications on completion."</p>
             </div>

             <div className="p-8 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-accent hover:bg-white hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group">
               <Lock size={32} className="text-accent mb-4 group-hover:scale-110 transition-transform origin-left" />
               <h3 className="text-xl font-bold mb-3">Enterprise Security</h3>
               <p className="text-gray-500 leading-relaxed font-medium">"Secure API keys, strict rate limiting, domain whitelisting, and CORS compliant."</p>
             </div>

           </div>
         </div>
      </section>

      {/* CODE EXAMPLES */}
      <section className="py-24 max-w-5xl mx-auto px-6" id="docs">
        <div className="text-center mb-12">
           <h2 className="text-3xl font-bold text-charcoal">Integration is a breeze</h2>
           <p className="text-gray-500 mt-4">Available via standard REST interfaces in any language.</p>
         </div>
         <div className="bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
            <div className="flex border-b border-gray-700 bg-[#2D2D2D]">
              {Object.keys(tabs).map(tab => (
                 <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-sm font-semibold transition-colors ${activeTab === tab ? 'text-white border-b-2 border-white bg-[#1E1E1E]' : 'text-gray-400 hover:text-white'}`}
                 >
                   {tab}
                 </button>
              ))}
            </div>
            <div className="p-6 relative text-sm">
               <SyntaxHighlighter language={activeTab === "Python" ? "python" : activeTab === "cURL" ? "bash" : "javascript"} style={vs2015} customStyle={{ background: "transparent", padding: 0, margin: 0, lineHeight: "1.6" }}>
                 {tabs[activeTab]}
               </SyntaxHighlighter>
            </div>
         </div>
      </section>

      {/* PRICING */}
      <section className="py-24 bg-gray-50 border-t border-gray-100" id="pricing">
         <div className="max-w-7xl mx-auto px-6">
           <div className="text-center mb-16">
             <h2 className="text-3xl font-bold text-charcoal">Simple, transparent pricing</h2>
             <p className="text-gray-500 mt-4">Start for free. Pay as you scale.</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
             {plans.map((plan) => (
                <div key={plan.id} className={`bg-white rounded-3xl p-8 shadow-xl ${plan.id === 'starter' ? 'border-2 border-accent md:-translate-y-4 shadow-amber-500/10' : 'border border-gray-100'}`}>
                   {plan.id === "starter" && <p className="text-accent text-sm font-bold uppercase tracking-wider mb-2">Most Popular</p>}
                   <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                   <div className="flex items-baseline gap-1 mb-8 border-b border-gray-100 pb-8">
                     <span className="text-4xl font-black">₹{plan.price}</span>
                     <span className="text-gray-500">/month</span>
                   </div>
                   
                   <ul className="flex flex-col gap-4 mb-8">
                     {plan.features?.map((f, i) => (
                        <li key={i} className="flex items-center gap-3 font-medium text-gray-600">
                          <Check size={18} className="text-green-500 shrink-0" /> {f}
                        </li>
                     ))}
                   </ul>
                   
                   {isDevLoggedIn ? (
                      plan.id === tier ? (
                        <button disabled className="w-full block text-center py-3.5 rounded-xl font-bold bg-green-50 text-green-700 border border-green-200 cursor-not-allowed">
                          Current Plan
                        </button>
                      ) : (
                        <Link to="/developer/portal/billing" className={`w-full block text-center py-3.5 rounded-xl font-bold transition-all ${plan.id === 'starter' ? 'bg-accent text-white hover:bg-accent-dark shadow-md shadow-accent/20' : 'bg-gray-100 text-charcoal hover:bg-gray-200'}`}>
                          Subscribe now
                        </Link>
                      )
                    ) : (
                      <Link to="/developer/register" className={`w-full block text-center py-3.5 rounded-xl font-bold transition-all ${plan.id === 'starter' ? 'bg-accent text-white hover:bg-accent-dark shadow-md shadow-accent/20' : 'bg-gray-100 text-charcoal hover:bg-gray-200'}`}>
                        {plan.price === 0 ? "Start for free" : "Subscribe now"}
                      </Link>
                    )}
                </div>
             ))}
           </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-charcoal text-white/70 py-16">
         <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex flex-col items-center md:items-start gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-accent">Vishleshan</span>
                  <span className="text-[13px] text-gray-400 font-medium">for Developers</span>
                </div>
                <p className="text-sm mt-1">Built for smarter hiring.</p>
             </div>
            
            <div className="flex flex-wrap justify-center gap-8 text-sm font-medium">
               <a href="#" className="hover:text-accent transition-colors">Privacy Policy</a>
               <a href="#" className="hover:text-accent transition-colors">Terms of Service</a>
               <a href="#" className="hover:text-accent transition-colors">API Status</a>
               <a href="#" className="hover:text-accent transition-colors">Contact Support</a>
            </div>
            
            <div className="text-sm">
               © {new Date().getFullYear()} Vishleshan API.
            </div>
         </div>
      </footer>
    </div>
  );
}
