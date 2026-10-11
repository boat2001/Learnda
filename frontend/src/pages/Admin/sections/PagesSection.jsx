import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FiLayout } from 'react-icons/fi';
import api from '../../../services/api';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const PAGES = [
  { key: 'home',          label: 'Home'            },
  { key: 'courses',       label: 'Courses'         },
  { key: 'lessons',       label: 'Lessons'         },
  { key: 'tests',         label: 'Tests'           },
  { key: 'edutainment',   label: 'Edutainment'     },
  { key: 'community',     label: 'Community'       },
  { key: 'groups',        label: 'Study Groups'    },
  { key: 'profile',       label: 'Profile'         },
  { key: 'spotlight',     label: 'Spotlight'       },
  { key: 'updates',       label: 'Updates/Blog'    },
  { key: 'library',       label: 'Library'         },
  { key: 'leaderboard',   label: 'Leaderboard'     },
  { key: 'subscription',  label: 'Contribution'    },
  { key: 'settings',      label: 'Settings'        },
];

const COLORS = ['#2b62c4', '#5b95ea', '#2563eb', '#d97706', '#059669', '#7c3aed', '#dc2626', '#94a3b8'];

function chartColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    muted: s.getPropertyValue('--adm-text-muted').trim() || '#94a3b8',
    border: s.getPropertyValue('--adm-border').trim() || 'rgba(100,116,139,0.15)',
  };
}

export default function PagesSection({ period }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admin.getAnalytics(period, 'all')
      .then((res) => {
        if (res?.success) setAnalytics(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading page metrics…
      </div>
    );
  }

  const pageStats = PAGES.map((pg) => ({
    label: pg.label,
    users:  analytics?.pageEngagement?.[pg.key]?.users  ?? 0,
    guests: analytics?.pageEngagement?.[pg.key]?.guests ?? 0,
    total: (analytics?.pageEngagement?.[pg.key]?.users ?? 0) + (analytics?.pageEngagement?.[pg.key]?.guests ?? 0),
  })).sort((a, b) => b.total - a.total);

  const topByUsers  = [...pageStats].sort((a, b) => b.users  - a.users).slice(0, 6);
  const topByGuests = [...pageStats].sort((a, b) => b.guests - a.guests).slice(0, 6);

  return (
    <>
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Page Engagement — Registered Users</h3>
        </div>
        <div className="adm-chart" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topByUsers} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors().border} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="users" name="User Views" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {topByUsers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Page Engagement — Guest Visitors</h3>
        </div>
        <div className="adm-chart" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topByGuests} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors().border} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="guests" name="Guest Views" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {topByGuests.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full table */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">All Pages & Features</h3>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Page / Feature</th>
                <th>User Views</th>
                <th>Guest Views</th>
                <th>Total</th>
                <th>User Share</th>
              </tr>
            </thead>
            <tbody>
              {pageStats.map((pg) => {
                const share = pg.total > 0 ? Math.round((pg.users / pg.total) * 100) : 0;
                return (
                  <tr key={pg.label}>
                    <td style={{ fontWeight: 600 }}>{pg.label}</td>
                    <td>{fmt(pg.users)}</td>
                    <td>{fmt(pg.guests)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(pg.total)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="adm-progress-bar" style={{ flex: 1 }}>
                          <div className="adm-progress-fill" style={{ width: `${share}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--adm-text-muted)', minWidth: 28 }}>{share}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pageStats.every((p) => p.total === 0) && (
        <div className="adm-empty" style={{ paddingTop: 20 }}>
          <div className="adm-empty-icon"><FiLayout /></div>
          <p>Page engagement tracking not yet active. Analytics events will appear here once users start navigating the app.</p>
        </div>
      )}
    </>
  );
}
