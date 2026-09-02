import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { FiBook, FiPlay, FiCheckSquare, FiDownload, FiMessageSquare, FiSmartphone, FiFile, FiSave } from 'react-icons/fi';
import api from '../../../services/api';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const COLORS = ['#2b62c4', '#4fb3ad', '#2563eb', '#d97706', '#059669', '#7c3aed', '#dc2626', '#94a3b8'];

function chartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    muted:  style.getPropertyValue('--adm-text-muted').trim()  || '#94a3b8',
    border: style.getPropertyValue('--adm-border').trim()      || 'rgba(100,116,139,0.15)',
    surface:style.getPropertyValue('--adm-surface').trim()     || '#ffffff',
  };
}

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

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--adm-border)', fontSize: 13 }}>
      <span style={{ color: 'var(--adm-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--adm-text)' }}>{value}</span>
    </div>
  );
}

export default function UsageSection({ period }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admin.getUsageStats(period)
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
        Loading usage statistics…
      </div>
    );
  }

  // Map flat backend fields
  const lessonsStudied   = data?.lessons_studied   || 0;
  const uniqueLearners   = data?.unique_learners   || 0;
  const testsCompleted   = data?.tests_completed   || 0;
  const uniqueTesters    = data?.unique_testers    || 0;
  const filesDownloaded  = data?.files_downloaded  || 0;
  const filesSaved       = data?.files_saved       || 0;
  const uniqueFileUsers  = data?.unique_file_users || 0;
  const edutainmentViewed= data?.edutainment_viewed|| 0;
  const uniqueViewers    = data?.unique_viewers    || 0;
  const communityPosts   = data?.community_posts   || 0;
  const groupMessages    = data?.group_messages    || 0;
  const totalEngagements = data?.total_engagements || 0;
  const completionRate   = data?.completion_rate   || 0;
  const totalFiles       = filesDownloaded + filesSaved;

  const installStats = data?.installs || {};

  const usageChart = [
    { label: 'Lessons',      count: lessonsStudied   },
    { label: 'Tests',        count: testsCompleted   },
    { label: 'Files',        count: totalFiles       },
    { label: 'Edutainment',  count: edutainmentViewed},
    { label: 'Comm Posts',   count: communityPosts   },
    { label: 'Group Msgs',   count: groupMessages    },
  ];

  const installData = [
    { label: 'Android', count: installStats.android || 0 },
    { label: 'iOS',     count: installStats.ios     || 0 },
    { label: 'Web PWA', count: installStats.web     || 0 },
  ];

  const cc = chartColors();

  return (
    <section className="adm-section adm-section-usage">
      {/* Top stats row 1 */}
      <div className="adm-stats">
        <StatCard label="Lessons Studied"   value={fmt(lessonsStudied)}   sub={`${fmt(uniqueLearners)} students`}  icon={FiBook}         accent="green"  />
        <StatCard label="Tests Completed"   value={fmt(testsCompleted)}   sub={`${fmt(uniqueTesters)} testers`}   icon={FiCheckSquare}  accent="blue"   />
        <StatCard label="Files Accessed"    value={fmt(totalFiles)}       sub={`${fmt(uniqueFileUsers)} users`}   icon={FiFile}         accent="amber"  />
        <StatCard label="Edutainment Views" value={fmt(edutainmentViewed)}sub={`${fmt(uniqueViewers)} viewers`}  icon={FiPlay}                          />
      </div>

      {/* Top stats row 2 */}
      <div className="adm-stats">
        <StatCard label="Community Posts"   value={fmt(communityPosts)}   sub="across all channels"               icon={FiMessageSquare}              />
        <StatCard label="Group Messages"    value={fmt(groupMessages)}    sub="in study groups"                   icon={FiMessageSquare} accent="blue"  />
        <StatCard label="App Installs"      value={fmt((installStats.android || 0) + (installStats.ios || 0) + (installStats.web || 0))} icon={FiSmartphone} accent="green" />
        <StatCard label="Total Engagements" value={fmt(totalEngagements)} sub={`${completionRate}% completion`}   icon={FiBook}          accent="amber" />
      </div>

      {/* Feature usage chart */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Feature Usage Breakdown</h3>
        </div>
        <div className="adm-chart" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: cc.muted }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: cc.muted }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: cc.surface, border: `1px solid ${cc.border}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: cc.muted }}
                itemStyle={{ color: cc.muted }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Activity" isAnimationActive={false}>
                {usageChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail cards */}
      <div className="adm-grid-2">
        {/* Lessons detail */}
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Lessons Detail</h3>
            <span className="adm-badge adm-badge-green"><FiBook size={10} /> Learning</span>
          </div>
          <div className="adm-card-body">
            <DetailRow label="Total Lessons Viewed"   value={fmt(lessonsStudied)} />
            <DetailRow label="Unique Students"         value={fmt(uniqueLearners)} />
            <DetailRow label="Avg Lessons / Student"   value={uniqueLearners > 0 ? (lessonsStudied / uniqueLearners).toFixed(1) : '—'} />
            <DetailRow label="Tests Completed"         value={fmt(testsCompleted)} />
            <DetailRow label="Unique Testers"          value={fmt(uniqueTesters)} />
            <DetailRow label="Completion Rate"         value={completionRate ? `${completionRate}%` : '—'} />
          </div>
        </div>

        {/* Files detail */}
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Files Detail</h3>
            <span className="adm-badge adm-badge-amber"><FiFile size={10} /> Resources</span>
          </div>
          <div className="adm-card-body">
            <DetailRow label="Total File Accesses"     value={fmt(totalFiles)} />
            <DetailRow label="Downloads"               value={fmt(filesDownloaded)} />
            <DetailRow label="Saves"                   value={fmt(filesSaved)} />
            <DetailRow label="Unique Users"            value={fmt(uniqueFileUsers)} />
            <DetailRow label="Avg Accesses / User"     value={uniqueFileUsers > 0 ? (totalFiles / uniqueFileUsers).toFixed(1) : '—'} />
            <DetailRow label="Download vs Save Ratio"  value={filesSaved > 0 ? `${(filesDownloaded / filesSaved).toFixed(1)} : 1` : '—'} />
          </div>
        </div>
      </div>

      {/* Edutainment + Community detail */}
      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Edutainment Detail</h3>
            <span className="adm-badge adm-badge-teal"><FiPlay size={10} /> Edutainment</span>
          </div>
          <div className="adm-card-body">
            <DetailRow label="Total Views"             value={fmt(edutainmentViewed)} />
            <DetailRow label="Unique Viewers"          value={fmt(uniqueViewers)} />
            <DetailRow label="Avg Views / Viewer"      value={uniqueViewers > 0 ? (edutainmentViewed / uniqueViewers).toFixed(1) : '—'} />
          </div>
        </div>

        {/* App installs */}
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">App Installs by Platform</h3>
            <span className="adm-badge adm-badge-blue"><FiSmartphone size={10} /> Installs</span>
          </div>
          <div className="adm-card-body">
            {installData.map((item, i) => {
              const total = installData.reduce((s, d) => s + d.count, 0) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{item.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>{fmt(item.count)} ({pct}%)</span>
                  </div>
                  <div className="adm-progress-bar">
                    <div className="adm-progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--adm-text-muted)' }}>
              Total installs: <strong style={{ color: 'var(--adm-text)' }}>
                {fmt(installData.reduce((s, d) => s + d.count, 0))}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
