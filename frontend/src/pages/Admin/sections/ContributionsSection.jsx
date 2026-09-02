import { useState, useEffect } from 'react';
import { FiAward, FiUsers, FiDollarSign, FiStar } from 'react-icons/fi';
import api from '../../../services/api';
import { displayContact } from '../adminUtils';

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

const BADGE_COLORS = ['#d97706', '#94a3b8', '#d97706', '#1f7177', '#059669'];
const LEVEL_COLORS = ['#94a3b8', '#059669', '#2563eb', '#7c3aed', '#d97706'];

export default function ContributionsSection({ period }) {
  const [stats, setStats]     = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.admin.getStats(period).catch(() => null),
      api.admin.getRewardPayouts({ limit: 10 }).catch(() => null),
      api.admin.getContributorApplications({ status: 'approved', limit: 20 }).catch(() => null),
    ]).then(([statsRes, payoutsRes, contribRes]) => {
      if (statsRes?.success)  setStats(statsRes.stats);
      if (payoutsRes?.success) setPayouts(payoutsRes.payouts || []);
      if (contribRes?.success) setContributors(contribRes.applications || []);
      setLoading(false);
    });
  }, [period]);

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading contributions…
      </div>
    );
  }

  const badges = stats?.badges || [
    { name: 'Gold Star',     count: stats?.goldBadges    || 0 },
    { name: 'Silver',        count: stats?.silverBadges  || 0 },
    { name: 'Bronze',        count: stats?.bronzeBadges  || 0 },
    { name: 'Rising Star',   count: stats?.risingBadges  || 0 },
    { name: 'Top Educator',  count: stats?.topEdBadges   || 0 },
  ];

  const levels = stats?.levels || [
    { name: 'Beginner',      count: 0 },
    { name: 'Intermediate',  count: 0 },
    { name: 'Advanced',      count: 0 },
    { name: 'Expert',        count: 0 },
    { name: 'Master',        count: 0 },
  ];

  return (
    <section className="adm-section adm-section-contributions">
      {/* Summary stats */}
      <div className="adm-stats">
        <div className="adm-stat accent-green">
          <div className="adm-stat-top">
            <span className="adm-stat-label">Contributors</span>
            <span className="adm-stat-icon"><FiUsers /></span>
          </div>
          <div className="adm-stat-value">{fmt(stats?.total_contributors)}</div>
        </div>
        <div className="adm-stat accent-amber">
          <div className="adm-stat-top">
            <span className="adm-stat-label">Content Contributed</span>
            <span className="adm-stat-icon"><FiAward /></span>
          </div>
          <div className="adm-stat-value">{fmt(stats?.total_content)}</div>
        </div>
        <div className="adm-stat accent-red">
          <div className="adm-stat-top">
            <span className="adm-stat-label">Pending Payouts</span>
            <span className="adm-stat-icon"><FiDollarSign /></span>
          </div>
          <div className="adm-stat-value">{fmt(stats?.pending_payouts)}</div>
        </div>
      </div>

      {/* Leaderboard + Badges */}
      <div className="adm-grid-2-1">
        {/* Top contributors leaderboard */}
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Contributor Leaderboard</h3>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Contributor</th>
                  <th>Content</th>
                  <th>Engagement</th>
                  <th>Earnings</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {contributors.slice(0, 10).map((c, i) => (
                  <tr key={c.id || i}>
                    <td>
                      <span style={{ fontWeight: 800, color: i < 3 ? '#d97706' : 'var(--adm-text-muted)' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.user?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{displayContact(c.user)}</div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmt(c.contentCount || c.content_count)}</td>
                    <td>
                      <span className="adm-badge adm-badge-teal">{fmt(c.engagement || c.totalEngagement)}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--adm-green)' }}>
                      {fmtCurrency(c.earnings || c.totalEarnings)}
                    </td>
                    <td>
                      <span className="adm-badge adm-badge-blue">Lv {c.level || 1}</span>
                    </td>
                  </tr>
                ))}
                {contributors.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="adm-empty"><div className="adm-empty-icon">🏆</div><p>No contributors yet.</p></div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Badges + Levels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card">
            <div className="adm-card-header">
              <h3 className="adm-card-title">Badges Earned</h3>
            </div>
            <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {badges.map((badge, i) => {
                const max = Math.max(...badges.map((b) => b.count), 1);
                const pct = Math.round((badge.count / max) * 100);
                return (
                  <div key={badge.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>
                        <FiStar size={11} style={{ color: BADGE_COLORS[i % BADGE_COLORS.length], marginRight: 4, verticalAlign: 'middle' }} />
                        {badge.name}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(badge.count)}</span>
                    </div>
                    <div className="adm-progress-bar">
                      <div className="adm-progress-fill" style={{ width: `${pct}%`, background: BADGE_COLORS[i % BADGE_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-header">
              <h3 className="adm-card-title">Contributor Levels</h3>
            </div>
            <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {levels.map((lvl, i) => {
                const max = Math.max(...levels.map((l) => l.count), 1);
                const pct = Math.round((lvl.count / max) * 100);
                return (
                  <div key={lvl.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>{lvl.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(lvl.count)}</span>
                    </div>
                    <div className="adm-progress-bar">
                      <div className="adm-progress-fill" style={{ width: `${pct}%`, background: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Payout requests */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Payout Requests</h3>
          <span className="adm-badge adm-badge-amber">{payouts.length} pending</span>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Contributor</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.user?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{displayContact(p.user)}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{fmtCurrency(p.amount)}</td>
                  <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{p.method || 'Mobile Money'}</td>
                  <td>
                    <span className={`adm-badge ${p.status === 'paid' ? 'adm-badge-green' : p.status === 'rejected' ? 'adm-badge-red' : 'adm-badge-amber'}`}>
                      {p.status || 'requested'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="adm-empty"><div className="adm-empty-icon">💰</div><p>No payout requests.</p></div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
