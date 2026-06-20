import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import PageTransition from '../components/PageTransition';
import { 
  Building2, 
  Key, 
  Bell, 
  User, 
  Copy, 
  Plus, 
  Trash2, 
  Upload, 
  X, 
  Check, 
  Lock 
} from 'lucide-react';

const googleColors = [
  '#1a73e8', // Google Blue
  '#ea4335', // Google Red
  '#f9ab00', // Google Yellow
  '#34a853', // Google Green
  '#673ab7', // Google Purple
  '#00acc1', // Google Cyan
  '#f4511e', // Google Orange
];

const getGoogleColor = (str) => {
  if (!str) return '#1a73e8';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % googleColors.length;
  return googleColors[idx];
};

const TABS = [
  { id: "profile", label: "Company profile", icon: Building2 },
  { id: "api-keys", label: "API keys", icon: Key },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: User },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { company, clearAuth } = useAuthStore();
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [logo, setLogo] = useState(company?.logo_path || localStorage.getItem('vish_company_logo') || '');
  
  const [activeTab, setActiveTab] = useState("profile");
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  
  // New key modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState('production');
  const [generatedKey, setGeneratedKey] = useState(null);

  const { data: keysData, refetch: refetchKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => authAPI.getKeys(),
    retry: false
  });

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image must be smaller than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo('');
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: companyName,
      };
      if (logo && logo.startsWith("data:")) {
        payload.logo = logo;
      } else if (!logo) {
        payload.logo = "";
      }
      
      const updatedData = await authAPI.updateProfile(payload);
      
      // Update store
      const currentCompany = useAuthStore.getState().company;
      useAuthStore.getState().setAuth({
        ...currentCompany,
        name: updatedData.name,
        logo_path: updatedData.logo_path
      });

      if (logo && logo.startsWith("data:")) {
        localStorage.setItem('vish_company_logo', logo);
      } else if (!logo) {
        localStorage.removeItem('vish_company_logo');
      }
      
      window.dispatchEvent(new Event('company_logo_updated'));
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error("Please enter a key name");
      return;
    }
    try {
      const res = await authAPI.generateKey({
        key_name: newKeyName,
        environment: newKeyEnv
      });
      setGeneratedKey(res);
      toast.success("API key generated successfully");
      setShowCreateModal(false);
      setNewKeyName('');
      refetchKeys();
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    } catch (err) {
      toast.error(err.message || "Failed to generate key");
    }
  };

  const handleCopyKey = (keyString, id) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKeyId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/admin/login");
  };

  const keys = Array.isArray(keysData) ? keysData : [];

  return (
    <PageTransition className="space-y-6">
      <header>
        <h1 className="font-display text-[22px] sm:text-[28px] text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account, API keys, and company profile.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Side tabs navigation */}
        <nav className="bg-card border border-border rounded-2xl p-2 h-fit space-y-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 h-11 px-3.5 rounded-full text-sm font-medium relative group transition-colors duration-200 ${
                  active 
                    ? "text-secondary-foreground font-display" 
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeSettingsTabBackground"
                    className="absolute inset-0 bg-secondary rounded-full -z-10 border border-primary/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon size={18} className={`transition-colors duration-200 ${active ? "text-secondary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span>
                  {t.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Panel wrapper */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                <Building2 size={18} className="text-primary" /> Company profile
              </h2>
              
              <div className="flex items-center gap-5">
                <div 
                  className="w-20 h-20 rounded-full border border-border flex items-center justify-center font-display text-3xl font-semibold text-white overflow-hidden shrink-0 relative group shadow-inner"
                  style={!logo ? { backgroundColor: getGoogleColor(company?.name) } : {}}
                >
                  {logo ? (
                    <>
                      <img src={logo.startsWith('/') && !logo.startsWith('data:') ? `http://127.0.0.1:8000${logo}` : logo} alt="Preview" className="w-full h-full object-cover rounded-full" />
                      <button 
                        type="button" 
                        onClick={handleRemoveLogo} 
                        className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
                        title="Remove logo"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    company?.name ? company.name[0].toUpperCase() : "C"
                  )}
                </div>
                <div>
                  <label className="cursor-pointer h-10 px-4 rounded-full border border-border text-sm font-medium hover:bg-muted transition inline-flex items-center justify-center gap-2">
                    <Upload size={14} /> Upload logo
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoChange} 
                      className="hidden" 
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">PNG, JPG or SVG up to 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Company name</span>
                  <input 
                    className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition mt-2 font-medium" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)} 
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Admin email</span>
                  <input 
                    className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-muted-foreground transition mt-2 font-medium" 
                    value={company?.email || 'N/A'} 
                    readOnly 
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Account tier</span>
                  <div className="mt-2">
                    <span className="inline-flex h-11 px-4 items-center rounded-xl bg-secondary text-secondary-foreground text-sm font-display font-medium uppercase tracking-wider text-[11px]">
                      {company?.tier || 'Free'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleSave} 
                  className="h-10 px-5 rounded-full bg-primary text-primary-foreground font-display font-medium text-sm shadow-google-1 hover:shadow-google-2 transition"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}

          {activeTab === "api-keys" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                  <Key size={18} className="text-primary" /> API keys
                </h2>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-display font-medium shadow-google-1 hover:shadow-google-2 transition"
                >
                  <Plus size={16} /> Create key
                </button>
              </div>

              {keys.length > 0 ? (
                <div className="border border-border rounded-2xl divide-y divide-border overflow-hidden">
                  {keys.map((k, i) => (
                    <div key={k.id || i} className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition">
                      <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                        <Key size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-[15px] text-foreground">{k.key_name || 'API Key'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                          {k.secret_key_masked || (k.secret_key ? `${k.secret_key.slice(0, 16)}••••••••${k.secret_key.slice(-4)}` : `${k.public_key?.slice(0, 16)}...`)}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        Created {k.created_at ? new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}
                      </span>
                      <button 
                        onClick={() => handleCopyKey(k.secret_key_masked || k.secret_key || k.public_key, k.id)}
                        className="w-9 h-9 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center transition"
                        title="Copy key"
                      >
                        {copiedKeyId === k.id ? <Check size={16} className="text-[color:var(--success)]" /> : <Copy size={16} />}
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm("Permanently revoke this API key? This cannot be undone.")) {
                            try {
                              await authAPI.deleteKey(k.id);
                              toast.success("API key revoked");
                              refetchKeys();
                              queryClient.invalidateQueries({ queryKey: ['api-keys'] });
                            } catch(e) { 
                              toast.error(e.message); 
                            }
                          }
                        }}
                        className="w-9 h-9 rounded-full hover:bg-muted text-destructive flex items-center justify-center transition"
                        title="Revoke key"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-12 bg-muted/40 rounded-2xl border border-dashed border-border">
                  <p className="font-semibold">No API keys generated yet.</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Generate a credential pair to authenticate your API connections.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                <Bell size={18} className="text-primary" /> Notifications
              </h2>
              <div className="divide-y divide-border">
                {[
                  { label: "New candidate applied", desc: "Get notified when a candidate joins a session.", defaultVal: true },
                  { label: "Weekly digest", desc: "A summary of activity across sessions.", defaultVal: false },
                  { label: "Fraud alerts", desc: "Immediate alert when a suspicious resume is flagged.", defaultVal: true },
                ].map((it, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 py-4">
                    <div>
                      <div className="font-display text-[15px] text-foreground">{it.label}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{it.desc}</div>
                    </div>
                    <ToggleSwitch defaultOn={it.defaultVal} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "account" && (
            <div className="space-y-6">
              <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                <User size={18} className="text-primary" /> Account
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Admin Full name</span>
                  <input className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition mt-2 font-medium" defaultValue={company?.name ? `${company.name} Administrator` : "Daksh Bhavsar"} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Email</span>
                  <input className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition mt-2 font-medium" defaultValue={company?.email || "admin@company.com"} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Role</span>
                  <input className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-muted-foreground transition mt-2 font-medium" defaultValue="Owner / Admin" readOnly />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Language</span>
                  <input className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition mt-2 font-medium" defaultValue="English (US)" />
                </label>
              </div>
              <div className="border-t border-border pt-5 flex justify-between items-center">
                <div>
                  <div className="font-display font-medium text-foreground">Sign out of workspace</div>
                  <div className="text-sm text-muted-foreground">You'll need to sign in again to access the dashboard.</div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="h-10 px-4 rounded-full border border-border text-sm font-medium text-destructive hover:bg-destructive/5 transition"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API KEY CREATION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-google-2 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-lg text-foreground">Create New API Key</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Generate credentials for your external client calls.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Key Name</span>
                <input 
                  type="text" 
                  placeholder="e.g. Production Client, Staging Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition mt-2 font-medium"
                  required
                />
              </label>

              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Environment</span>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv('production')}
                    className={`h-11 rounded-xl border text-sm font-medium transition ${
                      newKeyEnv === 'production' 
                        ? 'border-primary bg-secondary text-primary font-semibold shadow-[inset_0_0_0_1px_var(--primary)]' 
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Production
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv('test')}
                    className={`h-11 rounded-xl border text-sm font-medium transition ${
                      newKeyEnv === 'test' 
                        ? 'border-primary bg-secondary text-primary font-semibold shadow-[inset_0_0_0_1px_var(--primary)]' 
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Test / Sandbox
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 px-4 rounded-full border border-border hover:bg-muted text-sm font-medium text-muted-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-full bg-primary text-primary-foreground font-display font-medium text-sm shadow-google-1 hover:shadow-google-2 transition"
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATED KEY SUCCESS MODAL */}
      {generatedKey && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-google-2 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-lg text-foreground font-semibold">Save your API Key</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Please copy this secret key now. It will not be shown again.</p>
              </div>
              <button 
                onClick={() => setGeneratedKey(null)}
                className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-xl space-y-3 font-mono text-xs select-all break-all border border-border text-foreground">
                <div>
                  <span className="text-muted-foreground select-none">Name:</span> {generatedKey.key_name}
                </div>
                <div>
                  <span className="text-muted-foreground select-none">Secret Key:</span> <span className="font-semibold text-primary">{generatedKey.secret_key}</span>
                </div>
                <div>
                  <span className="text-muted-foreground select-none">Public Key:</span> {generatedKey.public_key}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey.secret_key);
                    toast.success("Secret key copied!");
                  }}
                  className="h-10 px-4 rounded-full border border-primary hover:bg-secondary text-primary text-sm font-medium transition flex items-center gap-1.5"
                >
                  <Copy size={14} /> Copy Secret Key
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedKey(null)}
                  className="h-10 px-5 rounded-full bg-primary text-primary-foreground font-display font-medium text-sm shadow-google-1 hover:shadow-google-2 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function ToggleSwitch({ defaultOn }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      className={`w-12 h-7 rounded-full p-0.5 transition shrink-0 ${on ? "bg-primary" : "bg-muted border border-border"}`}
    >
      <span className={`block w-6 h-6 bg-card rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0 border border-border/20"}`} />
    </button>
  );
}
