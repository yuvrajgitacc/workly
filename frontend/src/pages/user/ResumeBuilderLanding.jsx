import React, { useState, useEffect } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Header, Footer } from "../../components/user/site-chrome";
import { seekerAPI } from "../../lib/api";
import { 
  FileText, 
  Plus, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Check, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  FileCheck,
  TrendingUp
} from "lucide-react";
import toast from "react-hot-toast";
import { TEMPLATE_META } from "../../components/user/templates/ResumePreview";

import resumeModern from "../../assets/resume_template_modern.png";
import resumeClassic from "../../assets/resume_template_classic.png";
import resumeMinimal from "../../assets/resume_template_minimal.png";
import resumeExecutive from "../../assets/resume_template_executive.png";
import resumeCreative from "../../assets/resume_template_creative.png";
import resumeCompact from "../../assets/resume_template_compact.png";
import resumeAts from "../../assets/resume_template_ats.png";

const TEMPLATE_IMAGES = {
  modern: resumeModern,
  classic: resumeClassic,
  minimal: resumeMinimal,
  executive: resumeExecutive,
  creative: resumeCreative,
  compact: resumeCompact,
  ats: resumeAts
};

export default function ResumeBuilderLanding() {
  const navigate = useNavigate();
  const token = localStorage.getItem("vish_seeker_token");

  // Redirect if not logged in
  if (!token) {
    return <Navigate to="/jobs/login?redirect=/resume-builder" replace />;
  }

  const [drafts, setDrafts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  
  // ATS Scan on existing profile resume state
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsReport, setAtsReport] = useState(null);
  const [atsError, setAtsError] = useState(null);

  const fetchLandingData = async () => {
    try {
      setLoading(true);
      const [draftsData, recsData] = await Promise.all([
        seekerAPI.getDrafts(),
        seekerAPI.recommendTemplates().catch(() => ({ recommendations: [] }))
      ]);
      setDrafts(draftsData || []);
      setRecommendations(recsData?.recommendations || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load drafts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLandingData();
  }, []);

  const handleCreateDraft = async (templateId) => {
    setBtnLoading(true);
    try {
      const title = `Resume - ${TEMPLATE_META[templateId].name}`;
      const draft = await seekerAPI.createDraft({ title, templateId });
      toast.success("Draft created!");
      navigate(`/resume-builder/edit/${draft.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create resume draft");
    } finally {
      setBtnLoading(false);
    }
  };

  const handleImportResume = async () => {
    setBtnLoading(true);
    try {
      const draft = await seekerAPI.createDraft({ 
        title: "Imported Profile Resume", 
        templateId: "modern" 
      });
      toast.success("Imported details successfully!");
      navigate(`/resume-builder/edit/${draft.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to import profile resume");
    } finally {
      setBtnLoading(false);
    }
  };

  const handleUploadResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBtnLoading(true);
    const toastId = toast.loading("Uploading and parsing resume with Advanced ATS Agent...");
    try {
      const draft = await seekerAPI.importFileDraft(file);
      toast.success("Resume parsed and imported successfully!", { id: toastId });
      navigate(`/resume-builder/edit/${draft.id}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to parse and import resume file", { id: toastId });
    } finally {
      setBtnLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDraft = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this draft?")) return;
    try {
      await seekerAPI.deleteDraft(id);
      toast.success("Draft deleted");
      setDrafts(drafts.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete draft");
    }
  };

  const handleScanCurrentResume = async () => {
    setAtsLoading(true);
    setAtsReport(null);
    setAtsError(null);
    try {
      // Runs ATS Agent on current active profile resume
      const report = await seekerAPI.atsCheck({ uploadedResumeId: "active" });
      setAtsReport(report);
      toast.success("ATS Compatibility check completed!");
    } catch (err) {
      console.error(err);
      setAtsError(err.message || "Failed to scan resume. Please ensure you have a resume uploaded on your profile.");
      toast.error("ATS check failed");
    } finally {
      setAtsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background rb-pro-scope">
      <Header />
      
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Hero Section */}
        <section className="mb-12 text-center md:text-left md:flex md:items-center md:justify-between gap-8 border-b border-border/60 pb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-elevation-1 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Powered by ATS Compatibility Agent
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Create a resume that <span className="google-gradient-text">beats the bots</span>.
            </h1>
            <p className="mt-3 text-muted-foreground text-lg">
              Pick an ATS-optimized template, customize your layout, and get real-time recommendations to improve formatting, structure, and keyword compatibility.
            </p>
            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">
              <button
                disabled={btnLoading}
                onClick={handleImportResume}
                className="pill bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-all flex items-center gap-2 shadow-elevation-1 disabled:opacity-50"
              >
                <FileCheck className="h-4 w-4" />
                Import my profile data
              </button>
              <button
                disabled={btnLoading}
                onClick={() => handleCreateDraft("modern")}
                className="pill border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-muted transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Build from scratch
              </button>
              <label className={`pill border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 cursor-pointer ${btnLoading ? "opacity-50 pointer-events-none" : ""}`}>
                <FileText className="h-4 w-4 text-primary" />
                <span>Upload & parse file</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleUploadResume}
                  className="hidden"
                  disabled={btnLoading}
                />
              </label>
            </div>
          </div>

          {/* Quick Scanner card */}
          <div className="mt-8 md:mt-0 w-full max-w-md bg-card rounded-3xl border border-border p-6 shadow-elevation-1">
            <h3 className="text-lg font-medium flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-[var(--google-blue)]" />
              Improve My Current Resume
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Run the ATS Agent on your currently uploaded profile resume to calculate your score and get top recommendations.
            </p>

            {atsLoading && (
              <div className="py-6 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">ATS Compatibility Agent is analyzing...</span>
              </div>
            )}

            {!atsLoading && !atsReport && !atsError && (
              <button
                onClick={handleScanCurrentResume}
                className="w-full pill bg-[var(--google-blue)] text-white py-2.5 text-xs font-semibold hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                Scan current profile resume
              </button>
            )}

            {atsError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-xs flex items-start gap-2 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Scan Failed</div>
                  <div>{atsError}</div>
                  <button onClick={handleScanCurrentResume} className="mt-2 text-primary hover:underline font-semibold block">
                    Retry Check
                  </button>
                </div>
              </div>
            )}

            {atsReport && (
              <div>
                <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-2xl border border-border/60 mb-4">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="absolute w-full h-full transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="27"
                        stroke="rgba(37, 99, 235, 0.1)"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="27"
                        stroke="rgb(37, 99, 235)"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray="169.6"
                        strokeDashoffset={169.6 - (169.6 * (atsReport.overallScore || 0)) / 100}
                        className="transition-all duration-500 ease-out"
                      />
                    </svg>
                    <span className="text-xl font-bold text-primary relative z-10">{atsReport.overallScore}%</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">ATS Compatibility Score</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {atsReport.overallScore >= 80 ? "Excellent compatibility profile!" : "Needs formatting & content improvements."}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Improvements Needed:</div>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {atsReport.topSuggestions?.slice(0, 3).map((s, idx) => (
                      <li key={idx} className="flex gap-2 items-start">
                        <span className="text-primary font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    )) || <li>No major suggestions found. Looking good!</li>}
                  </ul>
                </div>

                <button
                  onClick={handleImportResume}
                  className="w-full text-center text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1"
                >
                  Import profile data to edit and fix details <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Existing Drafts */}
        {drafts.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              My Saved Resumes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafts.map((d) => (
                <div 
                  key={d.id} 
                  className={`bg-card border rounded-3xl p-5 hover:shadow-elevation-2 transition-all relative flex flex-col justify-between ${
                    d.isActive ? "border-primary shadow-elevation-1 ring-1 ring-primary/25" : "border-border"
                  }`}
                >
                  {d.isActive && (
                    <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      <Check className="h-3.5 w-3.5" /> Active Resume
                    </span>
                  )}
                  <div>
                    <h3 className="text-base font-semibold pr-24 truncate">{d.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Template: {TEMPLATE_META[d.templateId]?.name || d.templateId} · Updated {new Date(d.updatedAt).toLocaleDateString()}
                    </p>
                    
                    {d.atsScore !== null && d.atsScore !== undefined && (
                      <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1 text-xs font-medium text-muted-foreground border border-border">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        ATS Score: <span className="font-bold text-primary">{d.atsScore}%</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                    <button
                      onClick={() => navigate(`/resume-builder/edit/${d.id}`)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      <Edit3 className="h-4 w-4" /> Edit content
                    </button>
                    <button
                      onClick={(e) => handleDeleteDraft(d.id, e)}
                      className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                      title="Delete Draft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Templates Gallery */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">ATS-Friendly Templates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select a design to instantiate a new draft. You can change templates seamlessly at any time in the editor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(TEMPLATE_META).map(([id, meta]) => {
              const isRecommended = recommendations.includes(id);
              return (
                <div 
                  key={id}
                  className={`group relative overflow-hidden rounded-3xl border bg-card text-left shadow-elevation-1 transition-all hover:shadow-elevation-2 flex flex-col justify-between ${
                    isRecommended ? "border-primary/50 ring-1 ring-primary/10" : "border-border"
                  }`}
                >
                  <div className="p-4 bg-muted/30 border-b border-border/60 aspect-[8.5/11] flex items-center justify-center relative overflow-hidden">
                    {isRecommended && (
                      <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-elevation-1">
                        <Sparkles className="h-3 w-3" /> Recommended
                      </span>
                    )}
                    
                    {/* Visual Mock representation of template */}
                    <div className="absolute inset-4 bg-white border border-border rounded-xl shadow-elevation-1 overflow-hidden scale-100 group-hover:scale-[1.02] transition-all">
                      <img 
                        src={TEMPLATE_IMAGES[id]} 
                        alt={`${meta.name} Template Preview`} 
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-5">
                    <div>
                      <div className="text-base font-semibold text-foreground">{meta.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
                    </div>
                    <button
                      disabled={btnLoading}
                      onClick={() => handleCreateDraft(id)}
                      className="pill bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all shrink-0"
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
