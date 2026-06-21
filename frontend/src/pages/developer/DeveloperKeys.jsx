import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { portalKeys, portalAuth } from "../../lib/portalApi";
import { usePortalAuthStore } from "../../stores/portalAuthStore";
import { 
  Plus, 
  Key, 
  Eye, 
  EyeOff, 
  Edit2, 
  RotateCcw, 
  Trash2, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  BarChart2, 
  Check,
  Building,
  Lock,
  Tags,
  AlertOctagon,
  X
} from "lucide-react";
import NewKeyModal from "../../components/developer/NewKeyModal";
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";
import { toast } from "react-hot-toast";

// Subcomponent for each key row
function DeveloperKeyRow({ apiKey, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedType, setCopiedType] = useState(null); // 'secret' | 'public' | 'masked'
  
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["key-usage", apiKey.id],
    queryFn: () => portalKeys.getUsage(apiKey.id, "7d"),
    enabled: expanded
  });

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleRename = async () => {
    const newName = window.prompt("Enter new key name:", apiKey.key_name);
    if (newName && newName.trim()) {
      try {
        await portalKeys.rename(apiKey.id, { key_name: newName });
        toast.success("Key renamed successfully");
        onUpdate();
      } catch (e) {
        toast.error("Failed to rename key");
      }
    }
  };

  const handleRotate = async () => {
    if (window.confirm("Are you sure you want to rotate this secret key? The old key will immediately stop working!")) {
      try {
        const res = await portalKeys.rotate(apiKey.id);
        toast.success("Key rotated successfully. Save your new secret!");
        window.prompt("Copy your new SECRET KEY now (it will only be shown this one time):", res.secret_key);
        onUpdate();
      } catch (e) {
        toast.error("Failed to rotate key");
      }
    }
  };

  const handleRevoke = async () => {
    if (window.confirm("Are you SURE you want to revoke this key? This action is permanent!")) {
      try {
        await portalKeys.revoke(apiKey.id);
        toast.success("Key revoked");
        onUpdate();
      } catch (e) {
        toast.error("Failed to revoke key");
      }
    }
  };

  const formatDate = (ds) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`border-b border-gray-100 last:border-b-0 transition-all ${!apiKey.is_active ? 'opacity-60 grayscale bg-gray-50/50' : 'hover:bg-gray-50/30'}`}>
      {/* ROW CONTENT HEADER */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-accent flex items-center justify-center shrink-0">
            <Key size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-charcoal">{apiKey.key_name}</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                apiKey.environment === 'production' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'
              }`}>
                {apiKey.environment || 'production'}
              </span>
            </div>
            <div className="text-[11px] text-gray-800 font-mono mt-0.5 tracking-tight font-bold select-all">
              {apiKey.public_key || 'Hidden'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-12 sm:ml-0 shrink-0 justify-between sm:justify-end">
          <span className="text-[11px] text-gray-800 font-bold">
            Created {formatDate(apiKey.created_at)}
          </span>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => handleCopy(apiKey.secret_key || "", 'secret')}
              className="p-1.5 text-gray-600 hover:text-accent hover:bg-blue-50 rounded-lg transition-colors"
              title="Copy secret key"
            >
              {copiedType === 'secret' ? <Check size={14} className="text-green-500" /> : <Key size={14} />}
            </button>
            <button 
              onClick={() => handleCopy(apiKey.public_key || "", 'masked')}
              className="p-1.5 text-gray-600 hover:text-charcoal hover:bg-gray-100 rounded-lg transition-colors"
              title="Copy public key"
            >
              {copiedType === 'masked' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
            <button 
              onClick={handleRevoke}
              disabled={!apiKey.is_active}
              className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              title="Revoke key"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-600 hover:text-charcoal hover:bg-gray-150 rounded-lg transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDED DETAILS */}
      {expanded && (
        <div className="p-6 bg-gray-50/50 border-t border-gray-100 space-y-6 text-sm">
          {/* Key values detail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest pl-0.5">Secret Key</label>
               <div className="flex items-center gap-2 mt-1.5 bg-white border border-gray-200 rounded-xl p-2.5 px-3">
                 <input 
                   type="text" 
                   value={showSecret ? (apiKey.secret_key || "") : (apiKey.secret_key_masked || "••••••••••••••••••••••••")} 
                   readOnly 
                   className="text-xs flex-1 text-black font-mono bg-transparent outline-none truncate font-extrabold" 
                 />
                 <button type="button" onClick={() => setShowSecret(!showSecret)} className="text-gray-500 hover:text-charcoal shrink-0 mr-1" title={showSecret ? 'Hide secret key' : 'Reveal secret key'}>
                   {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                 </button>
                 <button 
                   onClick={() => handleCopy(apiKey.secret_key || "", 'secret')} 
                   className="text-gray-500 hover:text-accent shrink-0"
                   title="Copy secret key"
                 >
                   {copiedType === 'secret' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                 </button>
               </div>
            </div>

            <div>
               <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest pl-0.5">Public Key</label>
               <div className="flex items-center gap-2 mt-1.5 bg-white border border-gray-200 rounded-xl p-2.5 px-3">
                 <input 
                   type="text" 
                   value={apiKey.public_key || ""} 
                   readOnly 
                   className="text-xs flex-1 text-black font-mono bg-transparent outline-none truncate font-extrabold" 
                 />
                 <button 
                   onClick={() => handleCopy(apiKey.public_key || "", 'public')} 
                   className="text-gray-500 hover:text-accent shrink-0"
                 >
                   {copiedType === 'public' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                 </button>
               </div>
            </div>
          </div>

          {/* Key metadata */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-gray-900 font-extrabold bg-white border border-gray-150 p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <div>
              <span className="text-gray-800">Last Used:</span> {formatDate(apiKey.last_used_at) || "Never"}
            </div>
            <div>
              <span className="text-gray-800">This Month:</span> {apiKey.this_month_calls || 0} calls
            </div>
            <div>
              <span className="text-gray-800">Status:</span> <span className={apiKey.is_active ? "text-green-700 font-black" : "text-red-600 font-black"}>{apiKey.is_active ? "Active" : "Revoked"}</span>
            </div>
          </div>

          {/* Mini Usage chart */}
          <div className="border border-gray-150 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2 text-xs font-bold text-gray-500">
              <BarChart2 size={14} /> Usage (Last 7 Days)
            </div>
            <div className="p-4 h-36">
              {usageLoading ? (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 animate-pulse">Loading data...</div>
              ) : usageData && usageData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageData} margin={{top:5, right:5, bottom:0, left:-25}}>
                    <XAxis dataKey="date" tick={{fontSize: 9, fill: '#111827'}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 9, fill: '#111827'}} tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip cursor={{fill: '#F9F8F6'}} contentStyle={{borderRadius:'8px', border:'none', fontSize: 10, boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}} />
                    <Bar dataKey="calls" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-400">No usage recorded</div>
              )}
            </div>
          </div>

          {/* Row actions */}
          {apiKey.is_active && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button 
                onClick={handleRename} 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 size={13}/> Rename
              </button>
              <button 
                onClick={handleRotate} 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              >
                <RotateCcw size={13}/> Rotate Secret
              </button>
              <button 
                onClick={handleRevoke} 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={13}/> Revoke Key
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeveloperKeys({ defaultTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isKeysRoute = location.pathname.includes('/keys');
  const initialTab = defaultTab || (isKeysRoute ? "api-keys" : "profile");
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { company_name, developer, setAuth } = usePortalAuthStore();
  
  // Profile state
  const [profile, setProfile] = useState({ name: company_name || "", website: developer?.website_url || "" });
  
  // Passwords state
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  
  // CORS Domains state
  const [domains, setDomains] = useState(developer?.allowed_domains || ["hrms.yourcompany.com"]);
  const [newDomain, setNewDomain] = useState("");

  useEffect(() => {
    if (developer) {
      setProfile({
        name: developer.company_name || company_name || "",
        website: developer.website_url || ""
      });
      if (developer.allowed_domains) {
        setDomains(developer.allowed_domains);
      }
    }
  }, [developer, company_name]);

  const { data: keys, refetch, isLoading } = useQuery({
    queryKey: ["portal-keys"],
    queryFn: portalKeys.list,
  });

  // Sync tab state with route/defaultTab prop
  useEffect(() => {
    if (isKeysRoute) {
      setActiveTab("api-keys");
    } else {
      setActiveTab(defaultTab || "profile");
    }
  }, [location.pathname, isKeysRoute, defaultTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "api-keys") {
      navigate("/developer/portal/keys");
    } else {
      navigate("/developer/portal/settings");
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      const data = await portalAuth.updateProfile({
        company_name: profile.name,
        website_url: profile.website
      });
      setAuth({ company_name: data.company_name, website_url: data.website_url });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    }
  };

  const handlePasswordSave = (e) => {
    e.preventDefault();
    if(passwords.newPass !== passwords.confirm) return toast.error("Passwords do not match");
    toast.success("Password secured");
    setPasswords({ current: "", newPass: "", confirm: "" });
  };

  const updateDomains = async (newDomainsList) => {
    try {
      const data = await portalAuth.updateProfile({
        allowed_domains: newDomainsList
      });
      setAuth({ allowed_domains: data.allowed_domains });
      setDomains(data.allowed_domains);
      return true;
    } catch (err) {
      toast.error(err.message || "Failed to update allowed domains");
      return false;
    }
  };

  const addDomain = async (e) => {
    e.preventDefault();
    if(newDomain && !domains.includes(newDomain)) {
       const updated = [...domains, newDomain];
       const ok = await updateDomains(updated);
       if (ok) {
         setNewDomain("");
         toast.success("Domain added");
       }
    }
  };

  const removeDomain = async (d) => {
    const updated = domains.filter(x => x !== d);
    const ok = await updateDomains(updated);
    if (ok) {
       toast.success("Domain removed");
    }
  };

  const handleAccountDelete = () => {
    const email = window.prompt(`To permanently delete your account, type your email (${developer?.email || 'admin@company.com'}) below:`);
    if (email === developer?.email || email) {
      toast.error("Account scheduled for deletion.");
    }
  };

  // Combine both production and test keys into a single list
  const allKeys = [
    ...(keys?.production_keys || []),
    ...(keys?.test_keys || [])
  ];

  const tabs = {
    cURL: `curl -X POST \\
  https://api.vishleshan.ai/api/v1/parse \\
  -H "X-API-Key: YOUR_KEY" \\
  -F "files=@resume.pdf"`,
    Python: `import requests
 
response = requests.post(
    "https://api.vishleshan.ai/api/v1/parse",
    headers={"X-API-Key": "YOUR_KEY"},
    files={"files": open("resume.pdf", "rb")}
)
print(response.json())`,
    JavaScript: `const formData = new FormData();
formData.append('files', resumeFile);
 
const response = await fetch('https://api.vishleshan.ai/api/v1/parse', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_KEY' },
  body: formData
});
const data = await response.json();`
  };
  const [activeCodeTab, setActiveCodeTab] = useState("cURL");

  const tabItems = [
    { id: 'profile', label: 'Workspace profile', icon: Building },
    { id: 'api-keys', label: 'API keys', icon: Key },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'domains', label: 'Allowed domains', icon: Tags },
    { id: 'danger', label: 'Danger zone', icon: AlertOctagon },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto pb-12 space-y-8">
      {/* HEADER */}
      <div>
         <h1 className="text-3xl font-black text-charcoal tracking-tight">Settings</h1>
         <p className="text-sm font-bold text-gray-800 mt-1 font-sans">Manage your developer account, API keys, and workspace preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* LEFT TAB BAR */}
        <div className="w-full lg:w-64 bg-white border border-gray-100 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs tracking-wide transition-all text-left whitespace-nowrap lg:whitespace-normal w-full ${
                  isSelected 
                    ? 'bg-blue-50 text-accent border border-blue-100/50' 
                    : 'text-gray-900 hover:bg-gray-50 hover:text-black font-extrabold'
                }`}
              >
                <Icon size={16} className={isSelected ? 'text-accent' : 'text-gray-700'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* RIGHT CONTENT */}
        <div className="flex-1 w-full space-y-6">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
              <h2 className="text-md font-bold text-charcoal flex items-center gap-2 pb-4 border-b border-gray-100">
                <Building className="w-5 h-5 text-accent" /> Workspace profile
              </h2>
              <form onSubmit={handleProfileSave} className="flex flex-col gap-5 max-w-lg">
                <div>
                   <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1.5 block pl-0.5">Company / Workspace Name</label>
                   <input 
                     type="text" 
                     value={profile.name} 
                     onChange={e=>setProfile({...profile, name: e.target.value})} 
                     className="w-full p-3 bg-white border border-gray-200 focus:border-accent rounded-xl text-sm font-bold text-charcoal focus:outline-none transition-colors" 
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1.5 block pl-0.5">Developer Email</label>
                   <input 
                     type="email" 
                     readOnly 
                     value={developer?.email || "developer@example.com"} 
                     className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-800 font-bold focus:outline-none cursor-not-allowed" 
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1.5 block pl-0.5">Website URL</label>
                   <input 
                     type="url" 
                     placeholder="https://" 
                     value={profile.website} 
                     onChange={e=>setProfile({...profile, website: e.target.value})} 
                     className="w-full p-3 bg-white border border-gray-200 focus:border-accent rounded-xl text-sm font-bold text-charcoal focus:outline-none transition-colors" 
                   />
                </div>
                <div className="pt-2">
                  <button type="submit" className="bg-[#2A2A2A] hover:bg-black text-white px-6 py-3 rounded-xl text-xs font-bold shadow-md transition-colors w-full sm:w-auto">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'api-keys' && (
            <>
              {/* API KEYS CARD CONTAINER */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
                {/* Card Header */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <h2 className="text-md font-bold text-charcoal flex items-center gap-2">
                    <Key className="w-5 h-5 text-accent" /> API keys
                  </h2>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-accent hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm active:scale-95"
                  >
                    <Plus size={14} /> Create key
                  </button>
                </div>

                {/* Keys List */}
                {isLoading ? (
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                    {[1, 2].map(i => (
                      <div key={i} className="p-6 bg-gray-50/30 animate-pulse flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-xl bg-gray-200"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-28"></div>
                            <div className="h-3 bg-gray-200 rounded w-40"></div>
                          </div>
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                    ))}
                  </div>
                ) : allKeys.length > 0 ? (
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden shadow-inner bg-white">
                    {allKeys.map(k => (
                      <DeveloperKeyRow key={k.id} apiKey={k} onUpdate={refetch} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-900 text-sm py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center">
                    <div className="mb-3 text-gray-600"><Key size={36} /></div>
                    <p className="font-extrabold text-gray-900">No API credentials generated yet.</p>
                    <p className="text-xs text-gray-900 mt-1 max-w-xs mx-auto font-bold">Create a credentials pair to authenticate your API connections.</p>
                  </div>
                )}
              </div>

              {/* INTEGRATION QUICKSTART */}
              <div className="bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-xl border border-gray-800">
                 <div className="p-6 border-b border-gray-700">
                    <h3 className="font-bold text-white text-md">Quick Integration Guide</h3>
                    <p className="text-gray-300 text-xs mt-1">Make your first parse request using your API key.</p>
                 </div>
                 <div className="flex bg-[#2D2D2D] border-b border-gray-700 px-2">
                   {Object.keys(tabs).map(tab => (
                      <button 
                       key={tab} 
                       onClick={() => setActiveCodeTab(tab)}
                       className={`px-6 py-3 text-xs font-bold transition-colors ${activeCodeTab === tab ? 'text-white border-b-2 border-white bg-[#1E1E1E]' : 'text-gray-300 hover:text-white'}`}
                      >
                        {tab}
                      </button>
                   ))}
                 </div>
                 <div className="p-6 relative text-xs font-mono">
                    <SyntaxHighlighter language={activeCodeTab === "Python" ? "python" : activeCodeTab === "cURL" ? "bash" : "javascript"} style={vs2015} customStyle={{ background: "transparent", padding: 0, margin: 0, lineHeight: "1.6" }}>
                      {tabs[activeCodeTab]}
                    </SyntaxHighlighter>
                 </div>
              </div>
            </>
          )}

          {activeTab === 'security' && (
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
              <h2 className="text-md font-bold text-charcoal flex items-center gap-2 pb-4 border-b border-gray-100">
                <Lock className="w-5 h-5 text-accent" /> Security Settings
              </h2>
              <form onSubmit={handlePasswordSave} className="flex flex-col gap-5 max-w-lg">
                <div>
                   <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1.5 block pl-0.5">Current Password</label>
                   <input 
                     type="password" 
                     required 
                     value={passwords.current} 
                     onChange={e=>setPasswords({...passwords, current:e.target.value})} 
                     className="w-full p-3 bg-white border border-gray-200 focus:border-accent rounded-xl text-sm font-bold text-charcoal focus:outline-none transition-colors font-mono" 
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1.5 block pl-0.5">New Password</label>
                   <input 
                     type="password" 
                     required 
                     value={passwords.newPass} 
                     onChange={e=>setPasswords({...passwords, newPass:e.target.value})} 
                     className="w-full p-3 bg-white border border-gray-200 focus:border-accent rounded-xl text-sm font-bold text-charcoal focus:outline-none transition-colors font-mono" 
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1.5 block pl-0.5">Confirm New Password</label>
                   <input 
                     type="password" 
                     required 
                     value={passwords.confirm} 
                     onChange={e=>setPasswords({...passwords, confirm:e.target.value})} 
                     className="w-full p-3 bg-white border border-gray-200 focus:border-accent rounded-xl text-sm font-bold text-charcoal focus:outline-none transition-colors font-mono" 
                   />
                </div>
                <div className="pt-2">
                  <button type="submit" className="bg-[#2A2A2A] hover:bg-black text-white px-6 py-3 rounded-xl text-xs font-bold shadow-md transition-colors w-full sm:w-auto">
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
              <div>
                <h2 className="text-md font-bold text-charcoal flex items-center gap-2 pb-2">
                  <Tags className="w-5 h-5 text-accent" /> Globally Allowed Domains
                </h2>
                <p className="text-xs text-gray-900 font-extrabold pl-7">Cross-Origin Resource Sharing (CORS) whitelists domains restricted from making frontend Embed API requests.</p>
              </div>
              <div className="border-t border-gray-100 pt-6 max-w-xl">
                 <div className="flex flex-wrap gap-2 mb-6">
                   {domains.map(d => (
                      <div key={d} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-800">
                        {d}
                        <button type="button" onClick={() => removeDomain(d)} className="text-gray-500 hover:text-red-500 transition-colors ml-1"><X size={14}/></button>
                      </div>
                   ))}
                   {domains.length === 0 && <span className="text-sm text-gray-900 font-bold italic py-1.5">No domains configured.</span>}
                 </div>
                 <form onSubmit={addDomain} className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="api.company.com" 
                      value={newDomain} 
                      onChange={e=>setNewDomain(e.target.value)} 
                      className="flex-1 p-3 bg-white border border-gray-200 focus:border-accent rounded-xl text-sm font-bold text-charcoal focus:outline-none transition-colors" 
                    />
                    <button type="submit" className="border-2 border-gray-200 hover:bg-gray-50 text-charcoal px-5 py-3 rounded-xl text-xs font-bold transition-colors">Add Server</button>
                 </form>
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-gray-100 p-8 space-y-6">
              <div>
                <h2 className="text-md font-bold text-red-600 flex items-center gap-2 pb-2">
                  <AlertOctagon className="w-5 h-5 text-red-500" /> Danger Zone
                </h2>
                <p className="text-xs text-red-950 font-extrabold pl-7">Permanently delete your entire workspace, API keys, parsing history, and candidate databases. This action is irreversible.</p>
              </div>
              <div className="border-t border-gray-100 pt-6">
                <button onClick={handleAccountDelete} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-md transition-colors w-full sm:w-auto">
                  Delete Workspace Permanently
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      <NewKeyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={refetch} />
    </div>
  );
}
