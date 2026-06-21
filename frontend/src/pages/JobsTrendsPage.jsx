import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Briefcase, DollarSign, Globe, Award, Sparkles } from 'lucide-react';
import { Header, Footer } from '../components/user/site-chrome';

const salaryTimeline = [
  { year: '2023', salary: 112 },
  { year: '2024', salary: 124 },
  { year: '2025', salary: 138 },
  { year: '2026 (Est)', salary: 154 }
];

const regionDistribution = [
  { name: 'Bengaluru', value: 450, color: '#2563EB' },
  { name: 'San Francisco', value: 380, color: '#0F56B3' },
  { name: 'Zurich', value: 180, color: '#22C55E' },
  { name: 'London', value: 240, color: '#8b5cf6' }
];

export default function JobsTrendsPage() {
  return (
    <div className="min-h-screen bg-[#f5f4ef] text-[#2A2A2A] font-sans flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">Market Intelligence</span>
          <h1 className="text-3xl font-extrabold text-[#2A2A2A]">Market Trends & Insights</h1>
          <p className="text-sm text-[#5c5c5c] max-w-2xl">
            Analyze wage trajectories, regional volumes, and domain demands processed across the Vishleshan ingestion engine.
          </p>
        </div>

        {/* High-level widgets grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-[#e6dfcd] p-6 rounded-2xl shadow-sm space-y-2">
            <div className="text-xs text-[#5c5c5c] font-medium uppercase tracking-wider">Average Tech Base</div>
            <div className="text-3xl font-black text-[#2A2A2A]">$148,200</div>
            <div className="text-xs text-green-500 font-semibold flex items-center">&uarr; +12.4% vs last year</div>
          </div>
          
          <div className="bg-white border border-[#e6dfcd] p-6 rounded-2xl shadow-sm space-y-2">
            <div className="text-xs text-[#5c5c5c] font-medium uppercase tracking-wider">Hiring Velocity Index</div>
            <div className="text-3xl font-black text-[#2A2A2A]">8.4 / 10</div>
            <div className="text-xs text-green-500 font-semibold flex items-center">&uarr; 3.2 days faster closures</div>
          </div>

          <div className="bg-white border border-[#e6dfcd] p-6 rounded-2xl shadow-sm space-y-2">
            <div className="text-xs text-[#5c5c5c] font-medium uppercase tracking-wider">Top Remote Hub</div>
            <div className="text-3xl font-black text-[#2563EB]">San Francisco</div>
            <div className="text-xs text-[#5c5c5c] font-medium">32% of all remote uploads</div>
          </div>

          <div className="bg-white border border-[#e6dfcd] p-6 rounded-2xl shadow-sm space-y-2">
            <div className="text-xs text-[#5c5c5c] font-medium uppercase tracking-wider">Active JDs Tracked</div>
            <div className="text-3xl font-black text-[#0F56B3]">2,450</div>
            <div className="text-xs text-[#5c5c5c] font-medium">Updated 5 minutes ago</div>
          </div>
        </div>

        {/* Visual Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Chart 1: Salary Growthtimeline */}
          <div className="bg-white border border-[#e6dfcd] p-6 rounded-3xl shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-[#2A2A2A]">Annual Wage Trajectory</h3>
              <p className="text-xs text-[#5c5c5c]">Median base salaries for senior software engineers (in thousands).</p>
            </div>
            
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%" minHeight={256} minWidth={100}>
                <AreaChart data={salaryTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f4ef" />
                  <XAxis dataKey="year" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 8 }} />
                  <Area type="monotone" dataKey="salary" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#salaryGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Regional hiring volume distribution */}
          <div className="bg-white border border-[#e6dfcd] p-6 rounded-3xl shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-[#2A2A2A]">Regional Posting Share</h3>
              <p className="text-xs text-[#5c5c5c]">Distribution of active requisitions across geographic networks.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6">
              <div className="md:col-span-6 h-56">
                <ResponsiveContainer width="100%" height="100%" minHeight={224} minWidth={100}>
                  <PieChart>
                    <Pie
                      data={regionDistribution}
                      cx="50%" cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {regionDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="md:col-span-6 space-y-3">
                {regionDistribution.map((region, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: region.color }} />
                      <span className="text-[#5c5c5c]">{region.name}</span>
                    </div>
                    <span className="text-[#2A2A2A]">{region.value} openings</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Growing Skills matching bottom of inspiratio_ui2.jpeg */}
        <section className="space-y-4">
          <h3 className="font-extrabold text-lg text-[#2A2A2A]">High-Growth Domains</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#e6dfcd] p-6 rounded-2xl shadow-sm flex items-start space-x-4">
              <div className="bg-[#22C55E]/10 p-3 rounded-xl text-[#22C55E] shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[#2A2A2A]">Prompt Engineering</h4>
                <p className="text-xs text-[#5c5c5c]">Highest request growth this quarter (+48%).</p>
                <div className="text-xs font-bold text-[#22C55E] pt-1">Avg Pay: $185k</div>
              </div>
            </div>

            <div className="bg-white border border-[#e6dfcd] p-6 rounded-2xl shadow-sm flex items-start space-x-4">
              <div className="bg-[#0F56B3]/10 p-3 rounded-xl text-[#0F56B3] shrink-0">
                <Award size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[#2A2A2A]">Design Systems</h4>
                <p className="text-xs text-[#5c5c5c]">Steady enterprise adoption indices (+14%).</p>
                <div className="text-xs font-bold text-[#0F56B3] pt-1">Avg Pay: $140k</div>
              </div>
            </div>

            <div className="bg-white border border-[#e6dfcd] p-6 rounded-2xl shadow-sm flex items-start space-x-4">
              <div className="bg-[#2563EB]/10 p-3 rounded-xl text-[#2563EB] shrink-0">
                <TrendingUp size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[#2A2A2A]">Rust / Go Backend</h4>
                <p className="text-xs text-[#5c5c5c]">High throughput performance demand (+22%).</p>
                <div className="text-xs font-bold text-[#2563EB] pt-1">Avg Pay: $165k</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
