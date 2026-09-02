import { useEffect, useState } from 'react';
import { FiEdit2, FiSave, FiX, FiPlus, FiTrash2, FiExternalLink } from 'react-icons/fi';
import api from '../../../services/api';

const PLATFORM_COLORS = {
  x:         '#64748b',
  facebook:  '#1877f2',
  whatsapp:  '#25d366',
  telegram:  '#2aabee',
  youtube:   '#ff0000',
  tiktok:    '#fe2c55',
  instagram: '#e1306c',
};

const lbl = { fontSize: 11, color: 'var(--adm-text-muted)', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

const blankLink = () => ({ id: `social_${Date.now()}`, name: '', handle: '', href: '', purpose: '' });

/* ── View grid ─────────────────────────────────────────────────────────────── */
function SocialView({ links }) {
  if (links.length === 0) return (
    <div className="adm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: 13 }}>
      No social accounts configured yet.
    </div>
  );

  return (
    <div className="adm-grid-2">
      {links.map((link) => {
        const color = PLATFORM_COLORS[link.id] || '#64748b';
        return (
          <div key={link.id} className="adm-card" style={{ padding: '16px 18px', borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--adm-text)', lineHeight: 1.3 }}>{link.name || '—'}</div>
                {link.handle && <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 2 }}>{link.handle}</div>}
              </div>
              {link.href && (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="adm-btn adm-btn-outline"
                  style={{ height: 28, padding: '0 10px', fontSize: 12, flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, color }}
                >
                  <FiExternalLink size={11} /> Open
                </a>
              )}
            </div>
            {link.purpose && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--adm-text-muted)', lineHeight: 1.5 }}>{link.purpose}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Edit row ──────────────────────────────────────────────────────────────── */
function SocialEditRow({ link, onChange, onRemove }) {
  const color = PLATFORM_COLORS[link.id] || '#64748b';
  return (
    <div className="adm-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: link.name ? color : 'var(--adm-text-muted)' }}>{link.name || 'New account'}</span>
        <button type="button" className="adm-btn adm-btn-ghost" style={{ height: 28, padding: '0 6px', color: 'var(--adm-red)' }} onClick={onRemove} title="Remove">
          <FiTrash2 size={13} />
        </button>
      </div>
      <div className="adm-grid-2" style={{ marginBottom: 10 }}>
        <div>
          <label style={lbl}>Name</label>
          <input className="adm-input adm-input-full" value={link.name} onChange={(e) => onChange('name', e.target.value)} placeholder="e.g. Instagram" />
        </div>
        <div>
          <label style={lbl}>Handle</label>
          <input className="adm-input adm-input-full" value={link.handle} onChange={(e) => onChange('handle', e.target.value)} placeholder="@sharether" />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>URL</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="adm-input adm-input-full" value={link.href} onChange={(e) => onChange('href', e.target.value)} placeholder="https://..." style={{ flex: 1, width: 'auto' }} />
          {link.href && (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-ghost" style={{ height: 34, padding: '0 8px', flexShrink: 0 }} title="Open">
              <FiExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
      <div>
        <label style={lbl}>Purpose</label>
        <input className="adm-input adm-input-full" value={link.purpose} onChange={(e) => onChange('purpose', e.target.value)} placeholder="What this channel is used for" />
      </div>
    </div>
  );
}

/* ── Section ───────────────────────────────────────────────────────────────── */
export default function SocialLinksSection() {
  const [data, setData] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const editMode = draft !== null;

  useEffect(() => {
    api.admin.getSocialLinks()
      .then((res) => { if (res?.success) setData(res.links); })
      .catch(() => setError('Failed to load social links.'))
      .finally(() => setLoading(false));
  }, []);

  const enterEdit = () => setDraft(JSON.parse(JSON.stringify(data)));
  const cancelEdit = () => { setDraft(null); setError(''); };

  const updateLink = (id, field, value) =>
    setDraft((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));

  const removeLink = (id) =>
    setDraft((prev) => prev.filter((l) => l.id !== id));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.admin.saveSocialLinks(draft);
      if (res?.success) {
        setData(draft); setDraft(null);
        setSaved(true); setTimeout(() => setSaved(false), 3000);
      } else { setError('Failed to save.'); }
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="adm-loading"><div className="adm-spinner" />Loading social accounts…</div>;

  return (
    <>
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Social Media Accounts</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && !editMode && <span style={{ fontSize: 12, color: 'var(--adm-green)' }}>Saved</span>}
            {error && <span style={{ fontSize: 12, color: 'var(--adm-red)' }}>{error}</span>}
            {editMode ? (
              <>
                <button type="button" className="adm-btn adm-btn-outline" onClick={() => setDraft((prev) => [...prev, blankLink()])} style={{ height: 30, padding: '0 10px', fontSize: 12 }}>
                  <FiPlus size={12} /> Add account
                </button>
                <button type="button" className="adm-btn adm-btn-ghost" onClick={cancelEdit} disabled={saving}><FiX size={13} /> Cancel</button>
                <button type="button" className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}><FiSave size={13} /> {saving ? 'Saving…' : 'Save'}</button>
              </>
            ) : (
              <button type="button" className="adm-btn adm-btn-outline" onClick={enterEdit}><FiEdit2 size={13} /> Edit</button>
            )}
          </div>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--adm-text-muted)' }}>
          {data.length} account{data.length !== 1 ? 's' : ''}. Click "Open" to visit each directly.
        </div>
      </div>

      {editMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {draft.map((link) => (
            <SocialEditRow key={link.id} link={link} onChange={(f, v) => updateLink(link.id, f, v)} onRemove={() => removeLink(link.id)} />
          ))}
          {draft.length === 0 && (
            <div className="adm-card" style={{ padding: 24, textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: 13 }}>
              No accounts. Click "Add account" above.
            </div>
          )}
        </div>
      ) : (
        <SocialView links={data} />
      )}
    </>
  );
}
