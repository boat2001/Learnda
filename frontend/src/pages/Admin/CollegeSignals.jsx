import { useEffect, useState, useCallback } from 'react';
import {
  FiChevronDown, FiChevronRight, FiSave, FiRefreshCw, FiSearch, FiAward,
} from 'react-icons/fi';
import api from '../../services/api';

const SIGNAL_FIELDS = [
  { key: 'founding_year_verified', label: 'Founding Year (verified)', type: 'number', placeholder: 'e.g. 1946' },
  { key: 'ntc_pass_rate',          label: 'NTC Pass Rate (%)',         type: 'number', placeholder: '0 – 100'  },
  { key: 'accreditation_tier',     label: 'Accreditation Tier',        type: 'select',
    options: [{ value: '', label: '— unset —' }, { value: 'full', label: 'Full' }, { value: 'provisional', label: 'Provisional' }] },
  { key: 'enrollment_count',       label: 'Student Enrollment',        type: 'number', placeholder: 'e.g. 3500' },
  { key: 'staff_count',            label: 'Academic Staff Count',      type: 'number', placeholder: 'e.g. 120' },
  { key: 'google_maps_rating',     label: 'Google Maps Rating',        type: 'number', placeholder: '1.0 – 5.0', step: '0.1' },
];

const TOTAL_SIGNALS = SIGNAL_FIELDS.length;

function completeness(signals = {}) {
  return SIGNAL_FIELDS.filter(({ key }) => {
    const v = signals[key];
    return v !== '' && v != null;
  }).length;
}

function CompletenessBar({ count }) {
  const pct = Math.round((count / TOTAL_SIGNALS) * 100);
  const color = pct === 100 ? 'var(--adm-green)' : pct >= 50 ? 'var(--adm-primary)' : 'var(--adm-border)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--adm-border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>{count}/{TOTAL_SIGNALS}</span>
    </div>
  );
}

function CollegeRow({ college, onSaved }) {
  const [open, setOpen]     = useState(false);
  const [form, setForm]     = useState({
    founding_year_verified: college.signals?.founding_year_verified ?? '',
    ntc_pass_rate:          college.signals?.ntc_pass_rate          ?? '',
    accreditation_tier:     college.signals?.accreditation_tier     ?? '',
    enrollment_count:       college.signals?.enrollment_count       ?? '',
    staff_count:            college.signals?.staff_count            ?? '',
    google_maps_rating:     college.signals?.google_maps_rating     ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState(null);

  const filled = completeness(form);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.ranking.updateCollegeSignals(college.id, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ borderBottom: '1px solid var(--adm-border)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {open
          ? <FiChevronDown size={14} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />
          : <FiChevronRight size={14} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--adm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {college.name}
          </div>
          {college.user_count > 0 && (
            <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{college.user_count} students</div>
          )}
        </div>

        <CompletenessBar count={filled} />

        {filled === TOTAL_SIGNALS && (
          <span className="adm-badge adm-badge-green" style={{ flexShrink: 0 }}>Complete</span>
        )}
        {filled > 0 && filled < TOTAL_SIGNALS && (
          <span className="adm-badge adm-badge-amber" style={{ flexShrink: 0 }}>Partial</span>
        )}
        {filled === 0 && (
          <span className="adm-badge adm-badge-gray" style={{ flexShrink: 0 }}>Empty</span>
        )}
      </button>

      {open && (
        <div style={{ padding: '4px 20px 20px 46px', background: 'var(--adm-surface)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}>
            {SIGNAL_FIELDS.map(({ key, label, type, placeholder, step, options }) => (
              <label key={key} style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                {label}
                {type === 'select' ? (
                  <select
                    className="adm-select"
                    value={form[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  >
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="adm-input"
                    type="number"
                    value={form[key]}
                    placeholder={placeholder}
                    step={step || '1'}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 12, color: 'var(--adm-red)' }}>{error}</span>}
            {saved && <span style={{ fontSize: 12, color: 'var(--adm-green)' }}>Saved</span>}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ fontSize: 12 }}
            >
              <FiSave size={12} /> {saving ? 'Saving…' : 'Save Signals'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CollegeSignals() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.ranking.getColleges({ limit: 200 });
      setColleges(res?.data?.colleges || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = colleges.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const withSignals    = colleges.filter((c) => completeness(c.signals) > 0).length;
  const fullComplete   = colleges.filter((c) => completeness(c.signals) === TOTAL_SIGNALS).length;

  return (
    <>
      {/* Stats */}
      <div className="adm-stats">
        <div className="adm-stat accent-blue">
          <div className="adm-stat-top">
            <span className="adm-stat-label">Total Colleges</span>
            <span className="adm-stat-icon"><FiAward /></span>
          </div>
          <div className="adm-stat-value">{colleges.length}</div>
        </div>
        <div className="adm-stat accent-green">
          <div className="adm-stat-top">
            <span className="adm-stat-label">Fully Complete</span>
            <span className="adm-stat-icon"><FiAward /></span>
          </div>
          <div className="adm-stat-value">{fullComplete}</div>
        </div>
        <div className="adm-stat accent-amber">
          <div className="adm-stat-top">
            <span className="adm-stat-label">Partially Filled</span>
            <span className="adm-stat-icon"><FiAward /></span>
          </div>
          <div className="adm-stat-value">{withSignals - fullComplete}</div>
        </div>
        <div className="adm-stat accent-red">
          <div className="adm-stat-top">
            <span className="adm-stat-label">No Data Yet</span>
            <span className="adm-stat-icon"><FiAward /></span>
          </div>
          <div className="adm-stat-value">{colleges.length - withSignals}</div>
        </div>
      </div>

      {/* College list card */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Ranking Signals</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <FiSearch size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--adm-text-muted)', pointerEvents: 'none' }} />
              <input
                className="adm-input"
                type="text"
                placeholder="Filter colleges…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30, width: 200, fontSize: 13 }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} {filtered.length !== colleges.length ? `of ${colleges.length}` : 'colleges'}
            </span>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={load} style={{ padding: '4px 10px', fontSize: 12 }}>
              <FiRefreshCw size={12} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading colleges…</div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">
            <div className="adm-empty-icon">🏫</div>
            <p>{search ? 'No colleges match your search.' : 'No colleges found.'}</p>
          </div>
        ) : (
          <div>
            {filtered.map((college) => (
              <CollegeRow key={college.id} college={college} onSaved={load} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
