import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seekerAPI, publicAPI } from '../../lib/api';
import { useSeekerAuthStore } from '../../stores/seekerAuthStore';
import { 
  UploadCloud, FileText, CheckCircle2, X, Plus, 
  Trash2, ArrowRight, ArrowLeft, Loader2, Sparkles,
  MapPin, Briefcase, GraduationCap, Award, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobSeekerRegisterPage() {
  const navigate = useNavigate();
  const setAuth = useSeekerAuthStore(s => s.setAuth);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Form State
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    location: '',
    headline: '',
    phone: ''
  });

  // Resume Upload Info
  const [tempFilePath, setTempFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSizeKb, setFileSizeKb] = useState(0);
  const [totalExpYears, setTotalExpYears] = useState(0);

  // Step 3 Review lists
  const [experience, setExperience] = useState([]);
  const [education, setEducation] = useState([]);
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');

  // Step 4 Preferences
  const [workTypes, setWorkTypes] = useState(['Remote', 'Hybrid']);
  const [preferredLocations, setPreferredLocations] = useState([]);
  const [newLocation, setNewLocation] = useState('');
  const [roleTypes, setRoleTypes] = useState(['Engineering']);

  const ROLE_OPTIONS = [
    'Engineering', 'Product Design', 'Design Leadership', 
    'Product Management', 'Data Science', 'Marketing', 'Sales', 'Finance'
  ];

  const WORK_TYPE_OPTIONS = ['Remote', 'Hybrid', 'On-site'];

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  // Form step controls
  const handleStep1 = (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setStep(2);
  };

  // Drag & drop file handler
  const [dragActive, setDragActive] = useState(false);
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileParsing(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileParsing(e.target.files[0]);
    }
  };

  const handleFileParsing = async (file) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt'];
    const isAllowed = allowed.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isAllowed) {
      toast.error('Please upload a PDF, DOCX, DOC, or TXT file');
      return;
    }

    setParsing(true);
    const toastId = toast.loading('Uploading and parsing resume with AI...');
    try {
      const data = await publicAPI.parseResume(file);
      toast.success('Resume parsed successfully!', { id: toastId });
      
      // Auto pre-fill Step 3 state
      setTempFilePath(data.temp_file_path);
      setFileName(data.file_name);
      setFileSizeKb(data.file_size_kb);
      setTotalExpYears(data.total_experience_years || 0);

      setForm(prev => ({
        ...prev,
        full_name: data.name || prev.full_name,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        location: data.location || prev.location,
        headline: data.headline || prev.headline
      }));

      // Map parsed experience & education
      const expList = (data.experience || []).map(x => ({
        role: x.role || x.job_title || '',
        company: x.company || '',
        duration: x.duration || x.dates || '',
        description: x.description || ''
      }));
      setExperience(expList);

      const eduList = (data.education || []).map(ed => ({
        degree: ed.degree || '',
        school: ed.school || ed.institution || '',
        year: ed.year || ''
      }));
      setEducation(eduList);

      setSkills(data.skills || []);
      setStep(3);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Parsing failed. You can fill details manually.', { id: toastId });
      setStep(3); // Let them fill details manually
    } finally {
      setParsing(false);
    }
  };

  // Step 3 Actions (Add/Delete Experience, Education, Skills)
  const addExperience = () => {
    setExperience(prev => [...prev, { role: '', company: '', duration: '', description: '' }]);
  };

  const updateExperience = (idx, field, value) => {
    setExperience(prev => prev.map((x, i) => i === idx ? { ...x, [field]: value } : x));
  };

  const removeExperience = (idx) => {
    setExperience(prev => prev.filter((_, i) => i !== idx));
  };

  const addEducation = () => {
    setEducation(prev => [...prev, { degree: '', school: '', year: '' }]);
  };

  const updateEducation = (idx, field, value) => {
    setEducation(prev => prev.map((x, i) => i === idx ? { ...x, [field]: value } : x));
  };

  const removeEducation = (idx) => {
    setEducation(prev => prev.filter((_, i) => i !== idx));
  };

  const getSkillName = (s) => {
    if (typeof s === 'object' && s !== null) {
      return s.canonical_skill || s.raw_skill || s.skill || '';
    }
    return String(s || '');
  };

  const addSkill = (e) => {
    e.preventDefault();
    const clean = newSkill.trim();
    if (clean) {
      const exists = skills.some(s => getSkillName(s).toLowerCase() === clean.toLowerCase());
      if (!exists) {
        setSkills(prev => [...prev, { canonical_skill: clean }]);
        setNewSkill('');
      }
    }
  };

  const removeSkill = (tag) => {
    setSkills(prev => prev.filter(s => getSkillName(s) !== getSkillName(tag)));
  };

  // Step 4 Actions (Add Location tag, Toggle role, Toggle worktype)
  const addLocationTag = (e) => {
    e.preventDefault();
    if (newLocation.trim() && !preferredLocations.includes(newLocation.trim())) {
      setPreferredLocations(prev => [...prev, newLocation.trim()]);
      setNewLocation('');
    }
  };

  const removeLocationTag = (loc) => {
    setPreferredLocations(prev => prev.filter(l => l !== loc));
  };

  const toggleWorkType = (wt) => {
    setWorkTypes(prev => prev.includes(wt) ? prev.filter(w => w !== wt) : [...prev, wt]);
  };

  const toggleRoleType = (role) => {
    setRoleTypes(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  // Final Registration Submit
  const handleRegister = async () => {
    setLoading(true);
    try {
      const payload = {
        name: form.full_name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        location: form.location,
        headline: form.headline,
        skills: skills,
        experience: experience,
        education: education,
        openTo: {
          workTypes: workTypes,
          locations: preferredLocations,
          roleTypes: roleTypes
        },
        temp_file_path: tempFilePath,
        file_name: fileName,
        file_size_kb: fileSizeKb,
        total_experience_years: totalExpYears
      };

      const data = await seekerAPI.register(payload);
      setAuth(data);
      localStorage.setItem('vish_seeker_token', data.seeker_token);
      localStorage.setItem('vish_seeker_data', JSON.stringify(data.seeker));
      toast.success('Profile created successfully! Welcome to Workly 🎉');
      navigate('/profile');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
      {/* Left panel */}
      <div className="md:w-96 bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] text-white p-8 md:p-12 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-primary text-xl font-bold">W</div>
            <span className="font-display text-xl font-semibold tracking-tight">workly</span>
          </div>
          <div className="space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
              Start your <br />
              <span className="text-blue-200">job search</span> <br />
              smarter
            </h1>
            <p className="text-blue-100 text-sm leading-relaxed">
              Join thousands of job seekers who leverage automated AI resume parsing and smart match scores to land roles faster.
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="mt-12 space-y-6">
          {[
            { s: 1, name: 'Account Details' },
            { s: 2, name: 'Resume Upload' },
            { s: 3, name: 'Review Parsed Info' },
            { s: 4, name: 'Preferences' }
          ].map(x => (
            <div key={x.s} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                step === x.s 
                  ? 'bg-white text-primary border-white shadow-md' 
                  : step > x.s 
                    ? 'bg-blue-600 border-blue-600 text-blue-100' 
                    : 'bg-transparent border-blue-400 text-blue-300'
              }`}>
                {step > x.s ? '✓' : x.s}
              </div>
              <span className={`text-sm font-medium ${step === x.s ? 'text-white' : 'text-blue-200'}`}>
                {x.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel (Wizard Steps) */}
      <div className="flex-1 bg-slate-50 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          
          {/* Step 1: Account details */}
          {step === 1 && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Create your account</h2>
                <p className="text-slate-500 text-sm mt-1">Get started by entering your basic credentials</p>
              </div>

              <form onSubmit={handleStep1} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                    <input 
                      type="text" placeholder="Daksh Bhavsar" value={form.full_name} onChange={set('full_name')} required
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">City / Location *</label>
                    <input 
                      type="text" placeholder="Ahmedabad, India" value={form.location} onChange={set('location')} required
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address *</label>
                  <input 
                    type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
                    <input 
                      type="text" placeholder="+91 9876543210" value={form.phone} onChange={set('phone')}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Job Title (e.g. Senior Designer)</label>
                    <input 
                      type="text" placeholder="e.g. UI/UX Designer" value={form.headline} onChange={set('headline')}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password *</label>
                  <input 
                    type="password" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-primary text-primary-foreground hover:opacity-90 rounded-xl font-semibold text-sm mt-6 flex items-center justify-center gap-2 transition"
                >
                  Continue to Resume <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="text-center text-xs text-slate-500 mt-6 pt-4 border-t border-slate-100">
                Already have an account? <Link to="/jobs/login" className="text-primary font-bold hover:underline">Sign in</Link>
              </div>
            </div>
          )}

          {/* Step 2: Resume upload & parsing */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Upload your resume</h2>
                <p className="text-slate-500 text-sm mt-1">One file parses your skills & experience automatically</p>
              </div>

              {parsing ? (
                <div className="p-12 text-center flex flex-col items-center justify-center bg-blue-50/50 border border-blue-100 rounded-3xl">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <Sparkles className="h-5 w-5 text-amber-500 animate-bounce mb-2" />
                  <h3 className="font-semibold text-slate-800">Parsing your resume...</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">Our AI agents are analyzing your experience, extracting skills, and building your profile.</p>
                </div>
              ) : (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-12 text-center transition flex flex-col items-center justify-center ${
                    dragActive 
                      ? 'border-primary bg-primary/5' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-lg">Drag & drop your resume file</h3>
                  <p className="text-slate-500 text-xs mt-1">Accepts PDF, DOCX, DOC, or TXT up to 10MB</p>
                  
                  <label className="pill bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-xl cursor-pointer hover:opacity-90 transition mt-6 inline-flex items-center gap-1.5">
                    <UploadCloud className="h-4 w-4" /> Browse Files
                    <input 
                      type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileChange} className="hidden" 
                    />
                  </label>

                  <button 
                    onClick={() => setStep(3)} 
                    className="text-xs text-slate-500 hover:text-slate-700 underline mt-8"
                  >
                    Skip & fill details manually
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 mt-6">
                <button 
                  onClick={() => setStep(1)} 
                  className="pill border border-slate-200 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review parsed details */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Review your profile details</h2>
                <p className="text-slate-500 text-sm mt-1">Tweak the AI-extracted details before creating your profile</p>
              </div>

              {/* Personal Details pre-fill review */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Personal Info</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Full Name</label>
                    <input 
                      type="text" value={form.full_name} onChange={set('full_name')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Location</label>
                    <input 
                      type="text" value={form.location} onChange={set('location')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Headline / Current Title</label>
                  <input 
                    type="text" value={form.headline} onChange={set('headline')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                  />
                </div>
              </div>

              {/* Experience list review */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Experience</h3>
                  <button 
                    onClick={addExperience}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Experience
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {experience.map((x, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-2xl p-4 relative space-y-2 bg-slate-50/20">
                      <button 
                        onClick={() => removeExperience(idx)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Role / Job Title</label>
                          <input 
                            type="text" value={x.role} onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Company</label>
                          <input 
                            type="text" value={x.company} onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Duration / Dates</label>
                          <input 
                            type="text" placeholder="e.g. 2020 - Present" value={x.duration} onChange={(e) => updateExperience(idx, 'duration', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Description</label>
                          <textarea 
                            value={x.description} onChange={(e) => updateExperience(idx, 'description', e.target.value)} rows={1}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {experience.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-2xl">No experience listed. Click Add to insert.</p>
                  )}
                </div>
              </div>

              {/* Education list review */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Education</h3>
                  <button 
                    onClick={addEducation}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Education
                  </button>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {education.map((ed, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-2xl p-4 relative space-y-2 bg-slate-50/20">
                      <button 
                        onClick={() => removeEducation(idx)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Degree / Program</label>
                          <input 
                            type="text" value={ed.degree} onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Year</label>
                          <input 
                            type="text" placeholder="e.g. 2020" value={ed.year} onChange={(e) => updateEducation(idx, 'year', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">School / Institution</label>
                        <input 
                          type="text" value={ed.school} onChange={(e) => updateEducation(idx, 'school', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                        />
                      </div>
                    </div>
                  ))}
                  {education.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-2xl">No education listed. Click Add to insert.</p>
                  )}
                </div>
              </div>

              {/* Skills list review */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Skills</h3>
                <form onSubmit={addSkill} className="flex gap-2">
                  <input 
                    type="text" placeholder="Type a skill (e.g. Figma, Python) and press Enter" value={newSkill} onChange={e => setNewSkill(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                  />
                  <button type="submit" className="pill bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 rounded-xl text-xs font-semibold">
                    Add
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {skills.map((s, idx) => {
                    const name = getSkillName(s);
                    if (!name) return null;
                    return (
                      <span key={idx} className="pill bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-700 flex items-center gap-1 rounded-lg">
                        {name}
                        <button type="button" onClick={() => removeSkill(s)} className="text-slate-400 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  {skills.length === 0 && <p className="text-xs text-slate-400">No skills added yet.</p>}
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-8">
                <button 
                  onClick={() => setStep(2)} 
                  className="pill border border-slate-200 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="pill bg-primary text-primary-foreground hover:opacity-90 px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                >
                  Next: Preferences <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Job seeker preferences */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Job Preferences</h2>
                <p className="text-slate-500 text-sm mt-1">Let teams know what opportunities you are open to</p>
              </div>

              {/* Work Types checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Open to work types</label>
                <div className="flex flex-wrap gap-3">
                  {WORK_TYPE_OPTIONS.map((wt) => {
                    const checked = workTypes.includes(wt);
                    return (
                      <button
                        key={wt}
                        type="button"
                        onClick={() => toggleWorkType(wt)}
                        className={`pill px-4 py-2 text-xs font-semibold border rounded-xl transition ${
                          checked
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {wt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Role Types select */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Preferred roles areas</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((role) => {
                    const checked = roleTypes.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRoleType(role)}
                        className={`pill px-3 py-2 text-xs font-medium border rounded-xl text-left transition ${
                          checked
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Locations tags */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred locations</label>
                <form onSubmit={addLocationTag} className="flex gap-2">
                  <input 
                    type="text" placeholder="Type a city (e.g. Bangalore, London) and press Enter" value={newLocation} onChange={e => setNewLocation(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                  />
                  <button type="submit" className="pill bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 rounded-xl text-xs font-semibold">
                    Add
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {preferredLocations.map((loc, idx) => (
                    <span key={idx} className="pill bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-700 flex items-center gap-1 rounded-lg">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      {loc}
                      <button type="button" onClick={() => removeLocationTag(loc)} className="text-slate-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {preferredLocations.length === 0 && <p className="text-xs text-slate-400">No preferred locations added. Defaults to Anywhere.</p>}
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-8">
                <button 
                  onClick={() => setStep(3)} 
                  disabled={loading}
                  className="pill border border-slate-200 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button 
                  onClick={handleRegister}
                  disabled={loading}
                  className="pill bg-primary text-primary-foreground hover:opacity-90 px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating Profile...
                    </>
                  ) : (
                    <>
                      Complete Setup & Sign In
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
