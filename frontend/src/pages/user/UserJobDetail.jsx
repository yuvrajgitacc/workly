import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Header, Footer } from "../../components/user/site-chrome";
import { CompanyLogo } from "../../components/user/company-logo";
import { seekerAPI } from "../../lib/api";
import { ArrowLeft, Bookmark, Share2, MapPin, Clock, Briefcase, DollarSign, CheckCircle2, Star } from "lucide-react";
import toast from "react-hot-toast";

export default function UserJobDetail() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    seekerAPI.getJob(jobId)
      .then((data) => {
        let reqs = [];
        if (data.skill_alignment?.missing) {
          const isDictKeys = data.skill_alignment.missing.includes("inferred_role") || data.skill_alignment.missing.includes("required_skills");
          if (isDictKeys && data.inferred_skills && typeof data.inferred_skills === "object") {
            reqs = data.inferred_skills.required_skills || [];
          } else {
            reqs = data.skill_alignment.missing;
          }
        } else if (data.inferred_skills) {
          if (Array.isArray(data.inferred_skills)) {
            reqs = data.inferred_skills;
          } else if (typeof data.inferred_skills === "object") {
            reqs = data.inferred_skills.required_skills || [];
          }
        }

        const inferredTags = Array.isArray(data.inferred_skills)
          ? data.inferred_skills
          : (typeof data.inferred_skills === "object" ? (data.inferred_skills.required_skills || []) : []);

        const mappedJob = {
          id: data.id,
          companyId: data.company_id,
          company: data.company_name,
          title: data.job_title,
          location: data.location || "Remote",
          type: data.employment_type || "Full-time",
          posted: data.created_at ? new Date(data.created_at).toLocaleDateString() : "Just now",
          salary: data.salary_range || "Competitive",
          description: data.full_description || data.job_description,
          logoColor: "#4F46E5",
          logoPath: data.company_logo_path,
          responsibilities: data.responsibilities || 
            (typeof data.inferred_skills === "object" ? data.inferred_skills.key_responsibilities : null) || [
            "Analyze requirements and design system specifications",
            "Write high quality, testable, and self-documenting code",
            "Participate in design meetings and code reviews",
            "Collaborate with multi-disciplinary teams of designers and engineers"
          ],
          requirements: reqs,
          tags: inferredTags,
          applied: data.applied || false,
          isSaved: data.is_saved || false,
        };
        setJob(mappedJob);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load job details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId]);

  const handleSave = async () => {
    if (!job || saving) return;
    setSaving(true);
    try {
      const isCurrentlySaved = job.isSaved;
      await seekerAPI.saveJob(job.id, !isCurrentlySaved);
      setJob({ ...job, isSaved: !isCurrentlySaved });
      toast.success(isCurrentlySaved ? "Job unsaved" : "Job saved!");
    } catch (err) {
      toast.error(err.message || "Failed to save job");
    } finally {
      setSaving(false);
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
          <p>Job not found or failed to load.</p>
          <Link to="/jobs" className="text-primary underline mt-2">Back to jobs</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-6 pt-8">
        <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All jobs
        </Link>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-10">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-5 sm:flex sm:items-center sm:justify-between">
            <div className="flex items-start gap-5 sm:items-center">
              <CompanyLogo name={job.company} logoPath={job.logoPath} color={job.logoColor} size={72} />
              <div className="min-w-0">
                <Link to={`/companies/${job.companyId}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  {job.company}
                </Link>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{job.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{job.location}</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{job.type}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{job.posted}</span>
                  <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4" />{job.salary}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-8">
            {job.applied ? (
              <span className="pill inline-flex items-center gap-2 bg-muted px-6 py-3 text-sm font-medium text-muted-foreground">
                Applied
              </span>
            ) : (
              <Link to={`/apply/${job.id}`} className="pill inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                Apply now
              </Link>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`pill inline-flex items-center gap-2 border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted ${job.isSaved ? 'text-primary border-primary' : ''}`}
            >
              <Bookmark className={`h-4 w-4 ${job.isSaved ? 'fill-primary' : ''}`} /> {job.isSaved ? 'Saved' : 'Save'}
            </button>
            <button className="pill inline-flex items-center gap-2 border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8 rounded-[2rem] border border-border bg-card p-6 sm:p-10">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">About the role</h2>
              <div className="mt-4">
                <FormattedDescription text={job.description} />
              </div>
            </div>
            {job.responsibilities && job.responsibilities.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">What you'll do</h2>
                <ul className="mt-3 space-y-2">
                  {job.responsibilities.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--google-green)]" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {job.requirements && job.requirements.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">Required Skills / Requirements</h2>
                <ul className="mt-3 space-y-2">
                  {job.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--google-blue)]" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {job.tags && job.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {job.tags.map((t) => (
                  <span key={t} className="pill bg-muted px-3 py-1 text-xs">{t}</span>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Job Summary</div>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Posted", job.posted],
                  ["Type", job.type],
                  ["Location", job.location],
                  ["Salary", job.salary],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Link
              to={`/companies/${job.companyId}`}
              className="block rounded-3xl border border-border bg-card p-6 transition hover:google-shadow"
            >
              <div className="flex items-center gap-3">
                <CompanyLogo name={job.company} logoPath={job.logoPath} color={job.logoColor} size={44} />
                <div>
                  <div className="font-display font-semibold">{job.company}</div>
                  <div className="text-xs text-muted-foreground">View company profile</div>
                </div>
              </div>
            </Link>
          </aside>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FormattedDescription({ text }) {
  if (!text) return null;

  const lines = text.split("\n").map(l => l.trim());
  const elements = [];
  let currentList = [];
  let listType = "bullet";
  let listAccent = "blue";

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push({
        type: "list",
        items: [...currentList],
        listType,
        accent: listAccent
      });
      currentList = [];
    }
  };

  let metaItems = [];
  const flushMeta = () => {
    if (metaItems.length > 0) {
      elements.push({
        type: "meta-grid",
        items: [...metaItems]
      });
      metaItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) {
      flushList();
      flushMeta();
      continue;
    }

    // Skip divider lines (=== or --- or similar)
    if (/^[=\-_*]{4,}$/.test(line)) {
      flushList();
      flushMeta();
      continue;
    }

    // 1. Check for Checkmark Emojis (✅, ✔️, ✔, ☑️, ☑)
    const checkMatch = line.match(/^(?:✅|✔️|✔|☑️|☑)\s*(.*)/u);
    if (checkMatch) {
      flushMeta();
      currentList.push({ text: checkMatch[1], icon: "check" });
      continue;
    }

    // 2. Check for Star Emojis (⭐, 🌟, ✨)
    const starMatch = line.match(/^(?:⭐|🌟|✨)\s*(.*)/u);
    if (starMatch) {
      flushMeta();
      currentList.push({ text: starMatch[1], icon: "star" });
      continue;
    }

    // 3. Check for standard bullet list item (starts with -, *, •, +)
    const bulletMatch = line.match(/^[-*•+]\s+(.*)/);
    if (bulletMatch) {
      flushMeta();
      currentList.push({ text: bulletMatch[1], icon: "bullet" });
      continue;
    }

    // 4. Check for numbered list item (starts with 1., 2.)
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      flushMeta();
      currentList.push({ text: numMatch[2], icon: "number", num: numMatch[1] });
      continue;
    }

    // Check for key-value pair (e.g. COMPANY: BuildFast)
    // Avoid matching URLs
    const kvMatch = line.match(/^([A-Z0-9_\s]{3,25}):\s+(.*)/);
    if (kvMatch && !line.startsWith("http")) {
      flushList();
      metaItems.push({ key: kvMatch[1], value: kvMatch[2] });
      continue;
    }

    // Plain text or Header
    flushList();
    flushMeta();

    // A header is uppercase, short (fewer than 50 chars), and has at least one letter
    const isHeader = (line.length < 50 && line === line.toUpperCase() && /[A-Z]/.test(line)) || line.endsWith(":");
    if (isHeader) {
      const headerText = line.endsWith(":") ? line.slice(0, -1) : line;
      const lowerH = headerText.toLowerCase();

      if (lowerH.includes("do") || lowerH.includes("responsibility") || lowerH.includes("expect")) {
        listAccent = "green";
      } else if (lowerH.includes("require") || lowerH.includes("skill") || lowerH.includes("eligibility")) {
        listAccent = "blue";
      } else {
        listAccent = "blue";
      }

      elements.push({
        type: "header",
        text: headerText
      });
    } else {
      elements.push({
        type: "paragraph",
        text: line
      });
    }
  }

  flushList();
  flushMeta();

  return (
    <div className="space-y-4">
      {elements.map((el, i) => {
        if (el.type === "header") {
          return (
            <h3 key={i} className="font-display text-base font-semibold text-[#202124] mt-6 first:mt-0 tracking-tight">
              {el.text}
            </h3>
          );
        }
        if (el.type === "paragraph") {
          return (
            <p key={i} className="text-sm leading-relaxed text-[#5f6368]">
              {el.text}
            </p>
          );
        }
        if (el.type === "list") {
          return (
            <ul key={i} className="space-y-2.5 my-2">
              {el.items.map((item, idx) => {
                let iconElement = null;
                if (item.icon === "check") {
                  iconElement = <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1e8e3e]" />;
                } else if (item.icon === "star") {
                  iconElement = <Star className="mt-0.5 h-4 w-4 shrink-0 fill-[#f9ab00] text-[#f9ab00]" />;
                } else if (item.icon === "number") {
                  iconElement = (
                    <span className="mt-0.5 text-[10px] font-bold text-[#1967d2] shrink-0 w-4 h-4 rounded-full bg-[#e8f0fe] flex items-center justify-center font-mono">
                      {item.num}
                    </span>
                  );
                } else {
                  iconElement = (
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${
                      el.accent === "green" ? "text-[#1e8e3e]" : "text-[#1a73e8]"
                    }`} />
                  );
                }
                return (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-[#5f6368]">
                    {iconElement}
                    <span>{item.text}</span>
                  </li>
                );
              })}
            </ul>
          );
        }
        if (el.type === "meta-grid") {
          return (
            <div key={i} className="bg-[#f1f3f4] rounded-2xl border border-border p-5 my-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {el.items.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#5f6368] uppercase tracking-wider">
                    {item.key.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className="text-sm font-semibold text-[#202124]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
