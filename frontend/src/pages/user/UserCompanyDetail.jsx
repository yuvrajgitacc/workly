import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Header, Footer } from "../../components/user/site-chrome";
import { CompanyLogo } from "../../components/user/company-logo";
import { publicAPI, seekerAPI } from "../../lib/api";
import { ArrowLeft, MapPin, Users, Calendar, Star, Globe } from "lucide-react";
import toast from "react-hot-toast";

export default function UserCompanyDetail() {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    publicAPI.getCompany(companyId)
      .then((data) => {
        const mappedCompany = {
          id: data.id,
          name: data.name,
          industry: data.industry || "Technology",
          location: data.hq_location || "Remote",
          size: data.company_size || "50-200",
          founded: data.founded_year || 2020,
          website: data.website_url || "#",
          about: data.about || "This company has not provided an overview yet.",
          rating: data.rating || 4.5,
          logoColor: "#059669",
          logoPath: data.logo_path,
          openings: data.openings || 0,
          openJobs: data.open_jobs || [],
          isFollowing: data.is_following || false,
        };
        setCompany(mappedCompany);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load company details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [companyId]);

  const handleFollow = async () => {
    if (!company || following) return;
    setFollowing(true);
    try {
      const isCurrentlyFollowing = company.isFollowing;
      await seekerAPI.followCompany(company.id, !isCurrentlyFollowing);
      setCompany({ ...company, isFollowing: !isCurrentlyFollowing });
      toast.success(isCurrentlyFollowing ? "Unfollowed company" : "Following company!");
    } catch (err) {
      toast.error(err.message || "Failed to follow company");
    } finally {
      setFollowing(false);
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

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <p>Company not found or failed to load.</p>
          <Link to="/companies" className="text-primary underline mt-2">Back to companies</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-6 pt-8">
        <Link to="/companies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All companies
        </Link>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 sm:p-12">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-50"
            style={{ background: `radial-gradient(50% 70% at 20% 0%, color-mix(in oklab, ${company.logoColor} 25%, transparent), transparent)` }}
          />
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-5 sm:flex sm:items-center sm:gap-6">
            <CompanyLogo name={company.name} logoPath={company.logoPath} color={company.logoColor} size={88} />
            <div className="min-w-0">
              <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{company.name}</h1>
              <p className="mt-2 text-muted-foreground">{company.industry}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{company.location}</span>
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{company.size} employees</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Founded {company.founded}</span>
                <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-[var(--google-yellow)] text-[var(--google-yellow)]" />{company.rating}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <button
              onClick={handleFollow}
              disabled={following}
              className={`pill px-5 py-2.5 text-sm font-medium transition-colors ${company.isFollowing ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
            >
              {company.isFollowing ? 'Following' : 'Follow'}
            </button>
            {company.website && company.website !== "#" && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="pill border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted inline-flex items-center"
              >
                <Globe className="mr-1.5 h-4 w-4" />Website
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            <div className="rounded-[2rem] border border-border bg-card p-8">
              <h2 className="font-display text-xl font-semibold tracking-tight">About</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground whitespace-pre-wrap">{company.about}</p>
            </div>

            <div className="rounded-[2rem] border border-border bg-card p-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold tracking-tight">Open roles ({company.openJobs.length})</h2>
              </div>
              <div className="mt-5 grid gap-3">
                {company.openJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open roles right now.</p>
                ) : (
                  company.openJobs.map((j) => (
                    <Link
                      key={j.id}
                      to={`/jobs/${j.id}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 transition hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate font-display font-semibold group-hover:text-primary">{j.job_title}</h3>
                        <div className="mt-1 text-xs text-muted-foreground">{j.location} · {j.employment_type} · {j.salary_range}</div>
                      </div>
                      <span className="pill shrink-0 bg-foreground px-3 py-1.5 text-xs font-medium text-background">View</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Company at a glance</div>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Industry", company.industry],
                  ["Size", company.size],
                  ["HQ", company.location],
                  ["Founded", String(company.founded)],
                  ["Open roles", String(company.openings)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </section>
      <Footer />
    </div>
  );
}
