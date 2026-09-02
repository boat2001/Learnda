import { useEffect, useState } from 'react';
import { FiLink, FiEdit2, FiSave, FiX, FiPlus, FiTrash2, FiExternalLink } from 'react-icons/fi';
import api from '../../../services/api';

const lbl = { fontSize: 11, color: 'var(--adm-text-muted)', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

const blankService = () => ({ id: `svc_${Date.now()}`, name: '', link: '', description: '' });

/* ── View ──────────────────────────────────────────────────────────────────── */
function ServicesView({ services }) {
  if (services.length === 0) return (
    <div className="adm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: 13 }}>
      No services configured yet.
    </div>
  );

  return (
    <div className="adm-grid-2">
      {services.map((svc) => (
        <div key={svc.id} className="adm-card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--adm-text)' }}>{svc.name || '—'}</span>
            {svc.link && (
              <a
                href={svc.link}
                target="_blank"
                rel="noopener noreferrer"
                className="adm-btn adm-btn-outline"
                style={{ height: 26, padding: '0 10px', fontSize: 12, flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <FiExternalLink size={11} /> Open
              </a>
            )}
          </div>
          {svc.description && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--adm-text-muted)', lineHeight: 1.5 }}>{svc.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Edit row ──────────────────────────────────────────────────────────────── */
function ServiceEditRow({ service, onChange, onRemove }) {
  return (
    <div className="adm-card" style={{ padding: '14px 18px' }}>
      <div className="adm-grid-2" style={{ marginBottom: 10 }}>
        <div>
          <label style={lbl}>Service name</label>
          <input className="adm-input adm-input-full" value={service.name} onChange={(e) => onChange('name', e.target.value)} placeholder="e.g. Cloudflare" />
        </div>
        <div>
          <label style={lbl}>Link / URL</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="adm-input adm-input-full" value={service.link} onChange={(e) => onChange('link', e.target.value)} placeholder="https://..." style={{ flex: 1, width: 'auto' }} />
            {service.link && (
              <a href={service.link} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-ghost" style={{ height: 34, padding: '0 8px', flexShrink: 0 }} title="Open">
                <FiExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>What they help with</label>
          <textarea className="adm-input adm-input-full" value={service.description} onChange={(e) => onChange('description', e.target.value)} placeholder="e.g. CDN, DNS, object storage, domain proxy" rows={2} style={{ height: 'auto', resize: 'vertical' }} />
        </div>
        <button type="button" className="adm-btn adm-btn-ghost" style={{ height: 34, padding: '0 8px', color: 'var(--adm-red)', marginTop: 18, flexShrink: 0 }} onClick={onRemove} title="Remove">
          <FiTrash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Section ───────────────────────────────────────────────────────────────── */
export default function ServicesSection() {
  const [data, setData] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const editMode = draft !== null;

  useEffect(() => {
    api.admin.getServices()
      .then((res) => { if (res?.success) setData(res.services); })
      .catch(() => setError('Failed to load services.'))
      .finally(() => setLoading(false));
  }, []);

  const enterEdit = () => setDraft(JSON.parse(JSON.stringify(data)));
  const cancelEdit = () => { setDraft(null); setError(''); };

  const updateService = (id, field, value) =>
    setDraft((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));

  const addService = () =>
    setDraft((prev) => [...prev, blankService()]);

  const removeService = (id) =>
    setDraft((prev) => prev.filter((s) => s.id !== id));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.admin.saveServices(draft);
      if (res?.success) {
        setData(draft); setDraft(null);
        setSaved(true); setTimeout(() => setSaved(false), 3000);
      } else { setError('Failed to save.'); }
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="adm-loading"><div className="adm-spinner" />Loading services…</div>;

  return (
    <section className="adm-section adm-section-services">
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title"><FiLink size={14} style={{ marginRight: 6 }} />Services &amp; Partners</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && !editMode && <span style={{ fontSize: 12, color: 'var(--adm-green)' }}>Saved</span>}
            {error && <span style={{ fontSize: 12, color: 'var(--adm-red)' }}>{error}</span>}
            {editMode ? (
              <>
                <button type="button" className="adm-btn adm-btn-outline" onClick={addService} style={{ height: 30, padding: '0 10px', fontSize: 12 }}>
                  <FiPlus size={12} /> Add service
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
          {data.length} service{data.length !== 1 ? 's' : ''} configured.
        </div>
      </div>

      {editMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {draft.map((svc) => (
            <ServiceEditRow key={svc.id} service={svc} onChange={(f, v) => updateService(svc.id, f, v)} onRemove={() => removeService(svc.id)} />
          ))}
          {draft.length === 0 && (
            <div className="adm-card" style={{ padding: 24, textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: 13 }}>
              No services. Click "Add service" above.
            </div>
          )}
        </div>
      ) : (
        <ServicesView services={data} />
      )}
    </section>
  );
}
