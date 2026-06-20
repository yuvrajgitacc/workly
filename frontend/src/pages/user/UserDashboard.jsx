import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header, Footer } from "../../components/user/site-chrome";
import { CompanyLogo } from "../../components/user/company-logo";
import { seekerAPI } from "../../lib/api";
import { Bookmark, Briefcase, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";

const statuses = ["Applied", "Interview", "Offer", "Saved"];

const statusColor = {
  Applied: "var(--google-blue)",
  Interview: "var(--google-yellow)",
  Offer: "var(--google-green)",
  Saved: "var(--google-red)",
};

export default function UserDashboard() {
  const [seeker, setSeeker] = useState(null);
  const [applications, setApplications] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      seekerAPI.getMe().catch(() => null),
      seekerAPI.getApplications().catch(() => ({ applications: [] })),
      seekerAPI.getSavedJobs().catch(() => ({ jobs: [] }))
    ])
      .then(([profile, appsData, savedData]) => {
        setSeeker(profile);
        setApplications(appsData?.applications || []);
        setSavedJobs(savedData?.jobs || []);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load dashboard data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const getPipelineList = (status) => {
    if (status === "Saved") {
      return savedJobs.map(j => ({
        id: j.id,
        jobId: j.id,
        title: j.job_title,
        company: j.company_name,
        date: "Saved",
        logoPath: j.company_logo_path,
      }));
    }
    
    // Map applications status choices
    return applications
      .filter((app) => {
        const s = app.status.toLowerCase();
        if (status === "Applied") return s === "applied";
        if (status === "Interview") return s === "interview" || s === "shortlisted";
        if (status === "Offer") return s === "hired" || s === "offer" || s === "accepted";
        return false;
      })
      .map(app => ({
        id: app.id,
        jobId: app.job_id,
        title: app.job_title,
        company: app.company_name,
        date: app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "Recently",
        logoPath: app.company_logo_path,
      }));
  };

  const counts = {
    Applied: applications.filter(a => a.status === "applied").length,
    Interviews: applications.filter(a => a.status === "shortlisted" || a.status === "interview").length,
    Offers: applications.filter(a => a.status === "hired").length,
    Saved: savedJobs.length
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="mx-auto max-w-7xl px-6 pt-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--google-blue)]">Dashboard</div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Welcome back, {seeker?.full_name?.split(" ")[0] || "Seeker"}
            </h1>
            <p className="mt-3 text-muted-foreground">Here's where you are with your job search.</p>
          </div>
          <Link to="/jobs" className="pill shrink-0 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Find more jobs</Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {[
            { i: Briefcase, k: "Applied", v: String(counts.Applied), c: "var(--google-blue)" },
            { i: Clock, k: "Interviews", v: String(counts.Interviews), c: "var(--google-yellow)" },
            { i: CheckCircle2, k: "Offers", v: String(counts.Offers), c: "var(--google-green)" },
            { i: Bookmark, k: "Saved", v: String(counts.Saved), c: "var(--google-red)" },
          ].map((s) => (
            <div key={s.k} className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: `color-mix(in oklab, ${s.c} 14%, transparent)` }}>
                  <s.i className="h-5 w-5" style={{ color: s.c }} />
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 text-xs text-muted-foreground">{s.k}</div>
              <div className="font-display text-3xl font-semibold">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Your pipeline</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          {statuses.map((status) => {
            const list = getPipelineList(status);
            return (
              <div key={status} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: statusColor[status] }} />
                    <span className="font-display font-semibold">{status}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {list.map((a) => (
                    <Link
                      key={a.id}
                      to={`/jobs/${a.jobId}`}
                      className="block rounded-2xl border border-border bg-background p-4 transition hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <CompanyLogo name={a.company} logoPath={a.logoPath} color="#4F46E5" size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{a.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{a.company}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">{a.date}</div>
                    </Link>
                  ))}
                  {list.length === 0 && <p className="text-xs text-muted-foreground">Nothing here yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}
