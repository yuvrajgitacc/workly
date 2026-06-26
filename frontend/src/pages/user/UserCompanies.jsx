import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Star, ArrowRight } from "lucide-react";
import { Header, Footer } from "../../components/user/site-chrome";
import { CompanyLogo } from "../../components/user/company-logo";
import { publicAPI } from "../../lib/api";
import toast from "react-hot-toast";

export default function UserCompanies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const POPULAR_COMPANIES = ["Google", "Microsoft", "Meta", "Amazon", "Netflix", "Technology", "Healthcare", "Finance", "Education"];

  const fetchCompanies = () => {
    setLoading(true);
    publicAPI.listCompanies()
      .then((data) => {
        setCompanies(data.companies || []);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load companies");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const filtered = companies.filter((c) => {
    const term = search.toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.industry && c.industry.toLowerCase().includes(term));
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="mx-auto max-w-7xl px-6 pt-10">
        <div className="max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--google-green)]">Companies</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Discover teams worth joining</h1>
          <p className="mt-3 text-muted-foreground">From early-stage startups to global platforms — find the place that fits you.</p>
        </div>

        <div className="relative mt-8">
          <div className="google-shadow flex items-center gap-2 rounded-3xl border border-border bg-background p-2">
            <div className="flex flex-1 items-center gap-2 px-3 py-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input 
                placeholder="Search company name or industry..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" 
              />
            </div>
          </div>
          {showSuggestions && (
            <div className="absolute top-[105%] left-0 right-0 bg-white border border-border rounded-2xl shadow-lg z-50 py-1.5 max-h-48 overflow-y-auto">
              {POPULAR_COMPANIES.map((s, i) => (
                <div 
                  key={i} 
                  onMouseDown={() => setSearch(s)}
                  className="px-4 py-2 hover:bg-gray-50 text-xs text-foreground cursor-pointer font-medium text-left"
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-border rounded-2xl bg-card text-muted-foreground">
            No companies found.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to={`/companies/${c.id}`}
                className="group rounded-3xl border border-border bg-card p-6 transition hover:google-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-4">
                    <CompanyLogo name={c.name} logoPath={c.logo_path} color="#059669" size={56} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-lg font-semibold tracking-tight group-hover:text-primary">{c.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">{c.industry}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{c.about || 'No description provided.'}</p>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-4 border-t border-border/50">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{c.hq_location}</span>
                  <span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-[var(--google-yellow)] text-[var(--google-yellow)]" />{c.rating}</span>
                  <span className="pill bg-muted px-2.5 py-1">{c.openings} roles</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
