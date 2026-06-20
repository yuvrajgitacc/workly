import React, { useState, useEffect } from "react";
import { Header, Footer } from "../../components/user/site-chrome";
import { CompanyLogo } from "../../components/user/company-logo";
import { seekerAPI } from "../../lib/api";
import { 
  Calendar, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  AlertCircle,
  FileText,
  UserCheck,
  Info
} from "lucide-react";
import toast from "react-hot-toast";

function CountdownTimer({ targetDate, serverTime, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!targetDate) return;
    const targetUtc = new Date(targetDate).getTime();
    const serverUtc = new Date(serverTime).getTime();
    const initialDiff = targetUtc - serverUtc;
    
    const startTime = Date.now();
    
    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = initialDiff - elapsed;
      if (remaining <= 0) {
        setTimeLeft(0);
        if (onComplete) onComplete();
      } else {
        setTimeLeft(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate, serverTime]);

  if (timeLeft <= 0) return <span className="text-xs font-medium text-warning flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Announcing result shortly</span>;

  const seconds = Math.floor((timeLeft / 1000) % 60);
  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));

  return (
    <span className="font-mono text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5 font-semibold">
      <Clock className="h-3.5 w-3.5" />
      {days > 0 ? `${days}d ` : ""}{hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}

export default function UserApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, active, rejected, hired
  const [expandedAppId, setExpandedAppId] = useState(null);
  const [serverTime, setServerTime] = useState(new Date().toISOString());

  const fetchApplications = () => {
    setLoading(true);
    seekerAPI.getApplications()
      .then((data) => {
        setApplications(data.applications || []);
        setServerTime(data.server_time || new Date().toISOString());
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load applications");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const toggleExpand = (id) => {
    setExpandedAppId(prev => (prev === id ? null : id));
  };

  const filteredApps = applications.filter((app) => {
    if (filter === "all") return true;
    if (filter === "rejected") return app.status === "rejected";
    if (filter === "hired") return app.status === "hired";
    // active means status is applied or shortlisted (not rejected or hired)
    if (filter === "active") return app.status === "applied" || app.status === "shortlisted";
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "hired":
        return <span className="pill bg-[oklch(0.95_0.02_145)] text-[oklch(0.4_0.15_145)] font-semibold text-xs px-3 py-1">Offer Made</span>;
      case "rejected":
        return <span className="pill bg-destructive/10 text-destructive font-semibold text-xs px-3 py-1">Rejected</span>;
      case "shortlisted":
        return <span className="pill bg-primary/10 text-primary font-semibold text-xs px-3 py-1">Shortlisted</span>;
      default:
        return <span className="pill bg-muted text-muted-foreground font-semibold text-xs px-3 py-1">Applied</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="mx-auto max-w-7xl px-6 pt-10">
        <div className="max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-wider text-primary">Dashboard</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your Job Applications</h1>
          <p className="mt-3 text-muted-foreground">Track the status of your live submissions and scheduled recruitment rounds.</p>
        </div>

        {/* Tab Filters */}
        <div className="flex border-b border-border mt-8 gap-6 text-sm">
          {[
            { id: "all", label: "All Applications" },
            { id: "active", label: "Active" },
            { id: "hired", label: "Offers" },
            { id: "rejected", label: "Archived / Rejected" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilter(tab.id);
                setExpandedAppId(null);
              }}
              className={`pb-3 font-medium transition relative ${
                filter === tab.id 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-border rounded-3xl bg-card text-muted-foreground">
            No applications found matching this category.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map((app) => {
              const isExpanded = expandedAppId === app.id;
              const rounds = app.rounds || [];
              const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);

              // Find active/upcoming round details
              const activeRound = sortedRounds.find(r => Number(r.order) === Number(app.visible_round_index)) || sortedRounds[0];

              return (
                <div 
                  key={app.id} 
                  className={`rounded-3xl border border-border bg-card transition duration-200 overflow-hidden ${
                    isExpanded ? "google-shadow border-primary/20" : "hover:border-border-hover"
                  }`}
                >
                  {/* Card Header (Standard Clickable Area) */}
                  <div 
                    onClick={() => toggleExpand(app.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 cursor-pointer hover:bg-muted/10 transition"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      <CompanyLogo name={app.company_name} logoPath={app.company_logo_path} color="#2563eb" size={52} />
                      <div>
                        <h3 className="font-display text-lg font-semibold tracking-tight">{app.job_title}</h3>
                        <p className="text-sm text-muted-foreground font-medium">{app.company_name}</p>
                        <p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Applied on {formatDate(app.applied_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="flex flex-col items-end gap-1.5">
                        {getStatusBadge(app.status)}
                        {app.match_score !== null && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {app.match_score}% Match
                          </span>
                        )}
                      </div>
                      <div className="p-1.5 rounded-full hover:bg-muted text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Accordion Panel */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-6 animate-in slide-in-from-top-1 duration-200">
                      {/* Top Details */}
                      <div className="grid md:grid-cols-3 gap-6 mb-8">
                        <div className="md:col-span-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FileText className="h-4 w-4" /> Cover Note
                            <span className="text-[10px] text-muted-foreground/70 normal-case font-normal ml-1">
                              (A brief message to the company submitted with your application)
                            </span>
                          </h4>
                          <p className="text-sm text-foreground mt-2 italic leading-relaxed whitespace-pre-line bg-card border border-border/50 p-4 rounded-2xl">
                            {app.cover_note || "No cover note provided."}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 relative group">
                            <AlertCircle className="h-4 w-4" /> Match Agent Status
                            <Info className="h-3.5 w-3.5 text-muted-foreground/75 cursor-help hover:text-foreground transition-colors" />
                            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-900 dark:bg-zinc-950 text-slate-100 dark:text-zinc-100 border border-slate-800 dark:border-zinc-800 rounded-2xl shadow-xl opacity-0 scale-95 origin-bottom-left group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none z-50 text-[11px] leading-normal font-normal normal-case">
                              <p className="font-semibold mb-1 text-xs text-white">AI Match Agent</p>
                              Our background agent parses and cross-references your resume skills and experience directly against the recruiter's job requirements. 
                              <div className="mt-1 text-slate-400">
                                If a temporary provider delay occurs, standard heuristics activate as a fallback to score your profile instantly.
                              </div>
                            </div>
                          </h4>
                          <div className="mt-2 text-xs bg-card border border-border/50 p-4 rounded-2xl space-y-2">
                            <div>
                              <span className="font-semibold">Status:</span>{" "}
                              <span className={`capitalize font-bold ${
                                app.agent_processing_status === "failed" ? "text-destructive" : "text-success"
                              }`}>
                                {app.agent_processing_status === "failed" ? "Fallback Mode" : "Analysis Completed"}
                              </span>
                            </div>
                            {app.agent_processing_status === "failed" ? (
                              <p className="text-muted-foreground leading-normal">
                                Standard heuristics are active. Core resume criteria matched successfully.
                              </p>
                            ) : (
                              <p className="text-muted-foreground leading-normal">
                                Agent matching parity verified against recruiter criteria parameters.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stepper Pipeline */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-6">
                          <UserCheck className="h-4 w-4" /> Recruitment Stages
                        </h4>

                        <div className="relative pl-6 sm:pl-8 border-l border-border/80 ml-3 py-2 space-y-8">
                          {sortedRounds.map((round, idx) => {
                            const isCompleted = Number(round.order) < Number(app.visible_round_index);
                            const isActive = Number(round.order) === Number(app.visible_round_index);
                            const isUpcoming = Number(round.order) > Number(app.visible_round_index);
                            
                            // Check announcement dates
                            const hasDate = !!round.result_announcement_date;
                            const datePassed = hasDate && new Date(serverTime) >= new Date(round.result_announcement_date);
                            const isScheduled = hasDate && !datePassed;

                            // Icon logic
                            let iconEl = null;
                            if (isCompleted) {
                              iconEl = <CheckCircle2 className="h-5 w-5 text-success fill-success/10" />;
                            } else if (isActive) {
                              if (app.status === "rejected") {
                                iconEl = <XCircle className="h-5 w-5 text-destructive fill-destructive/10" />;
                              } else if (app.status === "hired") {
                                iconEl = <CheckCircle2 className="h-5 w-5 text-success fill-success/10" />;
                              } else {
                                iconEl = <CircleProgress />;
                              }
                            } else {
                              iconEl = <Lock className="h-4 w-4 text-muted-foreground/60" />;
                            }

                            let roundStatus = "";
                            let statusColor = "text-muted-foreground";

                            if (isCompleted) {
                              roundStatus = "Cleared";
                              statusColor = "text-emerald-600 dark:text-emerald-400 font-semibold";
                            } else if (isActive) {
                              if (app.status === "rejected") {
                                roundStatus = "Rejected";
                                statusColor = "text-rose-600 dark:text-rose-400 font-semibold";
                              } else if (app.status === "hired") {
                                roundStatus = "Hired";
                                statusColor = "text-emerald-600 dark:text-emerald-400 font-semibold";
                              } else if (isScheduled) {
                                roundStatus = "Awaiting Results";
                                statusColor = "text-blue-600 dark:text-blue-400 font-semibold";
                              } else {
                                roundStatus = "Evaluating";
                                statusColor = "text-amber-600 dark:text-amber-400 font-semibold";
                              }
                            } else {
                              roundStatus = "Upcoming";
                              statusColor = "text-muted-foreground/60";
                            }

                            return (
                              <div key={round.order} className="relative">
                                {/* Dot Icon Container */}
                                <div className="absolute -left-[35px] sm:-left-[43px] top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border">
                                  {iconEl}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className={`font-display text-sm font-semibold tracking-tight ${
                                        isActive ? "text-foreground" : "text-muted-foreground"
                                      }`}>
                                        {round.name || `Round ${round.order}`}
                                      </h5>
                                      {isActive && app.status !== "rejected" && app.status !== "hired" && (
                                        <span className="pill text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5">
                                          Active Round
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Status: <span className={statusColor}>{roundStatus}</span>
                                      {round.interviewer && round.interviewer.trim() !== "" && round.interviewer.trim().toLowerCase() !== "not assigned" && (
                                        <span className="ml-3 border-l border-border pl-3 text-muted-foreground/75">
                                          Interviewer: <span className="font-medium text-foreground/80">{round.interviewer}</span>
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {/* Right side date/countdown */}
                                  {isScheduled && isActive && app.status !== "rejected" && app.status !== "hired" && (
                                    <div className="flex items-center gap-2 mt-1 sm:mt-0 self-start sm:self-center">
                                      <span className="text-xs text-muted-foreground font-medium">Result release in:</span>
                                      <CountdownTimer 
                                        targetDate={round.result_announcement_date} 
                                        serverTime={serverTime}
                                        onComplete={fetchApplications}
                                      />
                                    </div>
                                  )}

                                  {hasDate && !isScheduled && (
                                    <span className="text-xs text-muted-foreground/60 font-medium self-start sm:self-center">
                                      Released {formatDate(round.result_announcement_date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

function CircleProgress() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
    </span>
  );
}
