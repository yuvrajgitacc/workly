import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { portalUsage } from "../../lib/portalApi";
import { usePortalAuthStore } from "../../stores/portalAuthStore";
import { Activity, FileText, Zap, Key, Crown, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const PIE_COLORS = { Parse: "#111111", Match: "#555555", Chat: "#22C55E", Export: "#9CA3AF" };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xl shadow-gray-200/50">
        <p className="font-bold text-charcoal mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm font-medium">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-500 capitalize">{entry.name}:</span>
            <span className="text-charcoal font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DeveloperDashboard() {
  const { company_name, tier } = usePortalAuthStore();

  const { data: summary } = useQuery({
    queryKey: ["portal-summary"],
    queryFn: portalUsage.summary
  });

  const { data: timeline } = useQuery({
    queryKey: ["portal-timeline"],
    queryFn: () => portalUsage.timeline(30)
  });

  const parseUsage = summary?.percentages?.parse || 0;
  const matchUsage = summary?.percentages?.match || 0;
  const highestUsage = Math.max(parseUsage, matchUsage);
  const totalCalls = summary?.total_calls || 0;
  const resumesParsed = summary?.resumes_parsed || 0;
  const avgLatency = summary?.avg_latency_ms ? `${Math.round(summary.avg_latency_ms)}ms` : "--";
  const activeKeys = summary?.active_keys || 0;

  const pieData = Object.entries(summary?.calls_by_type || {}).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value
  })).filter(d => d.value > 0);

  return (
    <div className="w-full max-w-7xl mx-auto pb-12">
      {/* HEADER */}
      <div className="mb-6">
         <h1 className="text-3xl font-black text-charcoal">Overview</h1>
         <p className="text-gray-800 font-bold mt-1">Welcome back, {company_name || "Developer"}</p>
      </div>

      {/* ALERT BANNER */}
      {highestUsage > 80 && (
         <div className="mb-8 w-full bg-amber-50 border border-accent/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
               <AlertTriangle size={20} className="text-accent-dark" />
               <p className="text-amber-800 font-semibold text-sm">
                 You have reached <strong className="font-black">{Math.round(highestUsage)}%</strong> of your monthly limit. Consider upgrading your plan to avoid disruptions.
               </p>
            </div>
            <Link to="/developer/portal/billing" className="px-5 py-2 bg-accent text-white text-sm font-bold rounded-lg hover:bg-accent-dark transition-colors whitespace-nowrap">Upgrade Plan</Link>
         </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-2 group">
              <span className="text-gray-900 text-xs font-black uppercase tracking-wide">Total Calls</span>
              <Activity className="text-gray-700 group-hover:text-accent transition-colors" size={18} />
            </div>
            <span className="text-2xl font-black text-charcoal">{(totalCalls || 0).toLocaleString()}</span>
         </div>
         <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-2 group">
              <span className="text-gray-900 text-xs font-black uppercase tracking-wide">Parsed</span>
              <FileText className="text-gray-700 group-hover:text-amber-500 transition-colors" size={18} />
            </div>
            <span className="text-2xl font-black text-charcoal">{(resumesParsed || 0).toLocaleString()}</span>
         </div>
         <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-2 group">
              <span className="text-gray-900 text-xs font-black uppercase tracking-wide">Latency</span>
              <Zap className="text-gray-700 group-hover:text-yellow-500 transition-colors" size={18} />
            </div>
            <span className="text-2xl font-black text-charcoal">{avgLatency}</span>
         </div>
         <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-2 group">
              <span className="text-gray-900 text-xs font-black uppercase tracking-wide">Active Keys</span>
              <Key className="text-gray-700 group-hover:text-black transition-colors" size={18} />
            </div>
            <span className="text-2xl font-black text-charcoal">{activeKeys}</span>
         </div>
         <div className="bg-gradient-to-br from-amber-500 to-amber-600 border border-amber-600 rounded-2xl p-5 flex flex-col shadow-lg shadow-amber-500/20 text-white animate-fade-in">
            <div className="flex justify-between items-start mb-2">
              <span className="text-white/80 text-xs font-bold uppercase tracking-wide">Current Plan</span>
              <Crown className="text-white/90" size={18} />
            </div>
            <span className="text-2xl font-black capitalize mb-1">{tier || "Free"}</span>
            {(!tier || tier === "free" || tier === "starter") && (
              <Link to="/developer/portal/billing" className="text-[11px] font-black uppercase text-white/90 hover:text-white mt-auto underline decoration-white/40 underline-offset-2">Upgrade &rarr;</Link>
            )}
         </div>
      </div>

      {/* CHART ROW */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
         {/* Line Chart */}
         <div className="md:col-span-3 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-charcoal mb-6">API Calls — Last 30 Days</h3>
            <div className="w-full h-[260px]">
               {timeline ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                       <XAxis dataKey="date" tick={{fontSize: 12, fill: '#858585'}} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                       <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#e6dfcd', strokeWidth: 1, strokeDasharray: '4 4' }} />
                       <Legend wrapperStyle={{fontSize: "12px", fontWeight: "600", color: "#858585", paddingTop: "10px"}} />
                       <Line type="monotone" dataKey="parse" stroke={PIE_COLORS.Parse} strokeWidth={3} dot={false} activeDot={{r: 6, strokeWidth: 0}} />
                       <Line type="monotone" dataKey="match" stroke={PIE_COLORS.Match} strokeWidth={3} dot={false} activeDot={{r: 6, strokeWidth: 0}} />
                       <Line type="monotone" dataKey="chat" stroke={PIE_COLORS.Chat} strokeWidth={3} dot={false} activeDot={{r: 6, strokeWidth: 0}} />
                    </LineChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="w-full h-full bg-gray-100 rounded-xl animate-pulse"></div>
               )}
            </div>
         </div>

         {/* Pie Chart */}
         <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg text-charcoal mb-4">Calls by Type</h3>
            <div className="w-full flex-1 min-h-[200px] flex items-center justify-center relative">
               {pieData && pieData.length > 0 ? (
                 <>
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col -mt-4">
                     <span className="text-3xl font-black text-charcoal">{totalCalls}</span>
                     <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Total</span>
                   </div>
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <Pie
                           data={pieData}
                           innerRadius={70}
                           outerRadius={95}
                           paddingAngle={4}
                           dataKey="value"
                           stroke="none"
                         >
                           {pieData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || PIE_COLORS.Export} />
                           ))}
                         </Pie>
                         <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: "12px", fontWeight: "600"}}/>
                         <RechartsTooltip contentStyle={{borderRadius:'8px', border:'1px solid #e5e7eb', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize:'12px', fontWeight:'bold'}} itemStyle={{color:'#2A2A2A'}}/>
                      </PieChart>
                   </ResponsiveContainer>
                 </>
               ) : (
                 <div className="text-sm font-semibold text-gray-800 w-full text-center">No data available</div>
               )}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* USAGE LIMITS */}
         <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-charcoal mb-6">Usage This Month</h3>
            
            <div className="flex flex-col gap-6">
               {(["parse", "match", "chat"]).map(type => {
                 const count = summary?.limits?.[type]?.count || 0;
                 const limit = summary?.limits?.[type]?.limit;
                 const pct = summary?.percentages?.[type] || 0;
                 const isUnlimited = limit === -1;
                 
                 return (
                   <div key={type} className="flex flex-col gap-2">
                     <div className="flex justify-between items-end">
                       <span className="text-sm font-bold capitalize text-charcoal">{type}</span>
                       <span className="text-xs font-black text-gray-900">
                         {(count || 0).toLocaleString()} / {isUnlimited ? "∞" : (limit || 0).toLocaleString()}
                       </span>
                     </div>
                     <div className="flex items-center gap-3">
                       <div className="flex-1 overflow-hidden bg-gray-100 rounded-full h-2 relative">
                         {isUnlimited ? (
                           <div className="absolute top-0 left-0 h-full w-full bg-green-400 rounded-full"></div>
                         ) : (
                           <div className="absolute top-0 left-0 h-full bg-accent rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                         )}
                       </div>
                       <span className={`text-xs font-bold w-10 text-right ${isUnlimited ? "text-green-600" : pct > 80 ? "text-amber-600" : "text-gray-800"}`}>
                         {isUnlimited ? "UNL" : `${Math.round(pct)}%`}
                       </span>
                     </div>
                   </div>
                 );
               })}
            </div>
         </div>

         {/* RECENT ACTIVITY */}
         <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-charcoal mb-4">Recent API Calls</h3>
            <div className="flex flex-col">
               {summary?.recent_logs && summary.recent_logs.length > 0 ? (
                 summary.recent_logs.map((log, i) => (
                   <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors px-2 -mx-2 rounded-lg cursor-default">
                     <div className="flex items-center gap-3">
                       <span className="bg-gray-100 text-gray-800 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded w-12 text-center">
                         {log.method || "POST"}
                       </span>
                       <span className="text-sm font-bold text-charcoal truncate max-w-[150px] sm:max-w-[200px]">{log.endpoint || "/api/v1/parse"}</span>
                     </div>
                     <div className="flex items-center gap-4 text-xs font-bold">
                       <span className="text-gray-800 hidden sm:inline-block">{log.latency_ms ? `${Math.round(log.latency_ms)}ms` : ""}</span>
                       <span className="text-gray-800 mr-2">{log.time_ago || "just now"}</span>
                       <span className={`flex items-center justify-center w-4 h-4 rounded-full ${
                         log.status >= 200 && log.status < 300 ? "bg-green-100 text-green-500" :
                         log.status >= 400 && log.status < 500 ? "bg-gray-100 text-amber-500" :
                         "bg-red-100 text-red-500"
                       }`}>
                         <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                       </span>
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="w-full text-center py-8 text-sm font-semibold text-gray-400">No recent API calls found</div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
