import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, MapPin, ArrowRight, Briefcase, Sparkles, FileUp, CheckCircle2, Star,
  Code2, Palette, LineChart, Megaphone, HeartPulse, Wrench, GraduationCap, Building2,
  ShieldCheck, Zap, Quote,
} from "lucide-react";
import { Header, Footer } from "../../components/user/site-chrome";
import { CompanyLogo } from "../../components/user/company-logo";
import { jobs, companies } from "../../lib/data";
import spotResume from "../../assets/spot-resume.png";
import spotDashboard from "../../assets/spot-dashboard.png";
import { ScrollingAnimation } from "../../components/user/ui/scrolling-animation";
import heroBg from "../../assets/hero-bg.png";

const categories = [
  { i: Code2, t: "Engineering", n: "2,840", c: "var(--google-blue)" },
  { i: Palette, t: "Design", n: "1,120", c: "var(--google-red)" },
  { i: LineChart, t: "Data & AI", n: "960", c: "var(--google-green)" },
  { i: Megaphone, t: "Marketing", n: "740", c: "var(--google-yellow)" },
  { i: HeartPulse, t: "Healthcare", n: "510", c: "var(--google-red)" },
  { i: Wrench, t: "Operations", n: "430", c: "var(--google-blue)" },
  { i: GraduationCap, t: "Education", n: "280", c: "var(--google-green)" },
  { i: Building2, t: "Finance", n: "640", c: "var(--google-yellow)" },
];

const fadeInUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.215, 0.610, 0.355, 1.000] }
  }
};

const staggerContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.215, 0.610, 0.355, 1.000] }
  }
};

const slideInLeftVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.215, 0.610, 0.355, 1.000] }
  }
};

const slideInRightVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.215, 0.610, 0.355, 1.000] }
  }
};

function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");

  const featured = jobs.slice(0, 4);
  const topCompanies = companies.slice(0, 6);

  const [isMounted, setIsMounted] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  const words = useMemo(() => ["fits", "inspires", "values", "respects", "excites"], []);

  useEffect(() => {
    setIsMounted(true);
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [words.length]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (location) params.set("location", location);
    navigate(`/jobs?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero — two column with illustration */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-20"
          style={{
            backgroundImage: `url(${heroBg})`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(55% 50% at 15% 10%, color-mix(in oklab, var(--google-blue) 14%, transparent), transparent 70%), radial-gradient(45% 40% at 95% 0%, color-mix(in oklab, var(--google-red) 10%, transparent), transparent 70%), radial-gradient(45% 50% at 50% 100%, color-mix(in oklab, var(--google-green) 10%, transparent), transparent 70%)",
          }}
        />
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center px-6 pt-10 pb-12 sm:pt-16 sm:pb-16">
          <div className="flex flex-col items-center w-full">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="pill inline-flex items-center gap-2 border border-border bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--google-green)]" />
              12,480 new roles this week · updated hourly
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-5 font-display text-4xl font-semibold leading-[1.25] tracking-tight sm:text-5xl lg:text-6xl flex flex-wrap items-center justify-center gap-x-[0.25em]"
            >
              <span>Find work that</span>
              <span className="relative inline-flex overflow-hidden h-[1.2em] w-[4.5em] items-center justify-center align-middle">
                {!isMounted ? (
                  <span className="gradient-text font-bold">fits</span>
                ) : (
                  words.map((word, index) => (
                    <motion.span
                      key={word}
                      className="absolute gradient-text font-bold"
                      initial={{ opacity: 0, y: "100%" }}
                      transition={{ type: "spring", stiffness: 75, damping: 15 }}
                      animate={
                        wordIndex === index
                          ? {
                            y: 0,
                            opacity: 1,
                          }
                          : {
                            y: "-100%",
                            opacity: 0,
                          }
                      }
                    >
                      {word}
                    </motion.span>
                  ))
                )}
              </span>
              <span>you — not the other way around.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-4 max-w-xl mx-auto text-sm text-muted-foreground sm:text-base"
            >
              Search thousands of roles across modern teams. Apply with one resume, track every conversation
              and get matched to companies that share your values.
            </motion.p>

            {/* Search bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="mt-6 max-w-2xl mx-auto w-full relative"
            >
              <div className="relative flex items-center justify-center group w-full isolate">
                {/* Glow Layer 1 */}
                <div className="search-glow-layer-1"></div>

                {/* Glow Layer 2 */}
                <div className="search-glow-layer-2"></div>

                {/* Glow Layer 3 */}
                <div className="search-glow-layer-3"></div>

                {/* Main Search Bar Container */}
                <form
                  onSubmit={handleSearch}
                  className="google-shadow-lg flex flex-col gap-1 rounded-2xl border border-border bg-background p-1.5 sm:flex-row sm:items-center w-full transition-all duration-300 group-hover:border-transparent group-focus-within:border-transparent"
                >
                  <div className="flex flex-1 items-center gap-2 px-4 py-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      placeholder="Job title, skill or keyword"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="hidden h-8 w-px bg-gray-200 sm:block mx-1" />
                  <div className="flex flex-1 items-center gap-2 px-4 py-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <input
                      placeholder="Location or remote"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-full flex items-center justify-center gap-1 bg-[#2563EB] hover:bg-blue-700 text-white px-7 py-3 text-sm font-semibold transition-all duration-200 shrink-0"
                  >
                    Search <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="font-medium">Trending:</span>
                {["Product Designer", "ML Engineer", "Remote", "Fintech", "Staff Engineer"].map((t) => (
                  <Link key={t} to="/jobs" className="pill border border-border bg-background/80 px-2.5 py-0.5 hover:bg-muted">
                    {t}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[var(--google-green)]" /> Verified employers</span>
              <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[var(--google-yellow)]" /> Avg response 48h</span>
              <span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-[var(--google-yellow)] text-[var(--google-yellow)]" /> 4.8 from 12k seekers</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <motion.section
        className="mx-auto max-w-7xl px-6"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4 sm:p-5">
          {[
            { k: "Open roles", v: "12,480", c: "var(--google-blue)" },
            { k: "Companies", v: "3,200+", c: "var(--google-green)" },
            { k: "Hired this month", v: "1,940", c: "var(--google-yellow)" },
            { k: "Avg. response", v: "48 hrs", c: "var(--google-red)" },
          ].map((s) => (
            <div key={s.k} className="px-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.k}</div>
              <div className="mt-0.5 font-display text-xl font-semibold sm:text-2xl" style={{ color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Categories */}
      <motion.section
        className="mx-auto max-w-7xl px-6 py-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainerVariants}
      >
        <motion.div variants={fadeInUpVariants} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--google-blue)]">Browse</div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Explore by category</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick a path. We'll surface roles, salaries and companies in your field.</p>
          </div>
          <Link to="/jobs" className="pill shrink-0 border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            All categories
          </Link>
        </motion.div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <motion.div key={c.t} variants={staggerItemVariants} className="w-full flex">
              <Link
                to="/jobs"
                className="group flex flex-1 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:google-shadow"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: `color-mix(in oklab, ${c.c} 14%, transparent)` }}
                >
                  <c.i className="h-5 w-5" style={{ color: c.c }} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-semibold tracking-tight group-hover:text-primary">{c.t}</div>
                  <div className="text-[11px] text-muted-foreground">{c.n} open</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Featured jobs */}
      <motion.section
        className="mx-auto max-w-7xl px-6 pb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainerVariants}
      >
        <motion.div variants={fadeInUpVariants} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--google-green)]">Featured</div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Hand-picked roles for you</h2>
          </div>
          <Link to="/jobs" className="pill shrink-0 border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            View all
          </Link>
        </motion.div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {featured.map((j) => (
            <motion.div key={j.id} variants={staggerItemVariants} className="w-full flex">
              <Link
                to={`/jobs/j.id `}
                className="group w-full rounded-2xl border border-border bg-card p-4 transition hover:google-shadow"
              >
                <div className="flex items-start gap-3">
                  <CompanyLogo name={j.company} color={j.logoColor} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{j.company}</span>
                      <span>·</span>
                      <span>{j.location}</span>
                      <span>·</span>
                      <span>{j.posted}</span>
                    </div>
                    <h3 className="mt-0.5 font-display text-base font-semibold tracking-tight group-hover:text-primary">{j.title}</h3>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{j.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="pill bg-muted px-2 py-0.5 font-medium">{j.salary}</span>
                      <span className="pill bg-muted px-2 py-0.5 text-muted-foreground">{j.remote}</span>
                      <span className="pill bg-muted px-2 py-0.5 text-muted-foreground">{j.type}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How it works — with illustration */}
      <motion.section
        className="mx-auto max-w-7xl px-6 py-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainerVariants}
      >
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div variants={slideInLeftVariants} className="order-2 lg:order-1">
            <img
              src={spotResume}
              alt="Resume with checkmark illustration"
              width={640}
              height={640}
              loading="lazy"
              className="mx-auto w-full max-w-[360px]"
            />
          </motion.div>
          <div className="order-1 lg:order-2">
            <motion.div variants={fadeInUpVariants}>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--google-blue)]">How it works</div>
              <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">From resume to offer in three calm steps</h2>
            </motion.div>
            <div className="mt-6 space-y-3">
              {[
                { i: FileUp, t: "Upload your resume", d: "One file, parsed into a clean profile recruiters actually read.", c: "var(--google-blue)" },
                { i: Search, t: "Discover roles", d: "Smart search across remote, hybrid and on-site jobs with salary transparency.", c: "var(--google-yellow)" },
                { i: CheckCircle2, t: "Apply with one click", d: "Track every application from interested to offer in a single calm pipeline.", c: "var(--google-green)" },
              ].map((s, idx) => (
                <motion.div key={s.t} variants={staggerItemVariants} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${s.c} 14%, transparent)` }}
                  >
                    <s.i className="h-4 w-4" style={{ color: s.c }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground">STEP 0{idx + 1}</span>
                    </div>
                    <h3 className="mt-0.5 font-display text-base font-semibold tracking-tight">{s.t}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.d}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Top companies */}
      <motion.section
        className="mx-auto max-w-7xl px-6 py-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainerVariants}
      >
        <motion.div variants={fadeInUpVariants} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--google-red)]">Top companies</div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Teams hiring this week</h2>
          </div>
          <Link to="/companies" className="pill shrink-0 border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            Browse all
          </Link>
        </motion.div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topCompanies.map((c) => (
            <motion.div key={c.id} variants={staggerItemVariants} className="w-full flex">
              <Link
                to={`/companies/c.id `}
                className="group w-full rounded-2xl border border-border bg-card p-4 transition hover:google-shadow"
              >
                <div className="flex items-center gap-3">
                  <CompanyLogo name={c.name} color={c.logoColor} size={44} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-sm font-semibold tracking-tight">{c.name}</h3>
                    <p className="truncate text-[11px] text-muted-foreground">{c.industry} · {c.location}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="pill bg-muted px-2 py-0.5 text-muted-foreground">{c.openings} open</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3 fill-[var(--google-yellow)] text-[var(--google-yellow)]" />
                    {c.rating} · {c.size}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Market insights */}
      <motion.section
        className="mx-auto max-w-7xl px-6 py-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainerVariants}
      >
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={slideInLeftVariants}>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--google-green)]">Market insights</div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Know your worth before you apply</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Live salary benchmarks, demand growth and emerging tooling — pulled from 50,000+ verified offers across the network.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { k: "Demand growth", v: "+18%", sub: "YoY tech roles", c: "var(--google-green)" },
                { k: "Median salary", v: "$142k", sub: "Senior engineer", c: "var(--google-blue)" },
                { k: "Time to offer", v: "21d", sub: "Across platform", c: "var(--google-yellow)" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-border bg-card p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.k}</div>
                  <div className="mt-1 font-display text-xl font-semibold" style={{ color: s.c }}>{s.v}</div>
                  <div className="text-[11px] text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Link to="/jobs" className="pill inline-flex items-center gap-1.5 border border-border px-4 py-2 text-xs font-medium hover:bg-muted">
                Explore salary data <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
          <motion.div variants={slideInRightVariants}>
            <img
              src={spotDashboard}
              alt="Dashboard analytics illustration"
              width={640}
              height={640}
              loading="lazy"
              className="mx-auto w-full max-w-[420px]"
            />
          </motion.div>
        </div>
      </motion.section>

      <ScrollingAnimation />

      {/* Testimonials */}
      <motion.section
        className="mx-auto max-w-7xl px-6 py-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainerVariants}
      >
        <motion.div variants={fadeInUpVariants} className="text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--google-yellow)]">Stories</div>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Loved by 120,000+ professionals</h2>
        </motion.div>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            { q: "Workly turned weeks of search into days. The match score was uncannily accurate.", n: "Maya R.", r: "Product Designer, Vela", c: "var(--google-blue)" },
            { q: "Loved the calm pipeline view. I always knew where every application stood.", n: "Daniel O.", r: "Staff Engineer, Northwind", c: "var(--google-green)" },
            { q: "Salary transparency made negotiation actually fair. Got 22% above my last role.", n: "Priya K.", r: "PM, Atlas Pay", c: "var(--google-red)" },
          ].map((t) => (
            <motion.figure key={t.n} variants={staggerItemVariants} className="rounded-2xl border border-border bg-card p-5">
              <Quote className="h-5 w-5" style={{ color: t.c }} />
              <blockquote className="mt-2 text-sm leading-relaxed text-foreground">"{t.q}"</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: t.c }}>
                  {t.n.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{t.n}</div>
                  <div className="text-[11px] text-muted-foreground">{t.r}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </motion.section>

      {/* For employers + Seekers split */}
      <motion.section
        className="mx-auto max-w-7xl px-6 pb-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainerVariants}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <motion.div
            variants={slideInLeftVariants}
            className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-7"
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{ background: "radial-gradient(60% 70% at 0% 100%, color-mix(in oklab, var(--google-blue) 16%, transparent), transparent 70%)" }}
            />
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-[var(--google-blue)]" /> For job seekers
            </div>
            <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Your next chapter starts here</h3>
            <p className="mt-2 text-sm text-muted-foreground">Upload your resume once. We'll match you with roles that fit your skills and energy.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/upload-resume" className="pill inline-flex items-center gap-1.5 bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">
                <FileUp className="h-3.5 w-3.5" /> Upload resume
              </Link>
              <Link to="/jobs" className="pill inline-flex items-center gap-1.5 border border-border bg-background px-4 py-2 text-xs font-medium hover:bg-muted">
                <Briefcase className="h-3.5 w-3.5" /> Browse jobs
              </Link>
            </div>
          </motion.div>

          <motion.div
            variants={slideInRightVariants}
            className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-7"
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{ background: "radial-gradient(60% 70% at 100% 0%, color-mix(in oklab, var(--google-green) 16%, transparent), transparent 70%)" }}
            />
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Building2 className="h-3 w-3 text-[var(--google-green)]" /> For employers
            </div>
            <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Hire calmer, faster</h3>
            <p className="mt-2 text-sm text-muted-foreground">Reach 120k+ pre-screened candidates with salary-transparent listings and one clean dashboard.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/companies" className="pill inline-flex items-center gap-1.5 bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90">
                Post a job
              </Link>
              <Link to="/companies" className="pill inline-flex items-center gap-1.5 border border-border bg-background px-4 py-2 text-xs font-medium hover:bg-muted">
                See pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <Footer />
    </div>
  );
}

export default Home;
