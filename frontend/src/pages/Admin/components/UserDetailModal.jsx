import { useState } from 'react';
import { FiMail, FiPhone, FiMapPin, FiCalendar, FiActivity, FiBook, FiShield } from 'react-icons/fi';
import AdminModal from './AdminModal';
import api, { resolveUploadUrl } from '../../../services/api';
import { displayContact, isPhoneEmail } from '../adminUtils';

const ROLE_BADGE = {
  admin:       { cls: 'adm-badge-red',   label: 'Admin'       },
  lecturer:    { cls: 'adm-badge-blue',  label: 'Lecturer'    },
  contributor: { cls: 'adm-badge-teal',  label: 'Contributor' },
  student:     { cls: 'adm-badge-gray',  label: 'Student'     },
};

const PLAN_BADGE = {
  master:  { cls: 'adm-badge-amber', label: 'Hero'         },
  serious: { cls: 'adm-badge-teal',  label: 'Helper'       },
  basic:   { cls: 'adm-badge-gray',  label: 'Free Learner' },
};

function scoreColor(score) {
  if (score >= 75) return { bg: 'rgba(5,150,105,0.15)', color: '#059669' };
  if (score >= 50) return { bg: 'rgba(43, 98, 196,0.15)', color: '#2b62c4' };
  if (score >= 25) return { bg: 'rgba(217,119,6,0.12)', color: '#d97706' };
  return { bg: 'rgba(220,38,38,0.12)', color: '#dc2626' };
}

function Field({ label, value, icon: Icon }) {
  return (
    <div className="adm-modal-field">
      <div className="adm-modal-field-label">{Icon && <Icon size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}{label}</div>
      <div className="adm-modal-field-value">{value || <span style={{ color: 'var(--adm-text-light)' }}>—</span>}</div>
    </div>
  );
}

const ROLES = ['student', 'lecturer', 'admin'];

export default function UserDetailModal({ user, onClose, onRoleChanged }) {
  const [tab, setTab]       = useState('info');
  const [role, setRole]     = useState(user.role || 'student');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  const planRaw = (user.subscription?.plan?.name || '').toLowerCase();
  const planKey = planRaw.includes('master') ? 'master' : planRaw.includes('serious') ? 'serious' : 'basic';
  const roleMeta = ROLE_BADGE[role] || ROLE_BADGE.student;
  const planMeta = PLAN_BADGE[planKey];
  const score = user.activenessScore ?? null;
  const sc = score != null ? scoreColor(score) : null;

  const joinDate  = user.created_at  ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const lastActive = user.last_active_at ? new Date(user.last_active_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const handleSaveRole = async () => {
    if (role === user.role) return;
    setSaving(true);
    try {
      const res = await api.admin.setUserRole(user.id, role);
      if (res?.success) {
        setMsg('Role updated');
        onRoleChanged?.(user.id, role);
      } else {
        setMsg(res?.error || 'Failed');
      }
    } catch {
      setMsg('Error');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <AdminModal
      title="User Details"
      onClose={onClose}
      width={640}
      footer={
        <>
          {msg && <span style={{ fontSize: 12, color: msg === 'Role updated' ? 'var(--adm-green)' : 'var(--adm-red)', marginRight: 'auto' }}>{msg}</span>}
          <button type="button" className="adm-btn adm-btn-outline" onClick={onClose}>Close</button>
        </>
      }
    >
      {/* Profile header */}
      <div className="adm-user-profile">
        <div className="adm-user-avatar-lg">
          {user.avatar_url
            ? <img src={resolveUploadUrl(user.avatar_url)} alt={user.full_name} />
            : (user.full_name || displayContact(user) || 'U')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--adm-text)', marginBottom: 4 }}>
            {user.full_name || 'Anonymous User'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-muted)', marginBottom: 10 }}>{displayContact(user)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`adm-badge ${roleMeta.cls}`}>{roleMeta.label}</span>
            <span className={`adm-badge ${planMeta.cls}`}>{planMeta.label}</span>
            {score != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, padding: '3px 9px', borderRadius: 999 }}>
                <FiActivity size={11} /> Score {score}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="adm-modal-tabs">
        {[{ id: 'info', label: 'Info' }, { id: 'academic', label: 'Academic' }, { id: 'manage', label: 'Manage' }].map((t) => (
          <button key={t.id} type="button" className={`adm-modal-tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="adm-modal-field-grid">
          <Field label="Email"        value={isPhoneEmail(user.email) ? null : user.email} icon={FiMail} />
          <Field label="Phone"        value={user.phone_number}  icon={FiPhone}    />
          <Field label="Location"     value={user.location}      icon={FiMapPin}   />
          <Field label="Gender"       value={user.gender}                           />
          <Field label="Joined"       value={joinDate}           icon={FiCalendar} />
          <Field label="Last Active"  value={lastActive}         icon={FiActivity} />
          <Field label="Index Number" value={user.index_number}                    />
          <Field label="Referral Code" value={user.referral_code}                  />
        </div>
      )}

      {tab === 'academic' && (
        <div className="adm-modal-field-grid">
          <Field label="Institution"       value={user.institution}         icon={FiBook} />
          <Field label="Affiliate Uni."    value={user.affiliate_university}             />
          <Field label="Programme Category" value={user.programme_category}              />
          <Field label="Program"           value={user.program}                          />
          <Field label="Level"             value={user.level}                            />
          <Field label="Semester"          value={user.semester}                         />
          <Field label="Contribution Status" value={user.subscription_status}           />
          <Field label="Institution Type"  value={user.institution_type}                 />
        </div>
      )}

      {tab === 'manage' && (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              <FiShield size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />Role Management
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="adm-select" value={role} onChange={(e) => setRole(e.target.value)} disabled={saving}>
                {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <button type="button" className="adm-btn adm-btn-primary" onClick={handleSaveRole} disabled={saving || role === user.role}>
                {saving ? 'Saving…' : 'Update Role'}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Account Details</div>
            {[
              { label: 'User ID',            value: user.id },
              { label: 'Is Contributor',     value: user.is_contributor ? 'Yes' : 'No' },
              { label: 'Contributor Status', value: user.contributor_application_status },
              { label: 'Phone Verified',     value: user.phone_verified ? 'Yes' : 'No' },
              { label: 'Email Verified',     value: user.email_verified ? 'Yes' : 'No' },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--adm-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--adm-text-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminModal>
  );
}
