import { useEffect, useState } from 'react';
import { FiMap, FiEdit2, FiSave, FiX, FiPlus, FiTrash2, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import api from '../../../services/api';

const PHASE_META = {
  v1:        { color: '#26c9d0', label: 'teal'   },
  v2:        { color: '#38bdf8', label: 'sky'    },
  platform:  { color: '#60a5fa', label: 'blue'   },
  ecosystem: { color: '#a78bfa', label: 'violet' },
  expansion: { color: '#fbbf24', label: 'amber'  },
};

const lbl = { fontSize: 11, color: 'var(--adm-text-muted)', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

/* ── View card ─────────────────────────────────────────────────────────────── */
function PhaseViewCard({ phase }) {
  const [open, setOpen] = useState(true);
  const color = PHASE_META[phase.id]?.color || '#60a5fa';

  return (
    <div className="adm-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div
        className="adm-card-header"
        style={{ cursor: 'pointer', borderBottom: open ? '1px solid var(--adm-border)' : 'none' }}
        onClick={() => setOpen((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{phase.version}</span>
          <span className="adm-card-title" style={{ margin: 0 }}>{phase.label}</span>
          <span style={{ fontSize: 12, color: 'var(--adm-text-muted)', fontWeight: 400 }}>{phase.years}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{phase.items.length} items</span>
          {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
        </div>
      </div>
      {open && (
        <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {phase.items.map((item, i) => (
            <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: `color-mix(in srgb, ${color} 10%, transparent)`, color: `color-mix(in srgb, ${color} 80%, var(--adm-text))`, border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`, fontWeight: 500 }}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Edit card ─────────────────────────────────────────────────────────────── */
function PhaseEditCard({ phase, onChange, onItemChange, onAddItem, onRemoveItem }) {
  const [open, setOpen] = useState(true);
  const color = PHASE_META[phase.id]?.color || '#60a5fa';

  return (
    <div className="adm-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="adm-card-header" style={{ cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{phase.version}</span>
          <span className="adm-card-title" style={{ margin: 0 }}>{phase.label || '—'}</span>
        </div>
        {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </div>
      {open && (
        <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="adm-grid-3">
            <div>
              <label style={lbl}>Version</label>
              <input className="adm-input adm-input-full" value={phase.version} onChange={(e) => onChange('version', e.target.value)} placeholder="v1.0" />
            </div>
            <div>
              <label style={lbl}>Label</label>
              <input className="adm-input adm-input-full" value={phase.label} onChange={(e) => onChange('label', e.target.value)} placeholder="Foundation" />
            </div>
            <div>
              <label style={lbl}>Years</label>
              <input className="adm-input adm-input-full" value={phase.years} onChange={(e) => onChange('years', e.target.value)} placeholder="2023" />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Items</label>
              <button type="button" className="adm-btn adm-btn-outline" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={onAddItem}>
                <FiPlus size={11} /> Add item
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {phase.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--adm-text-muted)', fontSize: 11, width: 18, flexShrink: 0, textAlign: 'right' }}>{idx + 1}</span>
                  <input className="adm-input adm-input-full" value={item} onChange={(e) => onItemChange(idx, e.target.value)} placeholder="Item text" style={{ flex: 1, width: 'auto' }} />
                  <button type="button" className="adm-btn adm-btn-ghost" style={{ height: 28, padding: '0 6px', color: 'var(--adm-red)', flexShrink: 0 }} onClick={() => onRemoveItem(idx)} title="Remove">
                    <FiTrash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section ───────────────────────────────────────────────────────────────── */
export default function RoadmapSection() {
  const [data, setData] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const editMode = draft !== null;

  useEffect(() => {
    api.admin.getRoadmap()
      .then((res) => { if (res?.success) setData(res.phases); })
      .catch(() => setError('Failed to load roadmap.'))
      .finally(() => setLoading(false));
  }, []);

  const enterEdit = () => setDraft(JSON.parse(JSON.stringify(data)));
  const cancelEdit = () => { setDraft(null); setError(''); };

  const updatePhase = (id, field, value) =>
    setDraft((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));

  const updatePhaseItem = (id, idx, value) =>
    setDraft((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const items = [...p.items]; items[idx] = value; return { ...p, items };
    }));

  const addPhaseItem = (id) =>
    setDraft((prev) => prev.map((p) => p.id === id ? { ...p, items: [...p.items, ''] } : p));

  const removePhaseItem = (id, idx) =>
    setDraft((prev) => prev.map((p) => p.id !== id ? p : { ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.admin.saveRoadmap(draft);
      if (res?.success) {
        setData(draft); setDraft(null);
        setSaved(true); setTimeout(() => setSaved(false), 3000);
      } else { setError('Failed to save.'); }
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="adm-loading"><div className="adm-spinner" />Loading roadmap…</div>;

  const phases = editMode ? draft : data;

  return (
    <>
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title"><FiMap size={14} style={{ marginRight: 6 }} />Roadmap Phases</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && !editMode && <span style={{ fontSize: 12, color: 'var(--adm-green)' }}>Saved</span>}
            {error && <span style={{ fontSize: 12, color: 'var(--adm-red)' }}>{error}</span>}
            {editMode ? (
              <>
                <button type="button" className="adm-btn adm-btn-ghost" onClick={cancelEdit} disabled={saving}><FiX size={13} /> Cancel</button>
                <button type="button" className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}><FiSave size={13} /> {saving ? 'Saving…' : 'Save'}</button>
              </>
            ) : (
              <button type="button" className="adm-btn adm-btn-outline" onClick={enterEdit}><FiEdit2 size={13} /> Edit</button>
            )}
          </div>
        </div>
        {!editMode && (
          <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--adm-text-muted)' }}>
            {data.length} phases · Click Edit to modify items, labels, or years.
          </div>
        )}
        {editMode && (
          <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--adm-text-muted)' }}>
            Editing roadmap. Changes reflect on the public roadmap page when saved.
          </div>
        )}
      </div>

      {phases.map((phase) => editMode ? (
        <PhaseEditCard
          key={phase.id}
          phase={phase}
          onChange={(field, value) => updatePhase(phase.id, field, value)}
          onItemChange={(idx, value) => updatePhaseItem(phase.id, idx, value)}
          onAddItem={() => addPhaseItem(phase.id)}
          onRemoveItem={(idx) => removePhaseItem(phase.id, idx)}
        />
      ) : (
        <PhaseViewCard key={phase.id} phase={phase} />
      ))}
    </>
  );
}
