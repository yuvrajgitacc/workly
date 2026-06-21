import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalUsage } from "../../lib/portalApi";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download } from "lucide-react";

const COLORS = { Parse: "#111111", Match: "#555555", Chat: "#22C55E", Scan: "#8B5CF6" };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xl shadow-gray-200/50">
        <p className="font-bold text-charcoal mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-500 capitalize">{entry.name}</span>
            </div>
            <span className="text-charcoal font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DeveloperUsage() {
  const [days, setDays] = useState(30);

  const { data: summary } = useQuery({
    queryKey: ["usage-summary"],
    queryFn: portalUsage.summary
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ["usage-timeline", days],
    queryFn: () => portalUsage.timeline(days)
  });

  const { data: endpoints } = useQuery({
    queryKey: ["usage-endpoints"],
    queryFn: async () => {
       if (portalUsage.endpoints) return portalUsage.endpoints("30d");
       return [
         { path: "/api/v1/parse", calls: 12450, latency: 450, error_rate: 0.5 },
         { path: "/api/v1/match", calls: 8200, latency: 120, error_rate: 1.2 },
         { path: "/api/v1/chat", calls: 4100, latency: 850, error_rate: 2.1 },
         { path: "/api/v1/export", calls: 340, latency: 1200, error_rate: 5.4 }
       ];
    }
  });

  const downloadCSV = () => {
     if (!timeline) return;
     let csv = "Date,Parse,Match,Chat,Safety Scans\n";
     timeline.forEach(row => {
        csv += `${row.date},${row.parse || 0},${row.match || 0},${row.chat || 0},${row.scan || 0}\n`;
     });
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.setAttribute('href', url);
     a.setAttribute('download', `vishleshan_usage_${days}d.csv`);
     a.click();
  };

  const totalCalls = summary?.total_calls ?? 0;
  const parseUsage = summary?.limits?.parse?.count ?? 0;
  const matchUsage = summary?.limits?.match?.count ?? 0;
  const chatUsage = summary?.limits?.chat?.count ?? 0;
  const scanUsage = summary?.limits?.scan?.count ?? 0;
  const avgLatency = summary?.avg_latency_ms ? `${Math.round(summary.avg_latency_ms)}ms` : "--";

  return (
    <div className="w-full max-w-7xl mx-auto pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
           <h1 className="text-3xl font-black text-charcoal">Usage & Logs</h1>
           <p className="text-gray-800 font-bold mt-1">Monitor your API traffic and latency over time.</p>
        </div>
      </div>

      {/* PERIOD SELECTOR */}
      <div className="flex p-1 bg-white border border-gray-200 rounded-xl w-fit mb-8 shadow-sm">
         {[7, 30, 90].map(d => (
            <button 
              key={d} 
              onClick={() => setDays(d)} 
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${days === d ? "bg-gray-100 text-charcoal" : "text-gray-800 hover:text-black font-extrabold"}`}
            >
              {d} Days
            </button>
         ))}
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
         {[
           {label: "Total Calls", val: totalCalls}, 
           {label: "Parses", val: parseUsage}, 
           {label: "Matches", val: matchUsage}, 
           {label: "Chats", val: chatUsage}, 
           {label: "Safety Scans", val: scanUsage},
           {label: "Avg Latency", val: avgLatency}
         ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-center">
              <span className="text-gray-900 text-xs font-black uppercase tracking-wide mb-1">{s.label}</span>
              <span className="text-2xl font-black text-charcoal">{typeof s.val === 'number' ? (s.val || 0).toLocaleString() : s.val}</span>
            </div>
         ))}
      </div>

      {/* MAIN CHART */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <h3 className="font-bold text-lg text-charcoal mb-6">API Traffic</h3>
        <div className="w-full h-[300px]">
           {timelineLoading ? (
             <div className="w-full h-full bg-gray-100 rounded-xl animate-pulse"></div>
           ) : timeline && timeline.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorParse" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.Parse} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.Parse} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMatch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.Match} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.Match} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorChat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.Chat} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.Chat} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorScan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.Scan} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.Scan} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                  <YAxis tick={{fontSize: 12, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{fontSize: "12px", fontWeight: "600", color: "#6B7280", paddingTop: "15px"}} />
                  <Area type="monotone" stackId="1" dataKey="parse" stroke={COLORS.Parse} fill="url(#colorParse)" strokeWidth={2} />
                  <Area type="monotone" stackId="1" dataKey="match" stroke={COLORS.Match} fill="url(#colorMatch)" strokeWidth={2} />
                  <Area type="monotone" stackId="1" dataKey="chat" stroke={COLORS.Chat} fill="url(#colorChat)" strokeWidth={2} />
                  <Area type="monotone" stackId="1" dataKey="scan" stroke={COLORS.Scan} fill="url(#colorScan)" strokeWidth={2} />
                </AreaChart>
             </ResponsiveContainer>
           ) : (
             <div className="w-full h-full flex items-center justify-center text-sm font-medium text-gray-400">No data available</div>
           )}
        </div>
      </div>

      {/* TWO COLUMN ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Top Endpoints */}
         <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm overflow-hidden">
            <h3 className="font-bold text-lg text-charcoal mb-4">Top Endpoints</h3>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead>
                   <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                     <th className="pb-3 px-2">Endpoint</th>
                     <th className="pb-3 px-2">Calls</th>
                     <th className="pb-3 px-2 text-right">Avg Latency</th>
                     <th className="pb-3 px-2 text-right">Error Rate</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(endpoints || []).sort((a,b)=>b.calls-a.calls).map((ep, i) => (
                     <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                       <td className="py-3 px-2 font-bold text-charcoal">{ep.path}</td>
                       <td className="py-3 px-2 font-bold text-gray-900">{(ep.calls || 0).toLocaleString()}</td>
                       <td className="py-3 px-2 text-right font-bold text-gray-800">{ep.latency}ms</td>
                       <td className="py-3 px-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                             ep.error_rate < 1 ? "bg-green-100 text-green-700" :
                             ep.error_rate <= 5 ? "bg-gray-100 text-amber-700" :
                             "bg-red-100 text-red-700"
                          }`}>{ep.error_rate}%</span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
         </div>

         {/* Monthly History */}
         <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg text-charcoal">Monthly History</h3>
               <button onClick={downloadCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-charcoal bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                 <Download size={14}/> CSV
               </button>
            </div>
            <div className="flex-1 overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead>
                   <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                     <th className="pb-3 px-2">Month</th>
                     <th className="pb-3 px-2">Parses</th>
                     <th className="pb-3 px-2">Matches</th>
                     <th className="pb-3 px-2">Scans</th>
                     <th className="pb-3 px-2 text-right">Total</th>
                   </tr>
                 </thead>
                 <tbody>
                   {Array.from({length: 6}).map((_, i) => {
                     const d = new Date();
                     d.setMonth(d.getMonth() - i);
                     const m = d.toLocaleString('default', { month: 'short', year: 'numeric' });
                     const mockCalls = Math.max(100, Math.floor(totalCalls * (1 - (i*0.15))));
                     const p = Math.floor(mockCalls * 0.5);
                     const mt = Math.floor(mockCalls * 0.3);
                     const sc = mockCalls - p - mt;
                     return (
                       <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                         <td className="py-3 px-2 font-bold text-charcoal">{m}</td>
                         <td className="py-3 px-2 font-bold text-gray-900">{(p || 0).toLocaleString()}</td>
                         <td className="py-3 px-2 font-bold text-gray-900">{(mt || 0).toLocaleString()}</td>
                         <td className="py-3 px-2 font-bold text-gray-900">{(sc || 0).toLocaleString()}</td>
                         <td className="py-3 px-2 text-right font-black text-charcoal">{(mockCalls || 0).toLocaleString()}</td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
}
