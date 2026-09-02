import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { FiEye, FiUser, FiUserCheck } from 'react-icons/fi';
import api from '../../../services/api';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const TEAL = '#2b62c4';
const BLUE = '#2563eb';
const COLORS = ['#2b62c4', '#4fb3ad', '#2563eb', '#d97706', '#059669', '#7c3aed'];

function chartColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    muted: s.getPropertyValue('--adm-text-muted').trim() || '#94a3b8',
    border: s.getPropertyValue('--adm-border').trim() || 'rgba(100,116,139,0.15)',
  };
}

export default function VisitsSection({ period }) {
  const [visits, setVisits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admin.getVisits().catch(() => null)
      .then((res) => {
        if (res?.success) setVisits(res);
        setLoading(false);
      });
  }, [period]);

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading visit data…
      </div>
    );
  }

  const visitSeries = visits?.visit_series || [];
  const totalVisits    = visits?.total_visits ?? 0;
  const registeredTotal = visitSeries.reduce((s, r) => s + (r.users || 0), 0);
  const guestTotal      = visitSeries.reduce((s, r) => s + (r.guests || 0), 0);
  const visitorTotal    = registeredTotal + guestTotal || 1;
  const guestPct        = Math.round((guestTotal / visitorTotal) * 100);
  const registeredPct   = 100 - guestPct;

  const guestBehavior = Array.isArray(visits?.guest_behavior) ? visits.guest_behavior : [];

  return (
    <section className="adm-section adm-section-visits">
      {/* Top stats */}
      <div className="adm-stats">
        {[
          { label: 'Total Events',   value: fmt(visits?.total_visits),    icon: FiEye,      accent: '' },
          { label: 'Today',          value: fmt(visits?.today_visits),    icon: FiEye,      accent: 'green' },
          { label: 'This Month',     value: fmt(visits?.month_visits),    icon: FiEye,      accent: 'blue'  },
          { label: 'This Semester',  value: fmt(visits?.semester_visits), icon: FiEye,      accent: 'amber' },
          { label: 'This Year',      value: fmt(visits?.year_visits),     icon: FiEye,      accent: ''      },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className={`adm-stat${accent ? ` accent-${accent}` : ''}`}>
            <div className="adm-stat-top">
              <span className="adm-stat-label">{label}</span>
              <span className="adm-stat-icon"><Icon /></span>
            </div>
            <div className="adm-stat-value">{value}</div>
          </div>
        ))}
      </div>

      {/* Visit trend chart */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Visit Trend</h3>
        </div>
        <div className="adm-chart" style={{ height: 220 }}>
          {visitSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visitSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={TEAL} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGuest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BLUE} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors().border} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="total"      stroke={TEAL} strokeWidth={2} fill="url(#gradVisits)" name="Total" isAnimationActive={false} />
                <Area type="monotone" dataKey="guests"     stroke={BLUE} strokeWidth={1.5} fill="url(#gradGuest)" name="Guests" strokeDasharray="4 2" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="adm-empty"><div className="adm-empty-icon">📈</div><p>No visit trend data yet.</p></div>
          )}
        </div>
      </div>

      {/* Guest vs Registered split */}
      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Visitor Breakdown</h3>
          </div>
          <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Guest Visitors',   pct: guestPct,      count: guestTotal,      icon: FiUser,      color: BLUE },
              { label: 'Registered Users', pct: registeredPct, count: registeredTotal, icon: FiUserCheck, color: TEAL },
            ].map((row) => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <row.icon size={14} style={{ color: row.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                    {fmt(row.count)} &middot; {Math.round(row.pct)}%
                  </div>
                </div>
                <div className="adm-progress-bar">
                  <div className="adm-progress-fill" style={{ width: `${row.pct}%`, background: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guest behavior */}
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Guest Behavior</h3>
            <span className="adm-badge adm-badge-gray">Top pages accessed</span>
          </div>
          <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guestBehavior.length === 0 && (
              <div className="adm-empty"><div className="adm-empty-icon">👤</div><p>No guest behavior data yet.</p></div>
            )}
            {guestBehavior.map((item, i) => {
              const max = Math.max(...guestBehavior.map((g) => g.count), 1);
              const pct = Math.round((item.count / max) * 100);
              return (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(item.count)}</span>
                  </div>
                  <div className="adm-progress-bar">
                    <div className="adm-progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features accessed by guests */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Content & Features Accessed by Guests</h3>
        </div>
        <div className="adm-card-body">
          <div style={{ height: 180 }}>
            {guestBehavior.some((g) => g.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={guestBehavior} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors().border} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Visits" isAnimationActive={false}>
                    {guestBehavior.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="adm-empty"><div className="adm-empty-icon">👤</div><p>No guest behavior data yet.</p></div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
