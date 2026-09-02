import { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';

const ADMIN_TITLE_OPTIONS = [
  'Superadmin',
  'Administrator',
  'Content Admin',
  'Publishing Admin',
  'Community Admin',
  'Analytics Admin',
  'Revenue Admin',
  'Support Admin',
  'Applications Admin',
];

export default function AdminAccessSection() {
  const [admins, setAdmins] = useState([]);
  const [sections, setSections] = useState([]);
  const [logs, setLogs] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const sectionGroups = useMemo(() => {
    return sections.reduce((groups, section) => {
      const key = section.group || 'OTHER';
      groups[key] = groups[key] || [];
      groups[key].push(section);
      return groups;
    }, {});
  }, [sections]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [adminsRes, logsRes] = await Promise.all([
        api.admin.getAdmins(),
        api.admin.getAuditLogs({ limit: 40 }),
      ]);
      setAdmins(Array.isArray(adminsRes?.admins) ? adminsRes.admins : []);
      setSections(Array.isArray(adminsRes?.sections) ? adminsRes.sections : []);
      setLogs(Array.isArray(logsRes?.logs) ? logsRes.logs : []);
    } catch (err) {
      setError(err.message || 'Failed to load admin access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const query = userSearch.trim();
    if (query.length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return undefined;
    }

    let mounted = true;
    setSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.admin.getUsers({ q: query, limit: 8, page: 1 });
        const adminIds = new Set(admins.map((admin) => String(admin.id)));
        const users = Array.isArray(res?.users) ? res.users : [];
        if (mounted) {
          setUserResults(users.filter((user) => !adminIds.has(String(user.id))));
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to search users.');
      } finally {
        if (mounted) setSearchingUsers(false);
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [admins, userSearch]);

  const updateDraft = (id, patch) => {
    setAdmins((current) => current.map((admin) => (
      admin.id === id ? { ...admin, ...patch } : admin
    )));
  };

  const togglePermission = (admin, sectionId) => {
    const current = new Set(admin.admin_permissions || []);
    if (current.has(sectionId)) current.delete(sectionId);
    else current.add(sectionId);
    updateDraft(admin.id, { admin_permissions: [...current] });
  };

  const saveAdmin = async (admin) => {
    setSavingId(admin.id);
    setError('');
    try {
      const res = await api.admin.updateAdminAccess(admin.id, {
        is_superadmin: Boolean(admin.is_superadmin),
        admin_title: admin.admin_title,
        admin_permissions: admin.admin_permissions || [],
      });
      if (res?.admin) {
        setAdmins((current) => current.map((item) => item.id === admin.id ? res.admin : item));
      }
      const logsRes = await api.admin.getAuditLogs({ limit: 40 });
      setLogs(Array.isArray(logsRes?.logs) ? logsRes.logs : []);
    } catch (err) {
      setError(err.message || 'Failed to save admin access.');
    } finally {
      setSavingId('');
    }
  };

  const addAdmin = async (user) => {
    setSavingId(user.id);
    setError('');
    try {
      const roleRes = await api.admin.setUserRole(user.id, 'admin');
      if (!roleRes?.success) throw new Error(roleRes?.error || 'Failed to add admin.');

      const accessRes = await api.admin.updateAdminAccess(user.id, {
        is_superadmin: false,
        admin_title: 'Administrator',
        admin_permissions: [],
      });
      if (!accessRes?.admin) throw new Error(accessRes?.error || 'Failed to initialize admin access.');

      setAdmins((current) => [accessRes.admin, ...current]);
      setUserSearch('');
      setUserResults([]);
      const logsRes = await api.admin.getAuditLogs({ limit: 40 });
      setLogs(Array.isArray(logsRes?.logs) ? logsRes.logs : []);
    } catch (err) {
      setError(err.message || 'Failed to add admin.');
    } finally {
      setSavingId('');
    }
  };

  const removeAdmin = async (admin) => {
    const label = admin.full_name || admin.email;
    if (!window.confirm(`Remove admin access for ${label}? They will no longer be able to use the admin console.`)) {
      return;
    }

    setSavingId(admin.id);
    setError('');
    try {
      const res = await api.admin.setUserRole(admin.id, 'student');
      if (!res?.success) throw new Error(res?.error || 'Failed to remove admin access.');
      setAdmins((current) => current.filter((item) => item.id !== admin.id));
      const logsRes = await api.admin.getAuditLogs({ limit: 40 });
      setLogs(Array.isArray(logsRes?.logs) ? logsRes.logs : []);
    } catch (err) {
      setError(err.message || 'Failed to remove admin access.');
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return <div className="adm-loading"><div className="adm-spinner" /> Loading admin access...</div>;
  }

  return (
    <div className="adm-section-admin-access">
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">Admin access</h2>
          <p className="adm-section-subtitle">Assign each admin to the console sections they should work on.</p>
        </div>
      </div>

      {error && <div className="adm-alert adm-alert-danger">{error}</div>}

      <div className="adm-card adm-add-admin-card">
        <div>
          <h3 className="adm-card-title">Add admin</h3>
          <p className="adm-card-subtitle">Search an existing user, promote them, then assign their console access below.</p>
        </div>
        <div className="adm-add-admin-search">
          <input
            className="adm-search"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search by name, email, or phone"
          />
          {searchingUsers && <span className="adm-muted-small">Searching...</span>}
        </div>
        {!!userResults.length && (
          <div className="adm-user-search-results">
            {userResults.map((user) => (
              <div key={user.id} className="adm-user-search-result">
                <div>
                  <div className="adm-user-result-name">{user.full_name || user.email || 'Unnamed user'}</div>
                  <div className="adm-card-subtitle">{user.email || user.phone_number || 'No contact'}</div>
                </div>
                <span className="adm-badge adm-badge-gray">{user.role || 'student'}</span>
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  disabled={savingId === user.id}
                  onClick={() => addAdmin(user)}
                >
                  {savingId === user.id ? 'Adding...' : 'Add admin'}
                </button>
              </div>
            ))}
          </div>
        )}
        {userSearch.trim().length >= 2 && !searchingUsers && !userResults.length && (
          <div className="adm-muted-small">No matching non-admin users found.</div>
        )}
      </div>

      <div className="adm-card-grid">
        {admins.map((admin) => (
          <article key={admin.id} className="adm-card adm-admin-access-card">
            <div className="adm-card-head">
              <div>
                <h3 className="adm-card-title">{admin.full_name || admin.email}</h3>
                <p className="adm-card-subtitle">{admin.email}</p>
              </div>
              <span className={`adm-badge ${admin.is_superadmin ? 'adm-badge-red' : 'adm-badge-blue'}`}>
                {admin.is_superadmin ? 'Superadmin' : 'Admin'}
              </span>
            </div>

            <label className="adm-field-label">Admin title</label>
            <select
              className="adm-select adm-select-full"
              value={admin.admin_title || (admin.is_superadmin ? 'Superadmin' : 'Administrator')}
              onChange={(event) => updateDraft(admin.id, { admin_title: event.target.value })}
            >
              {ADMIN_TITLE_OPTIONS.map((title) => (
                <option key={title} value={title}>{title}</option>
              ))}
            </select>

            <label className="adm-check-row adm-admin-toggle">
              <input
                type="checkbox"
                checked={Boolean(admin.is_superadmin)}
                onChange={(event) => updateDraft(admin.id, { is_superadmin: event.target.checked })}
              />
              <span>Superadmin: can see all sections, manage admins, and view logs.</span>
            </label>

            {!admin.is_superadmin && (
              <div className="adm-permission-groups">
                {Object.entries(sectionGroups).map(([group, items]) => (
                  <div key={group} className="adm-permission-group">
                    <strong>{group}</strong>
                    {items.map((section) => (
                      <label key={section.id} className="adm-check-row">
                        <input
                          type="checkbox"
                          checked={(admin.admin_permissions || []).includes(section.id)}
                          onChange={() => togglePermission(admin, section.id)}
                        />
                        <span>{section.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="adm-card-actions">
              <button
                type="button"
                className="adm-btn adm-btn-danger"
                disabled={savingId === admin.id}
                onClick={() => removeAdmin(admin)}
              >
                Remove admin
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                disabled={savingId === admin.id}
                onClick={() => saveAdmin(admin)}
              >
                {savingId === admin.id ? 'Saving...' : 'Save access'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="adm-section-head" style={{ marginTop: 24 }}>
        <div>
          <h2 className="adm-section-title">Admin activity log</h2>
          <p className="adm-section-subtitle">Recent admin console access and write actions.</p>
        </div>
      </div>

      <div className="adm-card adm-admin-log-card">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Section</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.admin_name || log.admin_email || 'Unknown'}</td>
                  <td>{String(log.action || '').replace(/_/g, ' ')}</td>
                  <td>{log.section || '-'}</td>
                  <td>{log.status_code || '-'}</td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan="5">No admin logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
