import { useState, useEffect, useCallback } from 'react';
import { FiUserPlus, FiMail, FiPhone, FiTrash2, FiRefreshCw, FiCopy, FiCheck } from 'react-icons/fi';
import api from '../../../services/api';
import { displayContact } from '../adminUtils';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://beta.learnda.app';

const STATUS_LABEL = {
  pending:   'Invited',
  completed: 'Joined',
  revoked:   'Revoked',
  expired:   'Expired',
};

function statusBadge(status) {
  const map = {
    pending:   'adm-badge-amber',
    completed: 'adm-badge-green',
    revoked:   'adm-badge-red',
    expired:   'adm-badge-gray',
  };
  return `adm-badge ${map[status] || 'adm-badge-gray'}`;
}

function isExpired(invite) {
  return invite.status === 'pending' && new Date(invite.expires_at) < new Date();
}

export default function LecturersSection() {
  const [invites, setInvites]     = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [contact, setContact]     = useState('');
  const [sending, setSending]     = useState(false);
  const [toast, setToast]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const [invRes, lecRes] = await Promise.all([
      api.admin.getLecturerInvites().catch(() => null),
      api.admin.getLecturers({ limit: 50 }).catch(() => null),
    ]);
    if (invRes?.success) setInvites(invRes.invites || []);
    if (lecRes?.success) setLecturers(lecRes.users || []);
    if (showSpinner) setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 20 s so completed/expired statuses refresh without manual action
  useEffect(() => {
    const t = setInterval(() => { load(false); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setSending(true);
    try {
      const res = await api.admin.sendLecturerInvite(contact.trim());
      if (res?.success) {
        showToast(`Invitation sent to ${contact.trim()}`);
        setContact('');
        load();
      } else {
        showToast(res?.error || 'Failed to send invite');
      }
    } catch {
      showToast('Error sending invite');
    }
    setSending(false);
  };

  const handleRevoke = async (id, contactLabel) => {
    if (!window.confirm(`Revoke the invite for ${contactLabel}?`)) return;
    const res = await api.admin.revokeLecturerInvite(id).catch(() => null);
    if (res?.success) {
      showToast('Invite revoked');
      setInvites((prev) => prev.map((i) => i.id === id ? { ...i, status: 'revoked' } : i));
    }
  };

  const copyLink = (invite) => {
    const link = invite.link || `${SITE_URL}/lecturer-invite/${invite.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(invite.id);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading lecturer data…
      </div>
    );
  }

  const pendingCount   = invites.filter((i) => i.status === 'pending' && !isExpired(i)).length;
  const completedCount = invites.filter((i) => i.status === 'completed').length;

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      {/* Summary stats */}
      <div className="adm-stats">
        <div className="adm-stat accent-blue">
          <div className="adm-stat-top"><span className="adm-stat-label">Total Lecturers</span><span className="adm-stat-icon"><FiUserPlus /></span></div>
          <div className="adm-stat-value">{lecturers.length}</div>
        </div>
        <div className="adm-stat accent-amber">
          <div className="adm-stat-top"><span className="adm-stat-label">Active Invites</span><span className="adm-stat-icon"><FiMail /></span></div>
          <div className="adm-stat-value">{pendingCount}</div>
        </div>
        <div className="adm-stat accent-green">
          <div className="adm-stat-top"><span className="adm-stat-label">Lecturers Joined</span><span className="adm-stat-icon"><FiCheck /></span></div>
          <div className="adm-stat-value">{completedCount}</div>
        </div>
      </div>

      {/* Invite form */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Invite a Lecturer</h3>
        </div>
        <div className="adm-card-body">
          <p style={{ fontSize: 13, color: 'var(--adm-text-muted)', marginBottom: 16 }}>
            Enter the lecturer's email address or phone number. They'll receive a link to a registration form where they fill in their details.
          </p>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <input
                className="adm-input"
                type="text"
                placeholder="Email address or phone number"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                disabled={sending}
                style={{ width: '100%', paddingLeft: 34 }}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--adm-text-muted)', pointerEvents: 'none' }}>
                {contact.includes('@') ? <FiMail size={14} /> : <FiPhone size={14} />}
              </span>
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={sending || !contact.trim()}>
              {sending ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
        </div>
      </div>

      {/* Invite history */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Sent Invitations</h3>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => load(true)} style={{ padding: '4px 10px', fontSize: 12 }}>
            <FiRefreshCw size={12} style={{ marginRight: 4 }} />Refresh
          </button>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Type</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 && (
                <tr><td colSpan={6}><div className="adm-empty"><p>No invitations sent yet.</p></div></td></tr>
              )}
              {invites.map((inv) => {
                const expired = isExpired(inv);
                const displayStatus = expired ? 'expired' : inv.status;
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{inv.contact}</td>
                    <td>
                      <span className="adm-badge adm-badge-gray">
                        {inv.contact_type === 'email' ? <><FiMail size={10} style={{ marginRight: 3 }} />Email</> : <><FiPhone size={10} style={{ marginRight: 3 }} />Phone</>}
                      </span>
                    </td>
                    <td><span className={statusBadge(displayStatus)}>{STATUS_LABEL[displayStatus] || displayStatus}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                      {new Date(inv.invited_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: 12, color: expired ? 'var(--adm-red)' : 'var(--adm-text-muted)' }}>
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {displayStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              title="Copy invite link"
                              className="adm-btn adm-btn-ghost"
                              style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => copyLink(inv)}
                            >
                              {copied === inv.id ? <FiCheck size={12} /> : <FiCopy size={12} />}
                            </button>
                            <button
                              type="button"
                              title="Revoke invite"
                              className="adm-btn adm-btn-ghost"
                              style={{ padding: '3px 8px', fontSize: 11, color: 'var(--adm-red)' }}
                              onClick={() => handleRevoke(inv.id, inv.contact)}
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registered lecturers */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Registered Lecturers</h3>
          <span className="adm-badge adm-badge-blue">{lecturers.length}</span>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>College / Dept</th>
                <th>Qualification</th>
                <th>Payout</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {lecturers.length === 0 && (
                <tr><td colSpan={5}><div className="adm-empty"><p>No lecturers registered yet.</p></div></td></tr>
              )}
              {lecturers.map((u) => {
                const lp = u.preferences?.lecturer || {};
                const payoutLabel = lp.payout_channel === 'bank'
                  ? `Bank · ${lp.payout_bank || u.payout_contact || '—'}`
                  : `MoMo · ${lp.payout_network || u.payout_telco || ''} ${u.payout_contact || ''}`.trim();
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{displayContact(u)}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{lp.college || u.institution || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{lp.department || u.program || ''}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{lp.highest_qualification || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{payoutLabel || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
