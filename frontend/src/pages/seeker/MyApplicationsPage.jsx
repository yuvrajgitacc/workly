import React, { useEffect, useState } from 'react';
import { seekerAPI } from '../../lib/api';
import ApplicationStatusChip from '../../components/ApplicationStatusChip';
import { ClipboardList, Briefcase, Calendar } from 'lucide-react';
import JobsNavbar from '../../components/JobsNavbar';
import { CompanyLogo } from '../../components/user/company-logo';

export default function MyApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    seekerAPI.getApplications()
      .then(d => setApps(d.applications || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, []);

  const FILTERS = ['all', 'applied', 'shortlisted', 'hired', 'rejected'];
  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter);

  const counts = {};
  FILTERS.forEach(f => { counts[f] = f === 'all' ? apps.length : apps.filter(a => a.status === f).length; });

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-[#2A2A2A] font-sans flex flex-col">
      <JobsNavbar />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 flex justify-center">
        <div style={styles.page}>
          <div style={styles.header}>
            <div>
              <h1 style={styles.title}>My Applications</h1>
              <p style={styles.subtitle}>{apps.length} total applications</p>
            </div>
          </div>

      {/* Filter Tabs */}
      <div style={styles.filterRow}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {counts[f] > 0 && <span style={styles.filterCount}>{counts[f]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <ClipboardList size={40} color="#d1d5db" />
          <p style={{ color: '#9ca3af' }}>
            {filter === 'all' ? "You haven't applied to any jobs yet." : `No ${filter} applications.`}
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map(app => (
            <div key={app.id} style={styles.card}>
              <div style={styles.cardLeft}>
                <CompanyLogo name={app.company_name} logoPath={app.company_logo_path} size={42} />
                <div>
                  <div style={styles.jobTitle}>{app.job_title}</div>
                  <div style={styles.companyName}>
                    <Briefcase size={12} /> {app.company_name}
                  </div>
                  <div style={styles.appliedDate}>
                    <Calendar size={12} /> Applied {formatDate(app.applied_at)}
                  </div>
                </div>
              </div>
              <div style={styles.cardRight}>
                <ApplicationStatusChip status={app.status} />
                {app.updated_at !== app.applied_at && (
                  <div style={styles.updatedAt}>Updated {timeAgo(app.updated_at)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        </div>
      </main>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const styles = {
  page: { maxWidth: '800px' },
  header: { marginBottom: '20px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', margin: 0 },
  filterRow: { display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' },
  filterBtn: {
    padding: '7px 16px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#6b7280', fontWeight: 500, fontSize: '13px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
  },
  filterBtnActive: { background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe', fontWeight: 600 },
  filterCount: {
    background: '#e5e7eb', color: '#374151', borderRadius: '10px',
    padding: '1px 7px', fontSize: '11px', fontWeight: 700,
  },
  empty: { textAlign: 'center', padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px',
    padding: '18px 20px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', transition: 'box-shadow 0.2s',
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  avatar: {
    width: '42px', height: '42px', borderRadius: '11px', background: '#eff6ff',
    color: '#2563eb', fontWeight: 700, fontSize: '17px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  jobTitle: { fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' },
  companyName: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280', marginBottom: '3px' },
  appliedDate: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#9ca3af' },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' },
  updatedAt: { fontSize: '11px', color: '#9ca3af' },
};
