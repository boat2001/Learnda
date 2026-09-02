import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiPlus, FiTrash2, FiSave } from 'react-icons/fi';
import api from '../../../services/api';

function fmt(n) {
  if (n == null) return '—';
  return `GH₵ ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtShort(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `GH₵ ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `GH₵ ${(n / 1_000).toFixed(1)}k`;
  return `GH₵ ${Number(n).toFixed(2)}`;
}

const TIER_COLORS = { basic: '#94a3b8', serious: '#2b62c4', master: '#d97706' };
const PIE_COLORS = ['#2b62c4', '#d97706', '#2563eb'];

function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`adm-stat${accent ? ` accent-${accent}` : ''}`}>
      <div className="adm-stat-top">
        <span className="adm-stat-label">{label}</span>
        <span className="adm-stat-icon"><Icon /></span>
      </div>
      <div className="adm-stat-value">{value}</div>
      {sub && <div className="adm-stat-change neutral">{sub}</div>}
    </div>
  );
}

const DEFAULT_EXPENSES = [
  { id: 'domain',   label: 'Domain',         freq: 'yearly',  amount: '' },
  { id: 'hosting',  label: 'Hosting (VPS)',  freq: 'monthly', amount: '' },
  { id: 'db',       label: 'Database',       freq: 'monthly', amount: '' },
  { id: 'storage',  label: 'Storage (R2)',   freq: 'monthly', amount: '' },
  { id: 'ssl',      label: 'SSL Certificate',freq: 'yearly',  amount: '' },
  { id: 'email',    label: 'Email Service',  freq: 'monthly', amount: '' },
];

export default function RevenueSection({ period }) {
  const [mrr, setMrr]           = useState(null);
  const [expenses, setExpenses]  = useState(null);
  const [loading, setLoading]    = useState(true);
  const [saving, setSaving]      = useState(false);
  const [savedMsg, setSavedMsg]  = useState('');
  const [newItem, setNewItem]    = useState({ label: '', freq: 'monthly', amount: '' });
  const [showAdd, setShowAdd]    = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.admin.getMrr().catch(() => null),
      api.admin.getExpenses().catch(() => null),
    ]).then(([mrrRes, expRes]) => {
      if (mrrRes?.success) setMrr(mrrRes);
      if (expRes?.success) setExpenses(expRes.expenses || DEFAULT_EXPENSES);
      else setExpenses(DEFAULT_EXPENSES);
      setLoading(false);
    });
  }, [period]);

  const updateExpense = useCallback((id, field, value) => {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addExpense = useCallback(() => {
    if (!newItem.label.trim()) return;
    const id = `custom_${Date.now()}`;
    setExpenses((prev) => [...prev, { ...newItem, id }]);
    setNewItem({ label: '', freq: 'monthly', amount: '' });
    setShowAdd(false);
  }, [newItem]);

  const saveExpenses = useCallback(async () => {
    setSaving(true);
    try {
      await api.admin.saveExpenses(expenses);
      setSavedMsg('Saved!');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch {
      setSavedMsg('Error saving');
      setTimeout(() => setSavedMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  }, [expenses]);

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading revenue data…
      </div>
    );
  }

  const drr = mrr?.drr ?? 0;
  const wrr = mrr?.wrr ?? 0;
  const mrrVal = mrr?.mrr ?? 0;
  const arr = mrr?.arr ?? 0;
  const series = mrr?.rev_series || [];

  // Compute per-tier stats from plan_breakdown array [{name, count, mrr}]
  const planBreakdown = mrr?.plan_breakdown || [];
  const findTier = (kw) => planBreakdown.filter((p) => kw.some((k) => String(p.name || '').toLowerCase().includes(k)));
  const seriousTiers = findTier(['serious']);
  const masterTiers  = findTier(['master']);
  const seriousRevenue = seriousTiers.reduce((s, p) => s + (p.mrr || 0), 0);
  const masterRevenue  = masterTiers.reduce((s, p) => s + (p.mrr || 0), 0);
  const seriousUsers   = seriousTiers.reduce((s, p) => s + (p.count || 0), 0);
  const masterUsers    = masterTiers.reduce((s, p) => s + (p.count || 0), 0);

  // Calculate total monthly expenses
  const totalMonthlyExpenses = (expenses || []).reduce((sum, e) => {
    const amt = parseFloat(e.amount) || 0;
    return sum + (e.freq === 'yearly' ? amt / 12 : amt);
  }, 0);

  const grossProfit = mrrVal - totalMonthlyExpenses;
  const profitMargin = mrrVal > 0 ? ((grossProfit / mrrVal) * 100).toFixed(1) : 0;

  const tierData = [
    { name: 'Serious', value: seriousRevenue },
    { name: 'Master',  value: masterRevenue  },
  ].filter((d) => d.value > 0);

  const payingUserData = [
    { name: 'Serious', count: seriousUsers },
    { name: 'Master',  count: masterUsers  },
  ];

  return (
    <>
      {/* Top KPIs */}
      <div className="adm-stats">
        <StatCard label="Daily Recurring Revenue"   value={fmtShort(drr)}  sub="DRR"  icon={FiDollarSign} />
        <StatCard label="Weekly Recurring Revenue"  value={fmtShort(wrr)}  sub="WRR"  icon={FiTrendingUp}  accent="green" />
        <StatCard label="Monthly Recurring Revenue" value={fmtShort(mrrVal)} sub="MRR" icon={FiDollarSign}  accent="amber" />
        <StatCard label="Annual Recurring Revenue"  value={fmtShort(arr)}  sub="ARR"  icon={FiTrendingUp}  accent="blue"  />
      </div>

      {/* MRR trend chart + tier breakdown */}
      <div className="adm-grid-2-1">
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">MRR Trend</h3>
          </div>
          <div className="adm-chart" style={{ height: 220 }}>
            {series.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#d97706" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={getComputedStyle(document.documentElement).getPropertyValue('--adm-border').trim() || 'rgba(100,116,139,0.15)'} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: getComputedStyle(document.documentElement).getPropertyValue('--adm-text-muted').trim() || '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: getComputedStyle(document.documentElement).getPropertyValue('--adm-text-muted').trim() || '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`GH₵ ${Number(v).toFixed(2)}`, 'MRR']}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#d97706" strokeWidth={2} fill="url(#gradMrr)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="adm-empty"><div className="adm-empty-icon">📊</div><p>No MRR series data yet.</p></div>
            )}
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Revenue by Tier</h3>
          </div>
          <div className="adm-card-body">
            {tierData.length > 0 ? (
              <>
                <div style={{ height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tierData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3} isAnimationActive={false}>
                        {tierData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`GH₵ ${Number(v).toFixed(2)}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="adm-donut-row">
                  {tierData.map((d, i) => (
                    <div key={d.name} className="adm-donut-item">
                      <div className="adm-donut-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="adm-donut-label">{d.name}</span>
                      <span className="adm-donut-value">{fmtShort(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="adm-empty"><div className="adm-empty-icon">🥧</div><p>No revenue data yet.</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Paying users */}
      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Paying Users</h3>
          </div>
          <div className="adm-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Helper Plan', count: seriousUsers, price: 'GH₵ 5/mo', color: '#2b62c4' },
                { label: 'Hero Plan',   count: masterUsers,  price: 'GH₵ 10/mo', color: '#d97706' },
              ].map((tier) => {
                const total = seriousUsers + masterUsers;
                const pct = total > 0 ? Math.round((tier.count / total) * 100) : 0;
                return (
                  <div key={tier.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{tier.label}</span>
                      <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                        {tier.count} users &middot; {tier.price}
                      </span>
                    </div>
                    <div className="adm-progress-bar">
                      <div className="adm-progress-fill" style={{ width: `${pct}%`, background: tier.color }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 12, color: 'var(--adm-text-muted)', marginTop: 4 }}>
                Total paying: <strong style={{ color: 'var(--adm-text)' }}>
                  {seriousUsers + masterUsers} users
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Churning / low activity */}
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Subscription Health</h3>
          </div>
          <div className="adm-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Active Subscriptions',  value: mrr?.active_subscriptions ?? mrr?.paying_users ?? '—', badge: 'green' },
                { label: 'Churned (period)',       value: mrr?.churned_count != null ? mrr.churned_count : '—', badge: 'red'   },
                { label: 'Churn Rate',             value: mrr?.churn_rate != null ? `${Number(mrr.churn_rate).toFixed(1)}%` : '—', badge: (mrr?.churn_rate ?? 0) > 5 ? 'red' : 'green' },
                { label: 'Avg Revenue / User',     value: mrr?.arpu != null ? fmtShort(mrr.arpu) : '—', badge: 'teal' },
                { label: 'Lifetime Value (est.)',  value: mrr?.ltv  != null ? fmtShort(mrr.ltv)  : '—', badge: 'blue' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>{row.label}</span>
                  <span className={`adm-badge adm-badge-${row.badge}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses editor */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Operating Expenses</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {savedMsg && <span style={{ fontSize: 12, color: savedMsg.startsWith('Error') ? 'var(--adm-red)' : 'var(--adm-green)' }}>{savedMsg}</span>}
            <button type="button" className="adm-btn adm-btn-outline" onClick={() => setShowAdd((v) => !v)}>
              <FiPlus size={13} /> Add Item
            </button>
            <button type="button" className="adm-btn adm-btn-primary" onClick={saveExpenses} disabled={saving}>
              <FiSave size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        <div className="adm-card-body">
          {showAdd && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                className="adm-input adm-input-full"
                placeholder="Item name"
                value={newItem.label}
                onChange={(e) => setNewItem((p) => ({ ...p, label: e.target.value }))}
              />
              <select className="adm-select" value={newItem.freq} onChange={(e) => setNewItem((p) => ({ ...p, freq: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                className="adm-input"
                type="number"
                placeholder="Amount (GH₵)"
                value={newItem.amount}
                onChange={(e) => setNewItem((p) => ({ ...p, amount: e.target.value }))}
              />
              <button type="button" className="adm-btn adm-btn-primary" onClick={addExpense}>Add</button>
            </div>
          )}

          {(expenses || []).map((exp) => (
            <div key={exp.id} className="adm-expense-row">
              <span className="adm-expense-label">{exp.label}</span>
              <span className="adm-expense-freq">{exp.freq}</span>
              <input
                className="adm-input"
                type="number"
                placeholder="0.00"
                value={exp.amount}
                onChange={(e) => updateExpense(exp.id, 'amount', e.target.value)}
              />
              <button
                type="button"
                className="adm-btn adm-btn-ghost"
                style={{ color: 'var(--adm-red)', padding: '0 6px' }}
                onClick={() => removeExpense(exp.id)}
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--adm-border)', fontSize: 13 }}>
            Total monthly spend: <strong style={{ color: 'var(--adm-text)' }}>{fmt(totalMonthlyExpenses)}</strong>
          </div>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Profit & Loss (This Month)</h3>
        </div>
        <div className="adm-card-body">
          <div className="adm-grid-3" style={{ gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Revenue (MRR)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--adm-green)' }}>{fmtShort(mrrVal)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Total Expenses</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--adm-red)' }}>{fmtShort(totalMonthlyExpenses)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Net Profit</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: grossProfit >= 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}>
                {grossProfit >= 0 ? '+' : ''}{fmtShort(grossProfit)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--adm-text-muted)', marginTop: 4 }}>
                {profitMargin}% margin
              </div>
            </div>
          </div>

          {/* Balance sheet rows */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Monthly Revenue (MRR)',    value: fmtShort(mrrVal),              positive: true  },
              { label: 'Annual Projection (ARR)',   value: fmtShort(arr),                 positive: true  },
              { label: 'Monthly Expenses',          value: `−${fmtShort(totalMonthlyExpenses)}`, positive: false },
              { label: 'Net Monthly Profit',        value: fmtShort(grossProfit),         positive: grossProfit >= 0 },
              { label: 'Net Annual Projection',     value: fmtShort(grossProfit * 12),    positive: grossProfit >= 0 },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid var(--adm-border)',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--adm-text-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: row.positive ? 'var(--adm-green)' : 'var(--adm-red)' }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
