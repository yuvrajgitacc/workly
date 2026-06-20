import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle, Copy, Check, Sparkles, AlertCircle, Building2, ArrowRight, ArrowLeft, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { authAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

const INDUSTRIES = [
  "Technology", "Healthcare", "Finance", "Education", "E-commerce",
  "Manufacturing", "Consulting", "Media", "Real Estate", "Energy",
  "Transportation", "Agriculture", "Legal", "Non-profit", "Other"
];

const COMPANY_SIZES = [
  "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"
];

export default function RegisterPage() {
  const [step, setStep] = useState(1); // 1: Credentials, 2: Company Profile, 3: API Keys
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
    // Company profile fields
    industry: "",
    hq_location: "",
    company_size: "",
    founded_year: "",
    website_url: "",
    about: "",
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKeys, setApiKeys] = useState(null);
  
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [savedKeys, setSavedKeys] = useState(false);
  
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const jwt = localStorage.getItem("vish_jwt");
    if (jwt) {
      navigate("/admin/dashboard");
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData(s => ({ ...s, [e.target.name]: e.target.value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const calculateStrength = (pass) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/\d/.test(pass)) score++;
    if (/[!@#$%^&*]/.test(pass)) score++;
    return score;
  };

  const getStrengthColor = (score) => {
    if (score === 0) return "bg-gray-200";
    if (score === 1) return "bg-red-500";
    if (score === 2) return "bg-amber-500";
    return "bg-green-500";
  };

  const getStrengthLabel = (score) => {
    if (score === 0) return "";
    if (score === 1) return "Weak";
    if (score === 2) return "Fair";
    return "Strong";
  };

  const handleCredentialsNext = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Build multipart/form-data if logo exists, otherwise JSON
      if (logoFile) {
        const fd = new FormData();
        fd.append("name", formData.companyName);
        fd.append("email", formData.email);
        fd.append("password", formData.password);
        fd.append("industry", formData.industry);
        fd.append("hq_location", formData.hq_location);
        fd.append("company_size", formData.company_size);
        if (formData.founded_year) fd.append("founded_year", formData.founded_year);
        fd.append("website_url", formData.website_url);
        fd.append("about", formData.about);
        fd.append("logo", logoFile);
        
        // Direct fetch for multipart
        const res = await fetch("http://127.0.0.1:8000/api/v1/auth/register", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Registration failed");
        setApiKeys(data.data);
      } else {
        const payload = {
          name: formData.companyName,
          email: formData.email,
          password: formData.password,
          industry: formData.industry,
          hq_location: formData.hq_location,
          company_size: formData.company_size,
          founded_year: formData.founded_year || null,
          website_url: formData.website_url,
          about: formData.about,
        };
        const res = await authAPI.register(payload);
        setApiKeys(res);
      }
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else if (type === 'public') {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    }
  };

  const handleCopyBoth = () => {
    const text = `Secret Key: ${apiKeys?.secret_key}\nPublic Key: ${apiKeys?.api_key || apiKeys?.public_key}`;
    navigator.clipboard.writeText(text);
    toast.success("Both keys copied!");
  };

  const goToDashboard = () => {
    if (!savedKeys) return;
    if (apiKeys) {
      setAuth(apiKeys);
      localStorage.setItem("vish_jwt", apiKeys.jwt_token);
      localStorage.setItem("vish_api_key", apiKeys.api_key || "");
      localStorage.setItem("vish_company", JSON.stringify(apiKeys));
    }
    navigate("/admin/dashboard");
  };

  const strengthScore = calculateStrength(formData.password);

  // Step indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
            step >= s
              ? 'bg-accent text-white'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {step > s ? <Check size={16} /> : s}
          </div>
          {s < 3 && (
            <div className={`w-8 h-0.5 ${step > s ? 'bg-accent' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream py-12">
      <div className="bg-white p-12 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] w-[520px] max-w-[90vw]">
        
        <StepIndicator />

        {/* Step 1: Credentials */}
        {step === 1 && (
          <>
            <div className="text-center mb-8">
              <span className="text-accent text-3xl font-bold tracking-tight">
                Vishleshan
              </span>
              <h1 className="text-xl font-semibold text-charcoal mt-4">Create your account</h1>
              <p className="text-muted text-sm mt-1">Start hiring smarter with AI</p>
            </div>

            <form onSubmit={handleCredentialsNext} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Company Name</label>
                <input
                  type="text" name="companyName" value={formData.companyName} onChange={handleChange}
                  className="w-full p-3 border-[1.5px] border-gray-200 rounded-lg text-[15px] focus:border-accent focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Work Email</label>
                <input
                  type="email" name="email" value={formData.email} onChange={handleChange}
                  className="w-full p-3 border-[1.5px] border-gray-200 rounded-lg text-[15px] focus:border-accent focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} name="password"
                    value={formData.password} onChange={handleChange}
                    className="w-full p-3 border-[1.5px] border-gray-200 rounded-lg text-[15px] focus:border-accent focus:outline-none transition-colors pr-12"
                    required
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                
                {formData.password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${getStrengthColor(strengthScore)} transition-all duration-300`} style={{width: `${(strengthScore/3)*100}%`}}></div>
                    </div>
                    <span className={`text-xs ${strengthScore === 3 ? 'text-green-600' : 'text-gray-500'}`}>
                      {getStrengthLabel(strengthScore)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Confirm Password</label>
                <input
                  type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                  className="w-full p-3 border-[1.5px] border-gray-200 rounded-lg text-[15px] focus:border-accent focus:outline-none transition-colors"
                  required
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                className="w-full h-12 mt-6 bg-accent hover:bg-[#1D4ED8] text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                Next: Company Profile <ArrowRight size={18} />
              </button>
            </form>

            <div className="text-center text-sm text-charcoal mt-6">
              Already have an account?{" "}
              <a href="/admin/login" className="text-accent font-medium hover:underline">Sign in &rarr;</a>
            </div>
          </>
        )}

        {/* Step 2: Company Profile */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="text-center mb-6">
              <Building2 className="mx-auto text-accent mb-2" size={32} />
              <h2 className="text-xl font-semibold text-charcoal">Company Profile</h2>
              <p className="text-muted text-sm mt-1">Help candidates learn about your company</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Industry</label>
                  <select
                    name="industry" value={formData.industry} onChange={handleChange}
                    className="w-full p-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-accent focus:outline-none bg-white"
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Company Size</label>
                  <select
                    name="company_size" value={formData.company_size} onChange={handleChange}
                    className="w-full p-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-accent focus:outline-none bg-white"
                  >
                    <option value="">Select size</option>
                    {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">HQ Location</label>
                  <input
                    type="text" name="hq_location" value={formData.hq_location} onChange={handleChange}
                    placeholder="e.g. San Francisco, CA"
                    className="w-full p-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Founded Year</label>
                  <input
                    type="number" name="founded_year" value={formData.founded_year} onChange={handleChange}
                    placeholder="e.g. 2015"
                    min="1800" max={new Date().getFullYear()}
                    className="w-full p-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Website</label>
                <input
                  type="url" name="website_url" value={formData.website_url} onChange={handleChange}
                  placeholder="https://your-company.com"
                  className="w-full p-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">About</label>
                <textarea
                  name="about" value={formData.about} onChange={handleChange}
                  placeholder="Tell candidates what makes your company special..."
                  rows={3}
                  className="w-full p-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-accent focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Company Logo</label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                      <Building2 size={20} />
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 border-[1.5px] border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-accent hover:text-accent cursor-pointer transition-colors">
                    <Upload size={16} />
                    {logoFile ? logoFile.name : "Upload logo"}
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(""); }}
                  className="flex-1 h-12 border-2 border-gray-200 text-charcoal rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 hover:bg-gray-50"
                >
                  <ArrowLeft size={18} /> Back
                </button>
                <button
                  type="submit" disabled={loading}
                  className="flex-[2] h-12 bg-accent hover:bg-[#1D4ED8] text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <><Loader2 className="animate-spin" size={20} /> Creating...</> : <>Create Account <ArrowRight size={18} /></>}
                </button>
              </div>
            </form>

            <p className="text-center text-xs text-muted mt-4">
              All fields are optional — you can update them later in settings.
            </p>
          </motion.div>
        )}

        {/* Step 3: API Keys */}
        {step === 3 && (
          <div className="flex flex-col">
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="flex justify-center mb-4 text-green-500"
            >
              <CheckCircle size={64} />
            </motion.div>
            
            <h2 className="text-2xl font-bold text-center text-charcoal mb-6 flex items-center justify-center gap-2">
              <span>Account Created!</span>
              <Sparkles className="text-amber-500" size={24} />
            </h2>
            
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6 flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p>Save your API keys now — they will never be shown again after you leave this page.</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5 flex justify-between">
                  <span>Secret Key (keep private)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type={showSecretKey ? "text" : "password"}
                    readOnly
                    value={apiKeys?.secret_key || "vish_live_secretkey"}
                    className="flex-1 p-2 border-[1.5px] border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none font-mono"
                  />
                  <button onClick={() => setShowSecretKey(!showSecretKey)} className="px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
                    {showSecretKey ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => handleCopy(apiKeys?.secret_key, 'secret')} className="px-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-sm font-medium flex items-center gap-1 min-w-[90px] justify-center">
                    {copiedSecret ? <><Check size={16}/> Copied!</> : <><Copy size={16}/> Copy</>}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Public Key (safe for frontend)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={apiKeys?.api_key || apiKeys?.public_key || "vish_pub_publickey"}
                    className="flex-1 p-2 border-[1.5px] border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none font-mono"
                  />
                  <button onClick={() => handleCopy(apiKeys?.api_key || apiKeys?.public_key, 'public')} className="px-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-sm font-medium flex items-center gap-1 min-w-[90px] justify-center">
                    {copiedPublic ? <><Check size={16}/> Copied!</> : <><Copy size={16}/> Copy</>}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyBoth}
              className="w-full py-2 mb-6 border-2 border-accent text-accent font-medium rounded-lg hover:bg-blue-50 transition-colors"
            >
              Copy Both Keys
            </button>

            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input 
                type="checkbox" 
                checked={savedKeys}
                onChange={(e) => setSavedKeys(e.target.checked)}
                className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent accent-[#2563EB]"
              />
              <span className="text-sm font-medium text-charcoal">✓ I have saved my API keys securely</span>
            </label>

            <button
              onClick={goToDashboard}
              disabled={!savedKeys}
              className="w-full h-12 bg-accent hover:bg-[#1D4ED8] text-white rounded-lg font-semibold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go to Dashboard &rarr;
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
