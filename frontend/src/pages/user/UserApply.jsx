import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Header, Footer } from "../../components/user/site-chrome";
import { CompanyLogo } from "../../components/user/company-logo";
import { seekerAPI } from "../../lib/api";
import { ArrowLeft, CheckCircle2, FileText, Upload, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function UserApply() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  
  const [step, setStep] = useState(1);
  const [coverNote, setCoverNote] = useState("");
  const [seeker, setSeeker] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    
    // Load job info
    seekerAPI.getJob(jobId)
      .then((data) => {
        setJob({
          id: data.id,
          company: data.company_name,
          title: data.job_title,
          logoColor: "#4F46E5",
          logoPath: data.company_logo_path,
        });
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load job details");
      });

    // Load seeker profile to check if they have a resume
    seekerAPI.getMe()
      .then((profile) => {
        setSeeker(profile);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId]);

  const handleSubmit = async () => {
    if (!job || !seeker) return;
    
    if (!seeker.resume_file_path) {
      toast.error("Please upload your resume in your profile before applying.");
      navigate("/upload-resume");
      return;
    }

    setSubmitting(true);
    try {
      await seekerAPI.applyJob(job.id, coverNote);
      setDone(true);
      toast.success("Application submitted successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <p>Job posting not found.</p>
          <Link to="/jobs" className="text-primary underline mt-2">Back to jobs</Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <section className="mx-auto max-w-2xl px-6 pt-20 text-center flex-1">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[var(--google-green)]/10">
            <CheckCircle2 className="h-10 w-10 text-[var(--google-green)]" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">Application sent</h1>
          <p className="mt-3 text-muted-foreground">We've sent your application to <strong>{job.company}</strong>. You'll hear back within 48 hours on average.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/dashboard" className="pill bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Go to dashboard</Link>
            <Link to="/jobs" className="pill border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-muted">Browse more jobs</Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-6 pt-8">
        <Link to={`/jobs/${job.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to job
        </Link>
      </div>

      <section className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <CompanyLogo name={job.company} logoPath={job.logoPath} color={job.logoColor} size={56} />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{job.company}</div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Apply for {job.title}</h1>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex flex-1 items-center gap-2">
                <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
                  step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{n}</div>
                {n < 3 && <div className={`h-px flex-1 ${step > n ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-6">
            {step === 1 && (
              <>
                <h2 className="font-display text-lg font-semibold">Your details</h2>
                <Field label="Full name" value={seeker?.full_name || ""} disabled />
                <Field label="Email" value={seeker?.email || ""} disabled />
                <Field label="Phone" value={seeker?.phone || "Not provided"} disabled />
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="font-display text-lg font-semibold">Resume from profile</h2>
                {seeker?.resume_file_path ? (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">Uploaded Resume</div>
                        <div className="text-xs text-muted-foreground">Will be sent with this application</div>
                      </div>
                      <Link to="/upload-resume" className="pill inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium">
                        <Upload className="h-3.5 w-3.5" /> Manage
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-red-300 bg-red-50 p-6 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
                    <p className="text-sm font-medium text-red-800">No resume uploaded</p>
                    <p className="text-xs text-red-600 mt-1">You must upload a resume before you can apply to jobs.</p>
                    <Link to="/upload-resume" className="pill inline-flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 text-xs font-medium mt-3 hover:bg-red-700">
                      <Upload className="h-3.5 w-3.5" /> Upload resume
                    </Link>
                  </div>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <h2 className="font-display text-lg font-semibold">Why this role?</h2>
                <div>
                  <label className="text-sm font-medium">A short note to the team (optional)</label>
                  <textarea
                    rows={6}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Tell them what excites you about this role…"
                    className="mt-2 w-full rounded-2xl border border-border bg-background p-4 text-sm outline-none focus:border-primary"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="pill border border-border bg-background px-5 py-2.5 text-sm font-medium disabled:opacity-40"
            >
              Back
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="pill bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !seeker?.resume_file_path}
                className="pill bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit application"}
              </button>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function Field({ label, value, disabled }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        disabled={disabled}
        className="mt-2 w-full rounded-2xl border border-border bg-background/50 px-4 py-3 text-sm outline-none text-muted-foreground"
      />
    </div>
  );
}
