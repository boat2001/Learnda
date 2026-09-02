import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import api from '../../services/api';
import './AdminAnalytics.css';

const RANGE_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'ALL' },
];

const SEGMENT_OPTIONS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'web', label: 'Web Only' },
  { value: 'mobile', label: 'Mobile Only' },
];

const SORT_OPTIONS = [
  { value: 'events', label: 'Sort by Events' },
  { value: 'users', label: 'Sort by Users' },
  { value: 'share', label: 'Sort by Share' },
];

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatCurrency = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const metricDeltaClass = (value) => {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
};

const metricDeltaText = (value) => {
  const abs = Math.abs(Math.round(Number(value || 0)));
  if (value > 0) return `+${abs}%`;
  if (value < 0) return `-${abs}%`;
  return '0%';
};

const signalClass = (type) => {
  if (type === 'warning') return 'warning';
  if (type === 'success') return 'success';
  return 'info';
};

function AdminAnalytics() {
  const { user, isAuthenticated } = useAuth();
  const { trackEvent } = useAnalytics();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);

  const [timeRange, setTimeRange] = useState('30d');
  const [segment, setSegment] = useState('all');
  const [featureSort, setFeatureSort] = useState('events');

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      loadAnalytics();
    }
  }, [isAuthenticated, user, timeRange, segment]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getAnalytics(timeRange, segment);
      if (data?.success) {
        setAnalyticsData(data.analytics);
        trackEvent('admin_analytics_loaded', {
          time_range: timeRange,
          platform_segment: segment,
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      if (format === 'json') {
        const response = await api.admin.getAnalytics(timeRange, segment);
        const payload = JSON.stringify(response, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `analytics-${timeRange}-${segment}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = await api.admin.exportAnalytics(timeRange, 'csv', segment);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `analytics-${timeRange}-${segment}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        window.URL.revokeObjectURL(url);
      }

      trackEvent('analytics_exported', {
        format,
        time_range: timeRange,
        platform_segment: segment,
      });
    } catch (error) {
      console.error('Error exporting analytics:', error);
    } finally {
      setExporting(false);
    }
  };

  const featureUsage = useMemo(() => {
    const data = [...(analyticsData?.feature_usage || [])];
    if (featureSort === 'users') {
      data.sort((a, b) => b.users - a.users);
      return data;
    }
    if (featureSort === 'share') {
      data.sort((a, b) => b.share - a.share);
      return data;
    }
    data.sort((a, b) => b.events - a.events);
    return data;
  }, [analyticsData, featureSort]);

  const featureMax = useMemo(() => {
    return featureUsage.reduce((max, item) => Math.max(max, Number(item.events || 0)), 0);
  }, [featureUsage]);

  const trendMax = useMemo(() => {
    return (analyticsData?.activity_trend || []).reduce(
      (max, row) => Math.max(max, Number(row.events || 0)),
      0,
    );
  }, [analyticsData]);

  const cards = [
    {
      label: 'Active Users',
      value: formatNumber(analyticsData?.active_users),
      sub: `New ${formatNumber(analyticsData?.new_users)}`,
      change: analyticsData?.user_growth,
    },
    {
      label: 'Revenue',
      value: formatCurrency(analyticsData?.revenue),
      sub: `Subs ${formatNumber(analyticsData?.new_subscriptions)}`,
      change: analyticsData?.revenue_growth,
    },
    {
      label: 'Engagement',
      value: formatPercent(analyticsData?.engagement_rate),
      sub: `Session ${formatNumber(analyticsData?.avg_session)} min`,
      change: analyticsData?.engagement_growth,
    },
    {
      label: 'Conversion',
      value: formatPercent(analyticsData?.conversion_rate),
      sub: `Signup to paid`,
      change: analyticsData?.conversion_growth,
    },
    {
      label: 'Total Events',
      value: formatNumber(analyticsData?.total_events),
      sub: `Users ${formatNumber(analyticsData?.unique_event_users)}`,
      change: null,
    },
    {
      label: 'DAU / MAU',
      value: `${formatNumber(analyticsData?.daily_active_users)} / ${formatNumber(analyticsData?.monthly_active_users)}`,
      sub: `Stickiness ${formatPercent(analyticsData?.stickiness)}`,
      change: null,
    },
    {
      label: 'Mobile Share',
      value: formatPercent(analyticsData?.mobile_share),
      sub: `Traffic contribution`,
      change: null,
    },
    {
      label: 'Inactive Rate',
      value: formatPercent(analyticsData?.inactivity_rate),
      sub: `Users to reactivate`,
      change: null,
    },
  ];

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="admin-unauthorized">
        <h2>Unauthorized Access</h2>
        <p>You do not have permission to access analytics.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner" />
        <p>Loading analytics control center...</p>
      </div>
    );
  }

  return (
    <div className="admin-analytics-v2">
      <section className="analytics-hero">
        <div>
          <h1>Admin Analytics Control Center</h1>
          <p>Decision-grade usage intelligence across web and mobile.</p>
        </div>
        <div className="analytics-controls">
          <div className="control-group range-group">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`range-button ${timeRange === option.value ? 'active' : ''}`}
                onClick={() => setTimeRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="control-group">
            <label htmlFor="segment-select">Segment</label>
            <select
              id="segment-select"
              value={segment}
              onChange={(event) => setSegment(event.target.value)}
            >
              {SEGMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="feature-sort">Feature Table</label>
            <select
              id="feature-sort"
              value={featureSort}
              onChange={(event) => setFeatureSort(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="control-actions">
            <button className="action-button" onClick={loadAnalytics}>Refresh</button>
            <button className="action-button" onClick={() => handleExport('csv')} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button className="action-button ghost" onClick={() => handleExport('json')} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export JSON'}
            </button>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        {cards.map((item) => (
          <article key={item.label} className="kpi-card">
            <p className="kpi-label">{item.label}</p>
            <h3 className="kpi-value">{item.value}</h3>
            <div className="kpi-meta">
              <span>{item.sub}</span>
              {typeof item.change === 'number' && (
                <span className={`kpi-delta ${metricDeltaClass(item.change)}`}>
                  {metricDeltaText(item.change)}
                </span>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="decision-grid">
        <article className="decision-card">
          <h3>Most Used Area</h3>
          <p className="decision-title">{analyticsData?.most_used_feature?.feature || 'No data'}</p>
          <p>
            {formatNumber(analyticsData?.most_used_feature?.events)} events | {formatPercent(analyticsData?.most_used_feature?.share)} share
          </p>
        </article>
        <article className="decision-card warning">
          <h3>Least Used Area</h3>
          <p className="decision-title">{analyticsData?.least_used_feature?.feature || 'No data'}</p>
          <p>
            {formatNumber(analyticsData?.least_used_feature?.events)} events | {formatPercent(analyticsData?.least_used_feature?.share)} share
          </p>
        </article>
        <article className="decision-card">
          <h3>Funnel Health</h3>
          <p>Signup to active: {formatPercent(analyticsData?.funnel?.signup_to_active_rate)}</p>
          <p>Signup to paid: {formatPercent(analyticsData?.funnel?.signup_to_subscription_rate)}</p>
        </article>
        <article className="decision-card">
          <h3>High Opportunity Areas</h3>
          <ul className="opportunity-list">
            {(analyticsData?.usage_opportunities || []).map((item) => (
              <li key={item.feature_id}>{item.feature} ({formatNumber(item.events)} events)</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Feature Usage</h2>
            <p>Where students spend time and where adoption is weak.</p>
          </div>
          <div className="feature-rows">
            {featureUsage.map((item) => (
              <div key={item.feature_id} className="feature-row">
                <div className="feature-labels">
                  <strong>{item.feature}</strong>
                  <small>
                    {formatNumber(item.events)} events | {formatNumber(item.users)} users | {formatPercent(item.share)}
                  </small>
                </div>
                <div className="feature-bar-track">
                  <div
                    className="feature-bar-fill"
                    style={{ width: `${featureMax ? Math.round((item.events / featureMax) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Top Paths / Endpoints</h2>
            <p>Highest traffic routes and request load.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Hits</th>
                  <th>Users</th>
                  <th>Avg ms</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {(analyticsData?.top_endpoints || []).map((row) => (
                  <tr key={row.path}>
                    <td className="mono">{row.path}</td>
                    <td>{formatNumber(row.hits)}</td>
                    <td>{formatNumber(row.users)}</td>
                    <td>{formatNumber(row.avg_duration_ms)}</td>
                    <td>{formatPercent(row.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Activity Trend</h2>
            <p>Event intensity over the selected period.</p>
          </div>
          <div className="trend-strip">
            {(analyticsData?.activity_trend || []).map((row) => (
              <div key={row.date} className="trend-item" title={`${row.date} | ${row.events} events | ${row.users} users`}>
                <div
                  className="trend-bar"
                  style={{ height: `${trendMax ? Math.max(8, Math.round((row.events / trendMax) * 100)) : 8}%` }}
                />
              </div>
            ))}
          </div>
          <div className="trend-caption">
            <span>Start</span>
            <span>End</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Platform Split</h2>
            <p>Relative traffic by client platform.</p>
          </div>
          <div className="platform-grid">
            {(analyticsData?.platform_split || []).map((item) => (
              <div key={item.platform} className="platform-card">
                <h4>{item.platform.toUpperCase()}</h4>
                <p>{formatNumber(item.events)} events</p>
                <p>{formatNumber(item.users)} users</p>
                <strong>{formatPercent(item.share)} share</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Top Content</h2>
            <p>Content currently driving attention.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Views</th>
                  <th>Completion</th>
                  <th>Avg min</th>
                </tr>
              </thead>
              <tbody>
                {(analyticsData?.top_content || []).map((item) => (
                  <tr key={`top-${item.title}`}>
                    <td>{item.title}</td>
                    <td>{formatNumber(item.views)}</td>
                    <td>{formatPercent(item.completion_rate)}</td>
                    <td>{formatNumber(item.avg_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Underused Content</h2>
            <p>Potential candidates for refresh or repackaging.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Views</th>
                  <th>Completion</th>
                  <th>Avg min</th>
                </tr>
              </thead>
              <tbody>
                {(analyticsData?.underused_content || []).map((item) => (
                  <tr key={`low-${item.title}`}>
                    <td>{item.title}</td>
                    <td>{formatNumber(item.views)}</td>
                    <td>{formatPercent(item.completion_rate)}</td>
                    <td>{formatNumber(item.avg_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="insights-panel-v2">
        <div className="panel-head">
          <h2>Actionable Insights</h2>
          <p>Prioritized recommendations for product and growth decisions.</p>
        </div>
        <div className="insight-list-v2">
          {(analyticsData?.insights || []).map((item, index) => (
            <article key={`${item.message}-${index}`} className={`insight-card-v2 ${signalClass(item.type)}`}>
              <span className="badge">{item.priority || 'medium'}</span>
              <h4>{item.message}</h4>
              <p>{item.action}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminAnalytics;
