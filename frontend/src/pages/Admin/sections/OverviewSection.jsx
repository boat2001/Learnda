import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { FiUsers, FiDollarSign, FiActivity, FiBook } from 'react-icons/fi';
import api from '../../../services/api';
import { displayContact } from '../adminUtils';

function StatCard({ label, value, change, icon: Icon, accent }) {
  const isUp = change > 0;
  const isDown = change < 0;
  return (
    <div className={`adm-stat${accent ? ` accent-${accent}` : ''}`}>
      <div className="adm-stat-top">
        <span className="adm-stat-label">{label}</span>
        <span className="adm-stat-icon"><Icon /></span>
      </div>
      <div className="adm-stat-value">{value ?? '—'}</div>
      {change !== undefined && (
        <div className={`adm-stat-change ${isUp ? 'up' : isDown ? 'down' : 'neutral'}`}>
          {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(change).toFixed(1)}% vs prev period
        </div>
      )}
    </div>
  );
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCurrency(n) {
  if (n == null) return '—';
  return `GH₵ ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TEAL = '#2b62c4';
const TEAL_LIGHT = '#5b95ea';

function chartColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    muted: s.getPropertyValue('--adm-text-muted').trim() || '#94a3b8',
    border: s.getPropertyValue('--adm-border').trim() || 'rgba(100,116,139,0.15)',
  };
}

export default function OverviewSection({ period }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [mrr, setMrr] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.admin.getStats(period).catch(() => null),
      api.admin.getActivity(8).catch(() => null),
      api.admin.getMrr().catch(() => null),
      api.admin.getUserAnalytics(period).catch(() => null),
    ]).then(([statsRes, activityRes, mrrRes, usersRes]) => {
      if (statsRes?.success)   setStats(statsRes.stats);
      if (activityRes?.success) setActivity(activityRes.activity || []);
      if (mrrRes?.success)     setMrr(mrrRes);
      if (usersRes?.success)   setUserAnalytics(usersRes);
      setLoading(false);
    });
  }, [period]);

  const growthSeries = userAnalytics?.growth_series || [];

  // Compute tier counts from plan_breakdown array [{name, count, mrr}]
  const planBreakdown = mrr?.plan_breakdown || [];
  const findTier = (keywords) => planBreakdown
    .filter((p) => keywords.some((k) => String(p.name || '').toLowerCase().includes(k)))
    .reduce((s, p) => s + (p.count || 0), 0);
  const seriousUsers = findTier(['serious']);
  const masterUsers  = findTier(['master']);
  const basicUsers   = Math.max(0, (stats?.total_users ?? 0) - seriousUsers - masterUsers);

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading overview…
      </div>
    );
  }

  return (
    <section className="adm-section adm-section-overview">
      {/* KPI stats */}
      <div className="adm-stats">
        <StatCard
          label="Total Users"
          value={fmt(stats?.total_users)}
          change={stats?.user_growth}
          icon={FiUsers}
        />
        <StatCard
          label="Active Today (DAU)"
          value={fmt(userAnalytics?.dau)}
          icon={FiActivity}
          accent="green"
        />
        <StatCard
          label="Monthly Recurring Revenue"
          value={fmtCurrency(mrr?.mrr)}
          icon={FiDollarSign}
          accent="amber"
        />
        <StatCard
          label="Content Items"
          value={fmt(stats?.total_content)}
          icon={FiBook}
          accent="blue"
        />
      </div>

      {/* Secondary stats row */}
      <div className="adm-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))' }}>
        <StatCard label="MAU"             value={fmt(userAnalytics?.mau)}         icon={FiUsers} />
        <StatCard label="Paying Users"    value={fmt(mrr?.paying_users)}          icon={FiDollarSign} />
        <StatCard label="Contributors"    value={fmt(stats?.total_contributors)}   icon={FiUsers} />
        <StatCard label="Pending Reviews" value={fmt(stats?.pending_reviews)}      icon={FiBook}  />
        <StatCard label="Payout Requests" value={fmt(stats?.pending_payouts)}      icon={FiDollarSign} accent="red" />
      </div>

      {/* Growth chart + Activity */}
      <div className="adm-grid-2-1">
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">User Growth</h3>
          </div>
          <div className="adm-chart" style={{ height: 240 }}>
            {growthSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={TEAL} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors().border} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--adm-text)', fontWeight: 700 }}
                  />
                  <Area type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} fill="url(#gradUsers)" name="New Users" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="adm-empty">
                <div className="adm-empty-icon">📈</div>
                <p>No growth data for this period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Recent Activity</h3>
          </div>
          <div className="adm-card-body">
            {activity.length > 0 ? (
              <div className="adm-activity">
                {activity.map((item, i) => (
                  <div key={i} className="adm-activity-item">
                    <div className="adm-activity-dot" />
                    <div>
                      <div className="adm-activity-text">{item.description || item.action}</div>
                      <div className="adm-activity-time">
                        {item.user?.name || displayContact(item.user) || 'System'} &middot;{' '}
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="adm-empty">
                <div className="adm-empty-icon">🔔</div>
                <p>No recent activity.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subscription breakdown */}
      {stats && (
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Subscription Breakdown</h3>
          </div>
          <div className="adm-card-body">
            <div className="adm-grid-3">
              {[
                { label: 'Free Learner', count: basicUsers,   color: '#94a3b8' },
                { label: 'Helper',       count: seriousUsers, color: TEAL      },
                { label: 'Hero',         count: masterUsers,  color: '#d97706' },
              ].map((tier) => {
                const total = basicUsers + seriousUsers + masterUsers;
                const pct = total > 0 ? Math.round((tier.count / total) * 100) : 0;
                return (
                  <div key={tier.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{tier.label}</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--adm-text)' }}>{fmt(tier.count)}</span>
                    </div>
                    <div className="adm-progress-bar">
                      <div className="adm-progress-fill" style={{ width: `${pct}%`, background: tier.color }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{pct}% of total users</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
