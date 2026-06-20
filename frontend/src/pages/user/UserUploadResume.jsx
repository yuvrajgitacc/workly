import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header, Footer } from "../../components/user/site-chrome";
import { seekerAPI } from "../../lib/api";
import { UploadCloud, FileText, CheckCircle2, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";

export default function UserUploadResume() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [rawFile, setRawFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (f) => {
    if (!f) return;
    setRawFile(f);
    setFile({ name: f.name, size: `${(f.size / 1024).toFixed(0)} KB` });
  };

  const handleUpload = async () => {
    if (!rawFile) return;
    setUploading(true);
    const toastId = toast.loading("Uploading and parsing resume using AI...");
    try {
      await seekerAPI.uploadResume(rawFile);
      toast.success("Resume parsed successfully!", { id: toastId });
      navigate("/profile");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to upload and parse resume", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="mx-auto max-w-4xl px-6 pt-12">
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--google-yellow)]">Resume</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Upload your resume</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            One file, parsed into a clean profile. We'll match you with roles based on your skills and experience.
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFileChange(f);
          }}
          className={`mt-10 rounded-[2rem] border-2 border-dashed p-12 text-center transition ${
            drag ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
        >
          {!file ? (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
                <UploadCloud className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">Drag & drop your resume</h2>
              <p className="mt-2 text-sm text-muted-foreground">PDF, DOC or DOCX up to 5MB</p>
              <label className="pill mt-6 inline-flex cursor-pointer items-center gap-2 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                <UploadCloud className="h-4 w-4" /> Browse files
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                />
              </label>
            </>
          ) : (
            <div className="mx-auto max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--google-green)]/10">
                <CheckCircle2 className="h-8 w-8 text-[var(--google-green)]" />
              </div>
              <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">Resume ready</h2>
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{file.size}</div>
                </div>
                <button 
                  onClick={() => { setFile(null); setRawFile(null); }} 
                  disabled={uploading}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button 
                onClick={handleUpload}
                disabled={uploading}
                className="pill mt-6 inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Parsing Resume..." : "Continue to profile"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { i: Sparkles, t: "Smart parsing", d: "Skills, roles and dates pulled automatically.", c: "var(--google-blue)" },
            { i: CheckCircle2, t: "Private by default", d: "Only companies you apply to can see your resume.", c: "var(--google-green)" },
            { i: FileText, t: "One file, many jobs", d: "Apply to dozens of roles with one click.", c: "var(--google-red)" },
          ].map((b) => (
            <div key={b.t} className="rounded-3xl border border-border bg-card p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${b.c} 14%, transparent)` }}>
                <b.i className="h-5 w-5" style={{ color: b.c }} />
              </div>
              <div className="mt-4 font-display font-semibold">{b.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
