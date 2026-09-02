import { useState, useEffect, useCallback } from 'react';
import {
  FiUsers, FiSend, FiCheck, FiX, FiClock, FiMessageSquare,
  FiLink, FiSave, FiRefreshCw, FiCopy, FiDollarSign,
} from 'react-icons/fi';
import api from '../../../services/api';
import { displayContact } from '../adminUtils';

const PAYOUT_STATUS = {
  requested: { label: 'Requested', badge: 'adm-badge-amber' },
  approved:  { label: 'Approved',  badge: 'adm-badge-blue'  },
  paid:      { label: 'Paid',      badge: 'adm-badge-green' },
  rejected:  { label: 'Rejected',  badge: 'adm-badge-red'   },
};

function BroadcastCard({ type }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.admin.sendTeamBroadcast({
        type,
        subject: subject.trim() || undefined,
        message: message.trim(),
      });
      if (res?.success) {
        setResult({ ok: true, msg: `Sent to ${res.sent} ambassador${res.sent !== 1 ? 's' : ''}` });
        setMessage('');
        setSubject('');
      } else {
        setResult({ ok: false, msg: res?.error || 'Failed to send' });
      }
    } catch { setResult({ ok: false, msg: 'Server error' }); }
    setSending(false);
    setTimeout(() => setResult(null), 6000);
  };

  return (
    <div className="adm-card">
      <div className="adm-card-header">
        <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiSend size={14} /> Message Ambassadors
        </h3>
      </div>
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
          Send an email to all <strong>active ambassadors</strong>. Use <code style={{ background: 'var(--adm-surface)', padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code> to personalise.
        </div>
        <input
          className="adm-input"
          type="text"
          placeholder="Email subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          style={{ width: '100%', minHeight: 96, padding: '10px 12px', border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
          placeholder="Hey {name}! Write your message here…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {result && <span style={{ fontSize: 12, color: result.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>{result.msg}</span>}
          <div style={{ flex: 1 }} />
          <button type="button" className="adm-btn adm-btn-primary" onClick={handleSend} disabled={sending || !message.trim()}>
            <FiSend size={13} /> {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppLinkCard({ type, label }) {
  const [link, setLink]     = useState('');
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.admin.getTeamLinks().then((res) => {
      if (res?.success) setLink(res.links?.[type]?.whatsapp || '');
    }).catch(() => {});
  }, [type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.admin.saveTeamLinks({ [type]: { whatsapp: link.trim() } });
      if (res?.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!link.trim()) return;
    navigator.clipboard.writeText(link.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="adm-card">
      <div className="adm-card-header">
        <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiLink size={14} /> {label} WhatsApp Group
        </h3>
      </div>
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
          This link is automatically included in the approval email sent to accepted applicants.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="adm-input"
            type="url"
            placeholder="https://chat.whatsapp.com/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            style={{ padding: '0 10px' }}
            onClick={handleCopy}
            disabled={!link.trim()}
            title="Copy link"
          >
            {copied ? <FiCheck size={14} style={{ color: 'var(--adm-green)' }} /> : <FiCopy size={14} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: 'var(--adm-green)' }}>Saved</span>}
          <div style={{ flex: 1 }} />
          <button type="button" className="adm-btn adm-btn-outline" onClick={handleSave} disabled={saving}>
            <FiSave size={13} /> {saving ? 'Saving…' : 'Save Link'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PayoutsTab() {
  const [payouts, setPayouts]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setFilter]   = useState('all');
  const [page, setPage]             = useState(1);
  const [updating, setUpdating]     = useState(null);
  const [actionMsg, setActionMsg]   = useState(null);
  const PER_PAGE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getRewardPayouts({
        status: statusFilter,
        limit: PER_PAGE,
        page,
      });
      if (res?.success) { setPayouts(res.payouts || []); setTotal(res.total || 0); }
    } catch { setPayouts([]); }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (payout, newStatus) => {
    setUpdating(payout.id);
    setActionMsg(null);
    try {
      const res = await api.admin.updateRewardPayout(payout.id, { status: newStatus });
      if (res?.success) {
        setActionMsg({ ok: true, msg: `Marked as ${newStatus}` });
        load();
      } else {
        setActionMsg({ ok: false, msg: res?.error || 'Failed' });
      }
    } catch { setActionMsg({ ok: false, msg: 'Server error' }); }
    setUpdating(null);
    setTimeout(() => setActionMsg(null), 4000);
  };

  const totalPages = Math.ceil(total / PER_PAGE);
  const pendingCount = payouts.filter((p) => p.status === 'requested').length;

  return (
    <div className="adm-card">
      <div className="adm-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiDollarSign size={14} /> Payout Requests
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingCount > 0 && (
            <span className="adm-badge adm-badge-amber">{pendingCount} pending</span>
          )}
          <select
            className="adm-select"
            value={statusFilter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All</option>
            {Object.entries(PAYOUT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={load} style={{ padding: '4px 10px', fontSize: 12 }}>
            <FiRefreshCw size={12} />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{ padding: '8px 20px', fontSize: 13, color: actionMsg.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>
          {actionMsg.msg}
        </div>
      )}

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /> Loading payouts…</div>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Ambassador</th>
                  <th>Amount</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="adm-empty">
                      <div className="adm-empty-icon">💸</div>
                      <p>No payout requests found.</p>
                    </div>
                  </td></tr>
                )}
                {payouts.map((p) => {
                  const sm = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.requested;
                  const isProcessing = updating === p.id;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.user?.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{displayContact(p.user)}</div>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>
                        GH₵ {Number(p.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                        <div>{p.destination_telco || p.destination || '—'}</div>
                        {p.destination && p.destination_telco && (
                          <div style={{ fontSize: 11 }}>{p.destination}</div>
                        )}
                      </td>
                      <td>
                        <span className={`adm-badge ${sm.badge}`}>{sm.label}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                        {p.requested_at ? new Date(p.requested_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {p.status === 'requested' && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-outline"
                              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--adm-blue)' }}
                              disabled={isProcessing}
                              onClick={() => handleStatus(p, 'approved')}
                            >
                              Approve
                            </button>
                          )}
                          {(p.status === 'requested' || p.status === 'approved') && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-outline"
                              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--adm-green)' }}
                              disabled={isProcessing}
                              onClick={() => handleStatus(p, 'paid')}
                            >
                              <FiCheck size={10} /> Paid
                            </button>
                          )}
                          {p.status !== 'rejected' && p.status !== 'paid' && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-ghost"
                              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--adm-red)' }}
                              disabled={isProcessing}
                              onClick={() => handleStatus(p, 'rejected')}
                            >
                              <FiX size={10} /> Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
  );
}

export default function AmbassadorsSection() {
  const [ambassadors, setAmbassadors]   = useState([]);
  const [pending, setPending]           = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState('ambassadors');
  const [actionResult, setActionResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, pendingRes, payoutRes] = await Promise.all([
        api.admin.getApplications({ type: 'ambassador', status: 'approved', limit: 100 }),
        api.admin.getApplications({ type: 'ambassador', status: 'pending',  limit: 50  }),
        api.admin.getRewardPayouts({ status: 'requested', limit: 1 }).catch(() => null),
      ]);
      setAmbassadors(activeRes?.applications || []);
      setPending(pendingRes?.applications || []);
      setPendingPayouts(payoutRes?.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (app, decision) => {
    setActionResult(null);
    try {
      const res = await api.admin.reviewApplication(app.id, { status: decision });
      if (res?.success) {
        setActionResult({ ok: true, msg: `${app.name} ${decision}` });
        load();
      } else {
        setActionResult({ ok: false, msg: res?.error || 'Failed' });
      }
    } catch { setActionResult({ ok: false, msg: 'Server error' }); }
    setTimeout(() => setActionResult(null), 4000);
  };

  const thisMonth = ambassadors.filter((a) => {
    const d = new Date(a.reviewedAt || a.createdAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return (
    <>
      {/* Stats */}
      <div className="adm-stats">
        <div className="adm-stat accent-blue">
          <div className="adm-stat-top"><span className="adm-stat-label">Active Ambassadors</span><span className="adm-stat-icon"><FiUsers /></span></div>
          <div className="adm-stat-value">{ambassadors.length}</div>
        </div>
        <div className="adm-stat accent-amber">
          <div className="adm-stat-top"><span className="adm-stat-label">Pending Applications</span><span className="adm-stat-icon"><FiClock /></span></div>
          <div className="adm-stat-value">{pending.length}</div>
        </div>
        <div className="adm-stat accent-green">
          <div className="adm-stat-top"><span className="adm-stat-label">Joined This Month</span><span className="adm-stat-icon"><FiCheck /></span></div>
          <div className="adm-stat-value">{thisMonth}</div>
        </div>
        <div className="adm-stat accent-amber">
          <div className="adm-stat-top"><span className="adm-stat-label">Payouts Pending</span><span className="adm-stat-icon"><FiDollarSign /></span></div>
          <div className="adm-stat-value">{pendingPayouts}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="adm-modal-tabs" style={{ marginBottom: 20 }}>
        <button type="button" className={`adm-modal-tab${tab === 'ambassadors' ? ' is-active' : ''}`} onClick={() => setTab('ambassadors')}>
          <FiUsers size={13} /> Active Ambassadors
        </button>
        <button type="button" className={`adm-modal-tab${tab === 'pending' ? ' is-active' : ''}`} onClick={() => setTab('pending')}>
          <FiClock size={13} /> Applications
          {pending.length > 0 && <span className="adm-badge adm-badge-amber" style={{ marginLeft: 4 }}>{pending.length}</span>}
        </button>
        <button type="button" className={`adm-modal-tab${tab === 'payouts' ? ' is-active' : ''}`} onClick={() => setTab('payouts')}>
          <FiDollarSign size={13} /> Payouts
          {pendingPayouts > 0 && <span className="adm-badge adm-badge-amber" style={{ marginLeft: 4 }}>{pendingPayouts}</span>}
        </button>
        <button type="button" className={`adm-modal-tab${tab === 'comms' ? ' is-active' : ''}`} onClick={() => setTab('comms')}>
          <FiMessageSquare size={13} /> Communications
        </button>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /> Loading…</div>
      ) : (
        <>
          {tab === 'ambassadors' && (
            <div className="adm-card">
              <div className="adm-card-header">
                <h3 className="adm-card-title">Ambassadors</h3>
                <button type="button" className="adm-btn adm-btn-ghost" onClick={load} style={{ padding: '4px 10px', fontSize: 12 }}>
                  <FiRefreshCw size={12} style={{ marginRight: 4 }} />Refresh
                </button>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr><th>Name</th><th>Contact</th><th>WhatsApp Invite</th><th>Joined</th></tr>
                  </thead>
                  <tbody>
                    {ambassadors.length === 0 && (
                      <tr><td colSpan={4}>
                        <div className="adm-empty"><div className="adm-empty-icon">🌍</div><p>No active ambassadors yet.</p></div>
                      </td></tr>
                    )}
                    {ambassadors.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                          {a.adminNote && <div style={{ fontSize: 11, color: 'var(--adm-text-muted)', fontStyle: 'italic' }}>{a.adminNote}</div>}
                        </td>
                        <td>
                          <div style={{ fontSize: 12 }}>{a.email}</div>
                          {a.phone && <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{a.phone}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {a.whatsappInviteSent
                            ? <span style={{ color: 'var(--adm-green)' }}>Sent ✓</span>
                            : <span style={{ color: 'var(--adm-text-muted)' }}>Not sent</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                          {a.reviewedAt ? new Date(a.reviewedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'pending' && (
            <div className="adm-card">
              <div className="adm-card-header">
                <h3 className="adm-card-title">Pending Applications</h3>
                <span className="adm-badge adm-badge-amber">{pending.length}</span>
              </div>
              {actionResult && (
                <div style={{ padding: '8px 20px', fontSize: 13, color: actionResult.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>
                  {actionResult.msg}
                </div>
              )}
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr><th>Applicant</th><th>Applied</th><th>Message</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {pending.length === 0 && (
                      <tr><td colSpan={4}><div className="adm-empty"><p>No pending applications.</p></div></td></tr>
                    )}
                    {pending.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{a.email}</div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.message || a.motivation || '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="adm-btn adm-btn-outline"
                              style={{ fontSize: 11, padding: '3px 10px', color: 'var(--adm-green)' }}
                              onClick={() => handleDecision(a, 'approved')}
                            >
                              <FiCheck size={11} /> Approve
                            </button>
                            <button
                              type="button"
                              className="adm-btn adm-btn-ghost"
                              style={{ fontSize: 11, padding: '3px 10px', color: 'var(--adm-red)' }}
                              onClick={() => handleDecision(a, 'rejected')}
                            >
                              <FiX size={11} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'payouts' && <PayoutsTab />}

          {tab === 'comms' && (
            <>
              <BroadcastCard type="ambassador" />
              <WhatsAppLinkCard type="ambassador" label="Ambassador" />
            </>
          )}
        </>
      )}
    </>
  );
}
