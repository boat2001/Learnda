import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiFileText,
  FiHelpCircle,
  FiInbox,
  FiMessageSquare,
  FiSearch,
  FiSend,
} from 'react-icons/fi';
import api from '../../../services/api';
import { displayContact } from '../adminUtils';

const TYPE_META = {
  Bug: { label: 'Reports', badge: 'adm-badge-red', icon: FiAlertCircle },
  Feedback: { label: 'Ratings & Feedback', badge: 'adm-badge-blue', icon: FiMessageSquare },
  Support: { label: 'Supports', badge: 'adm-badge-amber', icon: FiHelpCircle },
  Wish: { label: 'Wishes', badge: 'adm-badge-teal', icon: FiInbox },
  Investment: { label: 'Investments', badge: 'adm-badge-green', icon: FiInbox },
  Partnership: { label: 'Partnerships', badge: 'adm-badge-blue', icon: FiInbox },
  Partnerships: { label: 'Partnerships', badge: 'adm-badge-blue', icon: FiInbox },
  Community: { label: 'Community', badge: 'adm-badge-teal', icon: FiMessageSquare },
  'Success Story': { label: 'Success Stories', badge: 'adm-badge-green', icon: FiMessageSquare },
  'Success story': { label: 'Success Stories', badge: 'adm-badge-green', icon: FiMessageSquare },
  'Blog Pitch': { label: 'Blog Pitches', badge: 'adm-badge-teal', icon: FiFileText },
  Other: { label: 'Other', badge: 'adm-badge-gray', icon: FiInbox },
};

const STATUS_META = {
  new: { badge: 'adm-badge-amber', label: 'New' },
  in_progress: { badge: 'adm-badge-blue', label: 'In Progress' },
  resolved: { badge: 'adm-badge-green', label: 'Resolved' },
};

function getCreatedAt(message) {
  return message.createdAt || message.created_at || null;
}

export default function MessagesSection({ period }) {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const PER_PAGE = 12;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: PER_PAGE,
        offset: (page - 1) * PER_PAGE,
      };
      if (search) params.search = search;
      if (typeFilter !== 'all') params.category = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.admin.getMessages(params);
      if (res?.success) {
        setMessages(res.messages || []);
        setTotal(res.total || 0);
      }
    } catch {
      setMessages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, period]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const sendReply = async (message) => {
    const body = replyDrafts[message.id];
    if (!body?.trim()) return;
    setSendingId(message.id);
    try {
      const res = await api.admin.replyToMessage(message.id, { body, markResolved: true });
      if (res?.success) {
        setMessages((current) => current.map((item) => (
          item.id === message.id ? res.message : item
        )));
        setReplyDrafts((current) => ({ ...current, [message.id]: '' }));
      }
    } finally {
      setSendingId(null);
    }
  };

  const updateStatus = async (message, status) => {
    const res = await api.admin.updateMessageStatus(message.id, status);
    if (res?.success) {
      setMessages((current) => current.map((item) => (
        item.id === message.id ? res.message : item
      )));
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <section className="adm-section adm-section-messages">
      <div className="adm-section-header">
        <div>
          <h2>Messages & Feedback</h2>
          <p>Support requests, reports, wishes, partnerships, investment enquiries, ratings, and submitted success stories.</p>
        </div>
      </div>

      <div className="adm-stats">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={type} className="adm-stat">
              <div className="adm-stat-top">
                <span className="adm-stat-label">{meta.label}</span>
                <span className="adm-stat-icon"><Icon /></span>
              </div>
              <div className="adm-stat-value">
                {messages.filter((message) => (message.category || 'Other') === type).length}
              </div>
            </div>
          );
        })}
      </div>

      <div className="adm-card">
        <div className="adm-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px' }}>
            <FiSearch size={14} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />
            <input className="adm-search" style={{ flex: 1 }} placeholder="Search messages..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="adm-select" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
              <option value="all">All Types</option>
              {Object.entries(TYPE_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
            <select className="adm-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
              <option value="all">All Status</option>
              {Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading messages...</div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>From</th>
                    <th>Subject / Message</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((message) => {
                    const category = message.category || 'Other';
                    const typeMeta = TYPE_META[category] || TYPE_META.Other;
                    const statusMeta = STATUS_META[message.status] || STATUS_META.new;
                    const isExpanded = expanded === message.id;
                    const createdAt = getCreatedAt(message);
                    return (
                      <Fragment key={message.id}>
                        <tr className="message-row" style={{ cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : message.id)}>
                          <td className="message-cell-type"><span className={`adm-badge ${typeMeta.badge}`}>{typeMeta.label}</span></td>
                          <td className="message-cell-from">
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{message.name || message.user?.full_name || 'Anonymous'}</div>
                            <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{message.email || displayContact(message.user) || '-'}</div>
                          </td>
                          <td className="message-cell-content" style={{ maxWidth: 260 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {message.subject || '(no subject)'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--adm-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {message.message || ''}
                            </div>
                          </td>
                          <td className="message-cell-status"><span className={`adm-badge ${statusMeta.badge}`}>{statusMeta.label}</span></td>
                          <td className="message-cell-date" style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                            {createdAt ? new Date(createdAt).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="message-expanded-row">
                            <td colSpan={5} style={{ background: 'var(--adm-bg)', padding: '14px 20px' }}>
                              <div style={{ fontSize: 13, color: 'var(--adm-text)', lineHeight: 1.6, maxWidth: 720 }}>
                                {message.message || '(No content)'}
                              </div>
                              {message.admin_reply && (
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--adm-border)' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase' }}>Last reply</div>
                                  <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>{message.admin_reply}</div>
                                </div>
                              )}
                              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: 'var(--adm-text-muted)', fontWeight: 700 }}>Status</span>
                                {Object.entries(STATUS_META).map(([key, meta]) => (
                                  <button
                                    key={key}
                                    type="button"
                                    className={`adm-btn ${message.status === key ? 'adm-btn-primary' : 'adm-btn-outline'}`}
                                    onClick={() => updateStatus(message, key)}
                                  >
                                    {meta.label}
                                  </button>
                                ))}
                              </div>
                              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <textarea
                                  className="adm-input adm-input-full"
                                  style={{ minHeight: 72, resize: 'vertical' }}
                                  placeholder="Write a reply..."
                                  value={replyDrafts[message.id] || ''}
                                  onChange={(event) => setReplyDrafts((current) => ({ ...current, [message.id]: event.target.value }))}
                                />
                                <button type="button" className="adm-btn adm-btn-primary" onClick={() => sendReply(message)} disabled={sendingId === message.id}>
                                  <FiSend size={13} />
                                  {sendingId === message.id ? 'Sending...' : 'Reply'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {messages.length === 0 && (
                    <tr><td colSpan={5}><div className="adm-empty"><div className="adm-empty-icon"><FiInbox /></div><p>No messages found.</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '14px 20px', borderTop: '1px solid var(--adm-border)' }}>
                <button type="button" className="adm-btn adm-btn-outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--adm-text-muted)', padding: '0 8px' }}>Page {page} of {totalPages}</span>
                <button type="button" className="adm-btn adm-btn-outline" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
