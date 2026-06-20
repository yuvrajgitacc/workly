import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, GripVertical, Plus, ArrowRight, ArrowLeft, Loader2, Save, Sparkles, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sessionsAPI } from '../lib/api';
import PageTransition from '../components/PageTransition';

const TagInput = ({ tags, onChange, placeholder, tagColor }) => {
  const [input, setInput] = useState("");
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.trim();
      if (val && !tags.includes(val)) {
        onChange([...tags, val]);
      }
      setInput("");
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const getPillColor = () => {
    switch(tagColor) {
      case 'amber': return 'bg-amber-50 text-[color:var(--warning)] border-amber-200';
      case 'blue': return 'bg-secondary text-primary border-primary/20';
      case 'gray': default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="w-full flex flex-wrap items-center gap-2 p-2 border border-border rounded-xl bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/25 transition">
      {tags.map((tag, idx) => (
        <div key={idx} className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[13px] font-medium ${getPillColor()}`}>
          {tag}
          <button type="button" onClick={() => removeTag(idx)} className="hover:opacity-70 ml-1 focus:outline-none shrink-0">
            <X size={12} />
          </button>
        </div>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : "Add more..."}
        className="flex-1 min-w-[120px] bg-transparent focus:outline-none text-[13px] text-foreground py-1 placeholder:text-muted-foreground"
      />
    </div>
  );
};

const isAdvancedJD = (text) => {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 250) return false;
  
  const lower = trimmed.toLowerCase();
  
  const sections = [
    'experience',
    'skills',
    'requirements',
    'responsibilities',
    'about',
    'role',
    'qualification',
    'what you',
    'looking for',
    'must have',
    'nice to have',
    'tech stack'
  ];
  
  const matchedSections = sections.filter(sec => lower.includes(sec));
  
  const lines = trimmed.split('\n');
  const hasBulletPoints = lines.some(line => {
    const t = line.trim();
    return t.startsWith('-') || t.startsWith('*') || t.startsWith('•') || /^\d+\./.test(t);
  });
  
  return matchedSections.length >= 3 && (hasBulletPoints || lines.length > 6);
};

export default function NewSessionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: "", job_title: "", job_description: "",
    required_skills: [], nice_to_have: [],
    preferred_locations: [], min_experience: 0,
    min_match_score: 60,
    weights: { skills: 0.5, experience: 0.3, location: 0.2 },
    rounds: [
      { id: 1, name: "Screening Round", interviewer: "", order: 1 },
      { id: 2, name: "Technical Round", interviewer: "", order: 2 },
      { id: 3, name: "HR Round", interviewer: "", order: 3 }
    ],
    salary_range: "Competitive",
    location: "Remote",
    employment_type: "Full-time"
  });

  const [inferredData, setInferredData] = useState(null);
  const [lastAnalyzedJD, setLastAnalyzedJD] = useState("");
  const [inferring, setInferring] = useState(false);
  const [creating, setCreating] = useState(false);

  const autoInfer = async (jdText) => {
    if (!jdText) return;
    setInferring(true);
    try {
      let currentSessionId = inferredData?.session_id;
      
      if (!currentSessionId) {
        const session = await sessionsAPI.create({
          name: formData.name || "Draft Session",
          job_title: formData.job_title || "Draft",
          job_description: jdText,
          rounds: formData.rounds
        });
        currentSessionId = session.id;
      } else {
        await sessionsAPI.update(currentSessionId, {
          job_description: jdText
        });
      }
      
      const inferred = await sessionsAPI.inferSkills(currentSessionId, {
        job_description: jdText
      });
      
      setInferredData({ ...inferred, session_id: currentSessionId });
      setLastAnalyzedJD(jdText);
      
      setFormData(prev => {
        const title = inferred.inferred_role || prev.job_title || "Draft";
        const name = prev.name || `${title} Session`;
        return {
          ...prev,
          name,
          job_title: title,
          required_skills: inferred.required_skills || [],
          nice_to_have: inferred.nice_to_have_skills || [],
          preferred_locations: inferred.preferred_locations || [],
          min_experience: inferred.minimum_experience_years || 0,
          salary_range: inferred.salary_range || prev.salary_range || "Competitive",
          location: inferred.location || (inferred.preferred_locations && inferred.preferred_locations[0]) || prev.location || "Remote",
          employment_type: inferred.employment_type || prev.employment_type || "Full-time"
        };
      });
      toast.success("AI job description analysis complete!");
    } catch (e) {
      toast.error(e.message || "Failed to analyze Job Description");
    } finally {
      setInferring(false);
    }
  };

  const handleInfer = async () => {
    if (!formData.job_description) {
      toast.error("Please provide a job description to analyze");
      return;
    }
    await autoInfer(formData.job_description);
  };

  useEffect(() => {
    const jd = formData.job_description;

    if (!jd || !jd.trim()) {
      setFormData(prev => ({
        ...prev,
        name: "",
        job_title: "",
        required_skills: [],
        nice_to_have: [],
        preferred_locations: [],
        min_experience: 0
      }));
      setInferredData(null);
      setLastAnalyzedJD("");
      return;
    }

    if (!isAdvancedJD(jd)) {
      return;
    }

    if (jd === lastAnalyzedJD) {
      return;
    }

    const timer = setTimeout(() => {
      autoInfer(jd);
    }, 1500);

    return () => clearTimeout(timer);
  }, [formData.job_description, lastAnalyzedJD]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      let currentSessionId = inferredData?.session_id;
      
      const sessionPayload = {
        name: formData.name,
        job_title: formData.job_title,
        job_description: formData.job_description,
        rounds: formData.rounds,
        salary_range: formData.salary_range,
        location: formData.location,
        employment_type: formData.employment_type
      };
      
      if (currentSessionId) {
        await sessionsAPI.update(currentSessionId, sessionPayload);
      } else {
        const session = await sessionsAPI.create(sessionPayload);
        currentSessionId = session.id;
      }
      
      await sessionsAPI.setCriteria(currentSessionId, {
        required_skills: formData.required_skills,
        nice_to_have: formData.nice_to_have,
        preferred_locations: formData.preferred_locations,
        min_experience: formData.min_experience,
        min_match_score: formData.min_match_score,
        weights: formData.weights
      });
      
      toast.success("Session created successfully!");
      navigate(`/admin/dashboard/sessions/${currentSessionId}`);
    } catch (err) {
      toast.error(err.message || "Failed to create session");
      setCreating(false);
    }
  };

  const handleSliderChange = (e) => {
    setFormData({ ...formData, min_match_score: parseInt(e.target.value) });
  };

  const handleWeightChange = (key, value) => {
    const val = parseFloat(value);
    const others = Object.keys(formData.weights).filter(k => k !== key);
    
    const w = { ...formData.weights };
    const oldVal = w[key];
    const diff = val - oldVal;
    
    w[key] = val;
    
    if (diff !== 0) {
      const sumOthers = others.reduce((acc, k) => acc + w[k], 0);
      if (sumOthers > 0) {
        others.forEach(k => {
          w[k] = Math.max(0, w[k] - diff * (w[k] / sumOthers));
        });
      } else {
        w[others[0]] = Math.max(0, 1 - val) / 2;
        w[others[1]] = Math.max(0, 1 - val) / 2;
      }
    }
    
    setFormData({ ...formData, weights: w });
  };

  const weightsSum = Object.values(formData.weights).reduce((a, b) => a + b, 0);

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: "Job Details" },
      { num: 2, label: "Criteria" },
      { num: 3, label: "Rounds" }
    ];

    return (
      <div className="flex items-center justify-center max-w-md mx-auto w-full relative mb-8">
        <div className="absolute top-[21px] left-10 right-10 h-[2px] bg-border -z-0"></div>
        {steps.map((s, idx) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          
          return (
            <div key={idx} className="flex flex-col items-center flex-1 relative z-10">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition ${
                isActive ? "bg-primary text-primary-foreground shadow-google-1" :
                isDone ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground border border-border"
              }`}>
                {isDone ? <Check size={16} /> : s.num}
              </div>
              <span className={`text-[11px] font-display font-medium uppercase tracking-[0.1em] mt-2 ${
                isActive ? "text-primary font-bold" : isDone ? "text-foreground" : "text-muted-foreground"
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-[18px] font-bold text-foreground">Tell us about the role</h2>
              <p className="text-xs text-muted-foreground">Provide basic details or paste a job description for AI requirements discovery.</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Session Name*</span>
                <input
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Senior Backend Recruitment - Q2"
                  className="w-full h-11 px-4 mt-2 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition font-medium"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Job Title*</span>
                <input
                  type="text" 
                  value={formData.job_title} 
                  onChange={e => setFormData({...formData, job_title: e.target.value})}
                  placeholder="e.g. Senior Node.js Developer"
                  className="w-full h-11 px-4 mt-2 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition font-medium"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Job Description*</span>
                <textarea
                  value={formData.job_description} 
                  onChange={e => setFormData({...formData, job_description: e.target.value})}
                  placeholder="Paste the requirements, role description, and guidelines here..."
                  rows={8}
                  className="w-full p-3.5 mt-2 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition resize-y font-medium"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Salary Range</span>
                  <input
                    type="text" 
                    value={formData.salary_range} 
                    onChange={e => setFormData({...formData, salary_range: e.target.value})}
                    placeholder="e.g. ₹18-32 LPA, $100k - $120k"
                    className="w-full h-11 px-4 mt-2 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition font-medium"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Location</span>
                  <input
                    type="text" 
                    value={formData.location} 
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g. Remote, Bengaluru"
                    className="w-full h-11 px-4 mt-2 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition font-medium"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Employment Type</span>
                  <select
                    value={formData.employment_type} 
                    onChange={e => setFormData({...formData, employment_type: e.target.value})}
                    className="w-full h-11 px-4 mt-2 rounded-xl bg-muted border border-transparent focus:bg-card focus:border-primary focus:outline-none text-sm text-foreground transition font-medium"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </label>
              </div>

              <button
                type="button" 
                onClick={handleInfer} 
                disabled={inferring || !formData.job_description}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-full bg-primary/5 text-primary border border-primary/20 font-display text-[13px] font-medium hover:bg-primary/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {inferring ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {inferring ? "AI discovering requirements..." : "Analyze with smart AI"}
              </button>

              {inferredData && (
                <div className="border border-[color:var(--success)]/20 bg-[color:var(--success)]/5 rounded-xl p-4 space-y-3">
                  <div className="text-[color:var(--success)] font-medium text-[13px] flex items-center gap-1.5 font-display font-bold">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Inferred requirements for: {formData.job_title}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.required_skills.map((s, i) => (
                      <span key={i} className="text-[11px] bg-amber-50 text-[color:var(--warning)] px-2.5 py-0.5 rounded-full border border-amber-200 font-medium">{s}</span>
                    ))}
                    {formData.nice_to_have.map((s, i) => (
                      <span key={i} className="text-[11px] bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full border border-border font-medium">{s}</span>
                    ))}
                    {formData.min_experience > 0 && (
                      <span className="text-[11px] bg-secondary text-primary px-2.5 py-0.5 rounded-full border border-primary/20 font-medium">Min {formData.min_experience} years</span>
                    )}
                    {formData.preferred_locations.map((l, i) => (
                      <span key={i} className="text-[11px] bg-secondary text-primary px-2.5 py-0.5 rounded-full border border-primary/20 font-medium flex items-center gap-1">
                        <MapPin size={10} className="shrink-0" />
                        <span>{l}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if(!formData.name || !formData.job_title || !formData.job_description) {
                    toast.error("Please fill all required fields");
                    return;
                  }
                  setStep(2);
                }}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground font-display font-medium text-sm shadow-google-1 hover:shadow-google-2 transition"
              >
                Next step <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="font-display text-[18px] font-bold text-foreground">Define your hiring criteria</h2>
              <p className="text-xs text-muted-foreground">Adjust filters and weighting parameters used to score candidate resumes.</p>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5 mb-2 block">Required Skills</span>
                <TagInput 
                  tags={formData.required_skills} 
                  onChange={(t) => setFormData({...formData, required_skills: t})} 
                  placeholder="e.g. Node.js, Typescript" 
                  tagColor="amber" 
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5 mb-2 block">Nice to Have Skills</span>
                <TagInput 
                  tags={formData.nice_to_have} 
                  onChange={(t) => setFormData({...formData, nice_to_have: t})} 
                  placeholder="e.g. AWS, Docker" 
                  tagColor="gray" 
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5 mb-2 block">Preferred Locations</span>
                <TagInput 
                  tags={formData.preferred_locations} 
                  onChange={(t) => setFormData({...formData, preferred_locations: t})} 
                  placeholder="e.g. Remote, Mumbai" 
                  tagColor="blue" 
                />
              </label>

              <div className="flex items-center gap-4 bg-muted/40 border border-border rounded-xl p-3.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5 shrink-0">Minimum Experience</span>
                <input 
                  type="number" min="0" max="20"
                  value={formData.min_experience}
                  onChange={(e) => setFormData({...formData, min_experience: parseInt(e.target.value) || 0})}
                  className="w-20 h-9 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary text-center font-medium font-mono"
                />
                <span className="text-sm font-medium text-foreground">years</span>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Auto-reject Threshold</span>
                  <span className={`text-[13px] font-bold ${
                    formData.min_match_score < 45 ? 'text-[color:var(--danger)]' : formData.min_match_score <= 65 ? 'text-[color:var(--warning)]' : 'text-[color:var(--success)]'
                  }`}>
                    {formData.min_match_score}% matching match score
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <input
                    type="range" min="0" max="100" step="5"
                    value={formData.min_match_score}
                    onChange={handleSliderChange}
                    className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-0.5">Matching Weights</span>
                <p className="text-[11px] text-muted-foreground mt-1 mb-3">Adjust parameters priority weights. Values auto-balance to total exactly 1.00.</p>
                
                <div className="space-y-3.5 bg-muted/30 border border-border rounded-xl p-4">
                  {['skills', 'experience', 'location'].map((key) => (
                    <div key={key} className="flex items-center gap-4">
                      <div className="w-24 text-xs font-medium uppercase tracking-wider text-muted-foreground capitalize">{key}:</div>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={formData.weights[key]}
                        onChange={(e) => handleWeightChange(key, e.target.value)}
                        className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="w-12 text-sm text-right font-mono text-foreground font-bold">{formData.weights[key].toFixed(2)}</div>
                    </div>
                  ))}
                  
                  <div className="pt-3 border-t border-border/60 flex justify-between items-center text-xs">
                    <div className="font-mono text-muted-foreground bg-card border border-border px-2.5 py-1 rounded-lg">Weight Sum: {weightsSum.toFixed(2)}</div>
                    {Math.abs(weightsSum - 1.0) > 0.01 ? (
                      <span className="text-[color:var(--danger)] font-bold flex items-center gap-1">
                        <AlertCircle size={13} /> Sum must equal 1.00
                      </span>
                    ) : (
                      <span className="text-[color:var(--success)] font-bold">✓ Parameters balanced</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-border text-sm font-medium hover:bg-muted transition"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if(Math.abs(weightsSum - 1.0) > 0.01) {
                    toast.error("Weights must equal exactly 1.0"); return;
                  }
                  setStep(3);
                }}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground font-display font-medium text-sm shadow-google-1 hover:shadow-google-2 transition"
              >
                Next step <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="font-display text-[18px] font-bold text-foreground">Define Interview Stages</h2>
              <p className="text-xs text-muted-foreground">Order stages for this hiring pipeline. Candidates will transition sequentially through these rounds.</p>
            </div>
            
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {formData.rounds.map((round, idx) => {
                const isLast = idx === formData.rounds.length - 1;
                return (
                  <div key={round.id} className={`flex flex-wrap md:flex-nowrap items-center gap-3 p-3 bg-muted/40 border rounded-xl relative ${isLast ? 'border-primary/45 shadow-sm' : 'border-border'} transition`}>
                    <div className="text-muted-foreground cursor-move shrink-0"><GripVertical size={16} /></div>
                    
                    <input 
                      type="text" 
                      value={round.name}
                      onChange={(e) => {
                        const newRounds = [...formData.rounds];
                        newRounds[idx].name = e.target.value;
                        setFormData({...formData, rounds: newRounds});
                      }}
                      className="flex-1 min-w-[120px] bg-transparent border-b border-border/80 focus:border-primary focus:outline-none text-sm text-foreground font-semibold py-1 placeholder:text-muted-foreground/60"
                      placeholder="Round Name (e.g. Coding Test)"
                    />
                    
                    <input 
                      type="text" 
                      value={round.interviewer}
                      onChange={(e) => {
                        const newRounds = [...formData.rounds];
                        newRounds[idx].interviewer = e.target.value;
                        setFormData({...formData, rounds: newRounds});
                      }}
                      className="w-32 bg-transparent border-b border-border/80 focus:border-primary focus:outline-none text-xs text-muted-foreground py-1 placeholder:text-muted-foreground/50 font-medium"
                      placeholder="Interviewer"
                    />

                    <input 
                      type="datetime-local" 
                      value={round.result_announcement_date || ""}
                      onChange={(e) => {
                        const newRounds = [...formData.rounds];
                        newRounds[idx].result_announcement_date = e.target.value || "";
                        setFormData({...formData, rounds: newRounds});
                      }}
                      className="w-40 bg-transparent border-b border-border/80 focus:border-primary focus:outline-none text-[11px] text-muted-foreground py-1 font-medium"
                      title="Result Release (Optional)"
                    />
                    
                    <button 
                      type="button"
                      onClick={() => {
                        if (formData.rounds.length <= 1) return;
                        setFormData({...formData, rounds: formData.rounds.filter((_, i) => i !== idx)});
                      }}
                      className="text-muted-foreground hover:text-[color:var(--danger)] hover:bg-muted p-1.5 rounded-full transition shrink-0"
                      disabled={formData.rounds.length <= 1}
                    >
                      <X size={15} />
                    </button>
                    
                    {isLast && (
                      <span className="absolute -top-2.5 right-4 bg-secondary text-primary text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-primary/20">
                        Final Round
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {formData.rounds.length < 8 && (
              <button 
                type="button"
                onClick={() => {
                  const newId = Math.max(...formData.rounds.map(r=>r.id), 0) + 1;
                  setFormData({...formData, rounds: [...formData.rounds, {id:newId, name:"", interviewer:"", order:newId}]});
                }}
                className="w-full h-11 border border-dashed border-primary/40 bg-primary/[0.02] hover:bg-primary/[0.04] text-primary rounded-xl font-display text-[13px] font-medium flex items-center justify-center gap-2 transition"
              >
                <Plus size={15} /> Add Interview Round
              </button>
            )}

            <div className="pt-4 border-t border-border space-y-3">
              <button
                type="button"
                onClick={handleCreate} 
                disabled={creating}
                className="w-full h-12 bg-primary hover:bg-primary/95 text-primary-foreground rounded-full font-display font-semibold transition flex items-center justify-center shadow-google-1 hover:shadow-google-2 disabled:opacity-75"
              >
                {creating ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Finalizing session pipeline...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    Complete & Create Session
                  </>
                )}
              </button>
              
              <button 
                type="button"
                onClick={() => setStep(2)}
                className="w-full text-center py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                &larr; Back to criteria settings
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <PageTransition className="max-w-[640px] mx-auto py-2">
      {renderStepIndicator()}
      {renderStepContent()}
    </PageTransition>
  );
}
