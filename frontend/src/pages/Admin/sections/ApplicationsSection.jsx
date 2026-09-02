import { useState, useEffect, useCallback } from 'react';
import { FiUserPlus, FiSearch, FiCheck, FiX, FiClock, FiMessageSquare, FiSend } from 'react-icons/fi';
import AdminModal from '../components/AdminModal';
import api from '../../../services/api';

const TYPE_META = {
  contributor: { label: 'Contributor',  badge: 'adm-badge-teal',  emoji: '✍️' },
  ambassador:  { label: 'Ambassador',   badge: 'adm-badge-blue',  emoji: '🌍' },
  developer:   { label: 'Developer',    badge: 'adm-badge-amber', emoji: '💻' },
  designer:    { label: 'Designer',     badge: 'adm-badge-red',   emoji: '🎨' },
  other:       { label: 'Other',        badge: 'adm-badge-gray',  emoji: '📋' },
};

const STATUS_META = {
  pending:      { label: 'Pending',      badge: 'adm-badge-amber', icon: FiClock        },
  approved:     { label: 'Approved',     badge: 'adm-badge-green', icon: FiCheck        },
  rejected:     { label: 'Rejected',     badge: 'adm-badge-red',   icon: FiX            },
  interviewing: { label: 'Interviewing', badge: 'adm-badge-blue',  icon: FiMessageSquare},
};

function ApplicationDetailModal({ app, onClose, onUpdated }) {
  const [status, setStatus]           = useState(app.status);
  const [note, setNote]               = useState(app.adminNote || '');
  const [whatsappLink, setWhatsapp]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');

  // Pre-fill WhatsApp link from team links config
  useEffect(() => {
    api.admin.getTeamLinks().then((res) => {
      if (res?.success) {
        setWhatsapp(res.links?.[app.type]?.whatsapp || '');
      }
    }).catch(() => {});
  }, [app.type]);

  const isNewApproval = status === 'approved' && app.status !== 'approved';
  const alreadySent   = app.whatsappInviteSent;

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const payload = { status, adminNote: note };
      if (status === 'approved' && whatsappLink.trim()) {
        payload.whatsappLink = whatsappLink.trim();
      }
      const res = await api.admin.reviewApplication(app.id, payload);
      if (res?.success) {
        const label = res.inviteSent ? 'Updated · WhatsApp invite sent ✓' : 'Updated';
        setMsg(label);
        onUpdated?.(res.application);
      } else {
        setMsg(res?.error || 'Error');
      }
    } catch { setMsg('Error'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleResendInvite = async () => {
    if (!whatsappLink.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await api.admin.reviewApplication(app.id, {
        status: app.status, adminNote: note,
        whatsappLink: whatsappLink.trim(), sendInvite: true,
      });
      if (res?.success) { setMsg('Invite re-sent ✓'); onUpdated?.(res.application); }
      else setMsg(res?.error || 'Error');
    } catch { setMsg('Error'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const typeMeta   = TYPE_META[app.type]   || TYPE_META.other;
  const statusMeta = STATUS_META[app.status] || STATUS_META.pending;

  return (
    <AdminModal
      title="Application Details"
      onClose={onClose}
      width={600}
      footer={
        <>
          {msg && (
            <span style={{ marginRight: 'auto', fontSize: 12, color: msg.includes('Error') ? 'var(--adm-red)' : 'var(--adm-green)' }}>
              {msg}
            </span>
          )}
          <button type="button" className="adm-btn adm-btn-outline" onClick={onClose}>Close</button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Decision'}
          </button>
        </>
      }
    >
      {/* Header */}
      <div style={{ padding: '20px', display: 'flex', gap: 14, alignItems: 'flex-start', borderBottom: '1px solid var(--adm-border)' }}>
        <div style={{ fontSize: 36, flexShrink: 0 }}>{typeMeta.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--adm-text)', marginBottom: 4 }}>{app.name}</div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-muted)', marginBottom: 8 }}>{app.email}{app.phone ? ` · ${app.phone}` : ''}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`adm-badge ${typeMeta.badge}`}>{typeMeta.label}</span>
            <span className={`adm-badge ${statusMeta.badge}`}>{statusMeta.label}</span>
            <span style={{ fontSize: 11, color: 'var(--adm-text-muted)', alignSelf: 'center' }}>
              Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="adm-modal-field-grid">
        {app.message && (
          <div className="adm-modal-field" style={{ gridColumn: '1 / -1' }}>
            <div className="adm-modal-field-label">Message / Cover Letter</div>
            <div className="adm-modal-field-value" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{app.message}</div>
          </div>
        )}
        {app.motivation && (
          <div className="adm-modal-field" style={{ gridColumn: '1 / -1' }}>
            <div className="adm-modal-field-label">Motivation</div>
            <div className="adm-modal-field-value" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{app.motivation}</div>
          </div>
        )}
        {app.skills && (
          <div className="adm-modal-field">
            <div className="adm-modal-field-label">Skills</div>
            <div className="adm-modal-field-value">{app.skills}</div>
          </div>
        )}
        {app.portfolio && (
          <div className="adm-modal-field">
            <div className="adm-modal-field-label">Portfolio / Links</div>
            <div className="adm-modal-field-value">
              <a href={app.portfolio} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--adm-primary)' }}>{app.portfolio}</a>
            </div>
          </div>
        )}
      </div>

      {/* Review controls */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Decision</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              className={`adm-btn ${status === key ? 'adm-btn-primary' : 'adm-btn-outline'}`}
              style={{ height: 32, fontSize: 12 }}
              onClick={() => setStatus(key)}
            >
              <meta.icon size={12} /> {meta.label}
            </button>
          ))}
        </div>
        <textarea
          style={{ width: '100%', minHeight: 72, padding: '10px 12px', border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
          placeholder="Internal note (optional)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* WhatsApp invite — shown when approving */}
      {status === 'approved' && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--adm-border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15 }}>💬</span> WhatsApp Team Invite
          </div>
          <div style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
            {isNewApproval
              ? 'An email with this WhatsApp link will be sent to the applicant when you save.'
              : alreadySent
                ? `Invite sent on ${new Date(app.whatsappInviteSentAt).toLocaleDateString()}.`
                : 'Invite not yet sent.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="url"
              className="adm-input"
              style={{ flex: 1 }}
              placeholder="https://chat.whatsapp.com/…"
              value={whatsappLink}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            {!isNewApproval && app.status === 'approved' && (
              <button
                type="button"
                className="adm-btn adm-btn-outline"
                onClick={handleResendInvite}
                disabled={saving || !whatsappLink.trim()}
                style={{ whiteSpace: 'nowrap', fontSize: 12 }}
              >
                <FiSend size={12} /> {alreadySent ? 'Resend' : 'Send Invite'}
              </button>
            )}
          </div>
          {!whatsappLink.trim() && (
            <div style={{ fontSize: 11, color: 'var(--adm-text-muted)', fontStyle: 'italic' }}>
              No link entered — invite email will be skipped. Set a default in the Ambassadors or Contributor Ops section.
            </div>
          )}
        </div>
      )}
    </AdminModal>
  );
}

export default function ApplicationsSection() {
  const [apps, setApps]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setType] = useState('all');
  const [statusFilter, setStatus] = useState('all');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage]       = useState(1);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getApplications({ type: typeFilter, status: statusFilter, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
      if (res?.success) { setApps(res.applications || []); setTotal(res.total || 0); }
    } catch { setApps([]); }
    setLoading(false);
  }, [typeFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? apps.filter((a) => `${a.name} ${a.email} ${a.type}`.toLowerCase().includes(search.toLowerCase()))
    : apps;

  const counts = Object.keys(TYPE_META).reduce((acc, t) => {
    acc[t] = apps.filter((a) => a.type === t).length;
    return acc;
  }, {});

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <>
      {selected && (
        <ApplicationDetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setApps((prev) => prev.map((a) => a.id === updated.id ? updated : a));
            setSelected(updated);
          }}
        />
      )}

      {/* Type summary cards */}
      <div className="adm-stats">
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <div
            key={type}
            className="adm-stat"
            style={{ cursor: 'pointer', outline: typeFilter === type ? `2px solid var(--adm-primary)` : undefined }}
            onClick={() => { setType(type === typeFilter ? 'all' : type); setPage(1); }}
          >
            <div className="adm-stat-top">
              <span className="adm-stat-label">{meta.label}s</span>
              <span style={{ fontSize: 20 }}>{meta.emoji}</span>
            </div>
            <div className="adm-stat-value">{counts[type] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="adm-card">
        <div className="adm-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h3 className="adm-card-title">Applications</h3>
          <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiSearch size={13} style={{ color: 'var(--adm-text-muted)' }} />
              <input className="adm-search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="adm-select" value={typeFilter} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="all">All Types</option>
              {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="adm-select" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">All Status</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading applications…</div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Applied</th>
                    <th>Invite</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => {
                    const tm = TYPE_META[app.type] || TYPE_META.other;
                    const sm = STATUS_META[app.status] || STATUS_META.pending;
                    return (
                      <tr key={app.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(app)}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{app.email}</div>
                        </td>
                        <td><span className={`adm-badge ${tm.badge}`}>{tm.label}</span></td>
                        <td><span className={`adm-badge ${sm.badge}`}>{sm.label}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {app.whatsappInviteSent
                            ? <span style={{ color: 'var(--adm-green)' }}>Sent ✓</span>
                            : <span style={{ color: 'var(--adm-text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><FiUserPlus /></div>
                        <p>No applications found.</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--adm-border)' }}>
                <button type="button" className="adm-btn adm-btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{page} / {totalPages} · {total} total</span>
                <button type="button" className="adm-btn adm-btn-outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
