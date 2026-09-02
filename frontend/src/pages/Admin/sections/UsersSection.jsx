import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { FiUsers, FiActivity, FiTrendingUp, FiSearch, FiShield } from 'react-icons/fi';
import api, { resolveUploadUrl } from '../../../services/api';
import UserDetailModal from '../components/UserDetailModal';
import { displayContact } from '../adminUtils';

function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`adm-stat${accent ? ` accent-${accent}` : ''}`}>
      <div className="adm-stat-top">
        <span className="adm-stat-label">{label}</span>
        <span className="adm-stat-icon"><Icon /></span>
      </div>
      <div className="adm-stat-value">{value ?? '—'}</div>
      {sub && <div className="adm-stat-change neutral">{sub}</div>}
    </div>
  );
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const TEAL = '#2b62c4';
const COLORS = ['#2b62c4', '#4fb3ad', '#2563eb', '#d97706', '#059669', '#dc2626', '#7c3aed', '#94a3b8'];

function chartColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    muted: s.getPropertyValue('--adm-text-muted').trim() || '#94a3b8',
    border: s.getPropertyValue('--adm-border').trim() || 'rgba(100,116,139,0.15)',
  };
}

function BreakdownCard({ title, data, labelKey = 'label', valueKey = 'count' }) {
  const max = Math.max(...(data || []).map((d) => d[valueKey] || 0), 1);
  return (
    <div className="adm-card">
      <div className="adm-card-header">
        <h3 className="adm-card-title">{title}</h3>
      </div>
      <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(!data || data.length === 0) ? (
          <div className="adm-empty"><div className="adm-empty-icon">📊</div><p>No data available.</p></div>
        ) : data.map((item, i) => {
          const pct = max > 0 ? Math.round((item[valueKey] / max) * 100) : 0;
          return (
            <div key={item[labelKey] || i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--adm-text)' }}>{item[labelKey] || '—'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text)' }}>{fmt(item[valueKey])}</span>
              </div>
              <div className="adm-progress-bar">
                <div className="adm-progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivenessTable({ users }) {
  const categories = [
    { label: 'Highly Active',  min: 75,  color: '#059669' },
    { label: 'Active',         min: 50,  color: '#2b62c4' },
    { label: 'Moderate',       min: 25,  color: '#d97706' },
    { label: 'Low / Churning', min: 0,   color: '#dc2626' },
  ];

  const counts = categories.map((cat, idx) => {
    const max = categories[idx - 1]?.min ?? 101;
    const count = (users || []).filter(
      (u) => u.activenessScore >= cat.min && u.activenessScore < max
    ).length;
    return { ...cat, count };
  });

  const total = counts.reduce((s, c) => s + c.count, 0) || 1;

  return (
    <div className="adm-card">
      <div className="adm-card-header">
        <h3 className="adm-card-title">Activeness Distribution</h3>
        <span className="adm-badge adm-badge-gray">{fmt(total)} scored</span>
      </div>
      <div className="adm-card-body">
        {counts.map((cat) => (
          <div key={cat.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--adm-text)', flex: 1 }}>{cat.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--adm-text)' }}>{fmt(cat.count)}</span>
            <span style={{ fontSize: 11, color: 'var(--adm-text-muted)', minWidth: 36, textAlign: 'right' }}>
              {Math.round((cat.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLES = ['student', 'lecturer', 'admin'];

const ROLE_BADGE = {
  admin:       'adm-badge-red',
  lecturer:    'adm-badge-blue',
  contributor: 'adm-badge-teal',
  student:     'adm-badge-gray',
};

const STATUS_BADGE = {
  active: 'adm-badge-green',
  warned: 'adm-badge-amber',
  suspended: 'adm-badge-amber',
  blocked: 'adm-badge-red',
  deleted: 'adm-badge-gray',
};

const STATUS_LABEL = {
  active: 'allowed',
  warned: 'warned',
  suspended: 'suspended',
  blocked: 'blocked',
  deleted: 'deleted',
};

const MODERATION_OPTIONS = [
  { value: 'allowed', label: 'Allowed' },
  { value: 'warn', label: 'Warn user' },
  { value: 'suspend', label: 'Suspend user' },
  { value: 'block', label: 'Block user' },
  { value: 'delete', label: 'Remove / delete' },
];

const moderationValueForStatus = (status) => {
  if (status === 'warned') return 'warn';
  if (status === 'suspended') return 'suspend';
  if (status === 'blocked') return 'block';
  if (status === 'deleted') return 'delete';
  return 'allowed';
};

function UserIdentityCell({ user }) {
  const name = user.full_name || user.email || 'Anonymous';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="adm-user-cell">
      <div className="adm-user-avatar-sm">
        {user.avatar_url ? (
          <img src={resolveUploadUrl(user.avatar_url)} alt={name} loading="lazy" decoding="async" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="adm-user-cell-text">
        <div className="adm-user-cell-name">{user.full_name || '-'}</div>
        <div className="adm-user-cell-contact">{displayContact(user)}</div>
      </div>
    </div>
  );
}

function ModerationPromptModal({ prompt, busy, onClose, onSubmit }) {
  const [reason, setReason] = useState(prompt.defaultReason || '');
  const [days, setDays] = useState(prompt.defaultDays || '7');
  const [error, setError] = useState('');
  const label = prompt.user.full_name || prompt.user.email || 'this user';

  const submit = (event) => {
    event.preventDefault();
    setError('');

    if (prompt.requiresDays) {
      const suspendDays = Number(days);
      if (!Number.isFinite(suspendDays) || suspendDays < 1) {
        setError('Suspension days must be at least 1.');
        return;
      }
      onSubmit({ reason, suspend_days: suspendDays });
      return;
    }

    onSubmit({ reason });
  };

  return (
    <div className="adm-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <form className="adm-modal adm-modal-prompt" role="dialog" aria-modal="true" aria-labelledby="moderation-prompt-title" onSubmit={submit}>
        <div className="adm-modal-header">
          <div>
            <h3 id="moderation-prompt-title" className="adm-modal-title">{prompt.title}</h3>
            <p className="adm-modal-kicker">{label}</p>
          </div>
          <button type="button" className="adm-modal-close" onClick={onClose} disabled={busy} aria-label="Close moderation dialog">
            &times;
          </button>
        </div>

        <div className="adm-modal-body adm-prompt-body">
          <p className="adm-prompt-message">{prompt.message}</p>

          {prompt.requiresDays && (
            <label className="adm-prompt-field">
              <span>Suspension length</span>
              <input
                className="adm-input adm-input-full"
                type="number"
                min="1"
                step="1"
                value={days}
                onChange={(event) => setDays(event.target.value)}
                disabled={busy}
              />
            </label>
          )}

          {prompt.requiresReason && (
            <label className="adm-prompt-field">
              <span>{prompt.reasonLabel || 'Message / reason'}</span>
              <textarea
                className="adm-textarea adm-textarea-full"
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={prompt.reasonPlaceholder || 'Add the message the user should receive.'}
                disabled={busy}
              />
            </label>
          )}

          {error && <div className="adm-alert adm-alert-danger">{error}</div>}
        </div>

        <div className="adm-modal-footer">
          <button type="button" className="adm-btn adm-btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={`adm-btn ${prompt.danger ? 'adm-btn-danger-solid' : 'adm-btn-primary'}`} disabled={busy}>
            {busy ? 'Working...' : prompt.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function UserManagementTable() {
  const [users, setUsers]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [changing, setChanging]   = useState({});
  const [toast, setToast]         = useState('');
  const [selected, setSelected]   = useState(null); // user for detail modal
  const [moderationPrompt, setModerationPrompt] = useState(null);
  const PER_PAGE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getUsers({ q: search, limit: PER_PAGE, page });
      if (res?.success) {
        setUsers(res.users || []);
        setTotal(res.total || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleRoleChange = async (user, newRole) => {
    if (newRole === user.role) return;
    setChanging((prev) => ({ ...prev, [user.id]: true }));
    try {
      const res = await api.admin.setUserRole(user.id, newRole);
      if (res?.success) {
        setUsers((prev) => prev.map((u) => u.id === user.id
          ? { ...u, role: newRole, is_contributor: newRole === 'admin' ? true : u.is_contributor }
          : u));
        showToast(`${user.full_name || user.email} → ${newRole}`);
      } else {
        showToast(res?.error || 'Failed to update role');
      }
    } catch {
      showToast('Error updating role');
    }
    setChanging((prev) => ({ ...prev, [user.id]: false }));
  };

  const patchUser = (id, patch) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u));
    setSelected((prev) => prev && prev.id === id ? { ...prev, ...patch } : prev);
  };

  const executeModeration = async (user, payload) => {
    const label = user.full_name || user.email || 'this user';
    const action = payload.action;

    setChanging((prev) => ({ ...prev, [user.id]: true }));
    try {
      const res = await api.admin.moderateUser(user.id, payload);
      if (res?.success && res.user) {
        patchUser(user.id, res.user);
        const actionLabel = {
          warn: 'warned',
          suspend: 'suspended',
          block: 'blocked',
          reactivate: 'reactivated',
        }[action] || 'updated';
        showToast(`${label} ${actionLabel}`);
      } else {
        showToast(res?.error || 'Failed to update user');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update user');
    }
    setChanging((prev) => ({ ...prev, [user.id]: false }));
    setModerationPrompt(null);
  };

  const executeDeleteUser = async (user, reason) => {
    const label = user.full_name || user.email || 'this user';

    setChanging((prev) => ({ ...prev, [user.id]: true }));
    try {
      const res = await api.admin.deleteUser(user.id, { reason });
      if (res?.success) {
        patchUser(user.id, { account_status: 'deleted', deleted_at: new Date().toISOString() });
        showToast(`${label} deleted`);
      } else {
        showToast(res?.error || 'Failed to delete user');
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete user');
    }
    setChanging((prev) => ({ ...prev, [user.id]: false }));
    setModerationPrompt(null);
  };

  const openModerationPrompt = (user, action) => {
    const prompts = {
      warn: {
        user,
        action,
        title: 'Warn user',
        message: 'Send a warning notice without removing access. The user will be notified through the available channels.',
        requiresReason: true,
        reasonLabel: 'Warning message',
        confirmLabel: 'Send warning',
      },
      suspend: {
        user,
        action,
        title: 'Suspend user',
        message: 'Temporarily remove app access. The user will be told how long the suspension lasts and why.',
        requiresDays: true,
        requiresReason: true,
        reasonLabel: 'Suspension reason',
        confirmLabel: 'Suspend user',
      },
      block: {
        user,
        action,
        title: 'Block user',
        message: 'Block app access until an admin changes the status back to allowed.',
        requiresReason: true,
        reasonLabel: 'Block reason',
        confirmLabel: 'Block user',
        danger: true,
      },
      reactivate: {
        user,
        action,
        title: 'Allow user',
        message: 'Restore access and clear active moderation restrictions for this user.',
        confirmLabel: 'Allow user',
      },
      delete: {
        user,
        action,
        title: 'Remove user',
        message: 'This will remove app access and hide the account as deleted. This is a soft delete for record safety.',
        requiresReason: true,
        reasonLabel: 'Deletion reason',
        defaultReason: 'Removed by admin',
        confirmLabel: 'Remove user',
        danger: true,
      },
    };
    setModerationPrompt(prompts[action]);
  };

  const handleModerationSelect = (user, value) => {
    const current = moderationValueForStatus(user.account_status || 'active');
    if (value === current) return;
    const action = value === 'allowed' ? 'reactivate' : value;
    openModerationPrompt(user, action);
  };

  const handleModerationSubmit = (values) => {
    if (!moderationPrompt) return;
    const { user, action } = moderationPrompt;
    if (action === 'delete') {
      executeDeleteUser(user, values.reason || 'Removed by admin');
      return;
    }
    executeModeration(user, { action, ...values });
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <>
    {selected && (
      <UserDetailModal
        user={selected}
        onClose={() => setSelected(null)}
        onRoleChanged={(id, newRole) => {
          const patch = { role: newRole, ...(newRole === 'admin' ? { is_contributor: true } : {}) };
          setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u));
          setSelected((prev) => prev ? { ...prev, ...patch } : prev);
        }}
      />
    )}
    {moderationPrompt && (
      <ModerationPromptModal
        prompt={moderationPrompt}
        busy={!!changing[moderationPrompt.user.id]}
        onClose={() => {
          if (!changing[moderationPrompt.user.id]) setModerationPrompt(null);
        }}
        onSubmit={handleModerationSubmit}
      />
    )}
    <div className="adm-card">
      <div className="adm-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiShield size={15} style={{ color: 'var(--adm-primary)' }} />
          <h3 className="adm-card-title">User Management</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px', justifyContent: 'flex-end' }}>
          {toast && (
            <span style={{ fontSize: 12, color: toast.includes('→') ? 'var(--adm-green)' : 'var(--adm-red)', fontWeight: 600 }}>
              {toast}
            </span>
          )}
          <FiSearch size={13} style={{ color: 'var(--adm-text-muted)' }} />
          <input
            className="adm-search"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /> Loading users…</div>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Current Role</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Joined</th>
                  <th>Change Role</th>
                  <th>Moderation</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const role = u.role || 'student';
                  const plan = u.subscription?.plan?.name?.toLowerCase() || 'basic';
                  const status = u.account_status || 'active';
                  return (
                    <tr
                      key={u.id}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { if (!['SELECT', 'OPTION', 'BUTTON'].includes(e.target.tagName)) setSelected(u); }}
                    >
                      <td>
                        <UserIdentityCell user={u} />
                      </td>
                      <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`adm-badge ${ROLE_BADGE[role] || 'adm-badge-gray'}`}>{role}</span>
                        {u.is_contributor && role !== 'admin' && (
                          <span className="adm-badge adm-badge-teal">contributor</span>
                        )}
                      </td>
                      <td>
                        <span className={`adm-badge ${STATUS_BADGE[status] || 'adm-badge-gray'}`}>
                          {STATUS_LABEL[status] || status}
                        </span>
                        {status === 'suspended' && u.suspended_until && (
                          <div style={{ fontSize: 11, color: 'var(--adm-text-muted)', marginTop: 4, whiteSpace: 'nowrap' }}>
                            until {new Date(u.suspended_until).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`adm-badge ${plan.includes('master') ? 'adm-badge-amber' : plan.includes('serious') ? 'adm-badge-teal' : 'adm-badge-gray'}`}>
                          {plan.includes('master') ? 'Hero' : plan.includes('serious') ? 'Helper' : 'Free Learner'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <select
                          className="adm-select"
                          style={{ height: 30, fontSize: 12, padding: '0 8px' }}
                          value={role}
                          disabled={!!changing[u.id]}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                        {changing[u.id] && (
                          <span style={{ marginLeft: 8 }}>
                            <div className="adm-spinner" style={{ width: 14, height: 14, display: 'inline-block' }} />
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          className={`adm-select adm-moderation-select ${status === 'blocked' || status === 'deleted' ? 'is-danger' : ''}`}
                          value={moderationValueForStatus(status)}
                          disabled={!!changing[u.id] || status === 'deleted'}
                          onChange={(event) => handleModerationSelect(u, event.target.value)}
                        >
                          {MODERATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--adm-text-muted)', padding: 28 }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--adm-border)' }}>
              <button type="button" className="adm-btn adm-btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                {page} / {totalPages} &middot; {total} users
              </span>
              <button type="button" className="adm-btn adm-btn-outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

export default function UsersSection({ period }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admin.getUserAnalytics(period)
      .then((res) => {
        if (res?.success) setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading user analytics…
      </div>
    );
  }

  const byInstitution  = data?.by_institution || [];
  const byLevel        = data?.by_level || [];
  const byGender       = data?.by_gender || [];
  const bySource       = data?.by_source || [];
  const byPlan         = data?.by_plan || [];
  const recentUsers    = data?.recent_users || [];

  return (
    <>
      {/* DAU / MAU / SAU / AAU */}
      <div className="adm-stats">
        <StatCard label="Daily Active Users"     value={fmt(data?.dau)}  sub="DAU"  icon={FiActivity}    accent="green" />
        <StatCard label="Monthly Active Users"   value={fmt(data?.mau)}  sub="MAU"  icon={FiUsers}        />
        <StatCard label="Semester Active Users"  value={fmt(data?.sau)}  sub="SAU"  icon={FiUsers}        accent="blue"  />
        <StatCard label="Annual Active Users"    value={fmt(data?.aau)}  sub="AAU"  icon={FiTrendingUp}   accent="amber" />
      </div>

      {/* Demographics grid */}
      <div className="adm-grid-2">
        <BreakdownCard title="By Institution Category" data={byInstitution} />
        <BreakdownCard title="By Level"                data={byLevel} />
      </div>

      <div className="adm-grid-2">
        <BreakdownCard title="By Gender"               data={byGender} />
        <BreakdownCard title="By Acquisition Source"   data={bySource} />
      </div>

      {/* Subscription tiers */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Users by Subscription Tier</h3>
        </div>
        <div className="adm-card-body">
          {byPlan.length > 0 ? (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPlan} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors().border} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors().muted }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Users" isAnimationActive={false}>
                    {byPlan.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="adm-empty"><div className="adm-empty-icon">📊</div><p>No plan data.</p></div>
          )}
        </div>
      </div>

      {/* Activeness + Recent Users */}
      <div className="adm-grid-2">
        <ActivenessTable users={recentUsers} />

        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Newest Users</h3>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Plan</th>
                  <th>Joined</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.slice(0, 8).map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name || 'Anonymous'}</div>
                      <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{displayContact(u)}</div>
                    </td>
                    <td>
                      <span className={`adm-badge ${u.plan === 'master' ? 'adm-badge-amber' : u.plan === 'serious' ? 'adm-badge-teal' : 'adm-badge-gray'}`}>
                        {u.plan || 'basic'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--adm-text-muted)', fontSize: 12 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)' }}>—</span>
                    </td>
                  </tr>
                ))}
                {recentUsers.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--adm-text-muted)', padding: 24 }}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Role management — full searchable user table */}
      <UserManagementTable />
    </>
  );
}

