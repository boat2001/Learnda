import { useState, useEffect, useCallback } from 'react';
import { FiBook, FiVideo, FiCheckSquare, FiPlay, FiUsers, FiSearch, FiCheck, FiX, FiClock, FiExternalLink, FiFile, FiFilm, FiFileText } from 'react-icons/fi';
import AdminModal from '../components/AdminModal';
import api from '../../../services/api';
import { sanitizeLessonHtml } from '../../../utils/sanitizeHtml';
import { repairJoinedWords } from '../../../utils/textCleanup';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

const STATUS_BADGE = {
  published: 'adm-badge-green',
  draft:     'adm-badge-gray',
  pending:   'adm-badge-amber',
  rejected:  'adm-badge-red',
};

const TYPE_BADGE = {
  text:        'adm-badge-blue',
  video:       'adm-badge-teal',
  test:        'adm-badge-amber',
  edutainment: 'adm-badge-green',
};

function getLessonChunks(item) {
  const doc = item.lesson_document || item.lessonDocument || item.metadata?.lesson_document;
  return Array.isArray(doc?.chunks) ? doc.chunks : [];
}

function getPreviewHtml(chunk) {
  if (chunk?.html) return chunk.html;
  if (chunk?.content) return chunk.content;
  if (chunk?.body) return chunk.body;
  return '';
}

function ContentPreviewBlocks({ item }) {
  const objectives = Array.isArray(item.objectives) ? item.objectives : [];
  const chunks = getLessonChunks(item);
  const exercises = Array.isArray(item.exercises) ? item.exercises : [];
  const questions = Array.isArray(item.questions)
    ? item.questions
    : (Array.isArray(item.metadata?.questions) ? item.metadata.questions : []);
  const sections = item.sections && typeof item.sections === 'object' && !Array.isArray(item.sections)
    ? item.sections
    : (item.metadata?.sections && typeof item.metadata.sections === 'object' && !Array.isArray(item.metadata.sections) ? item.metadata.sections : {});

  if (!objectives.length && !chunks.length && !exercises.length && !questions.length && !Object.keys(sections || {}).length) {
    return null;
  }

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--adm-border)' }}>
      {objectives.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="adm-modal-field-label" style={{ marginBottom: 8 }}>Objectives</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            {objectives.slice(0, 8).map((objective, index) => <li key={index}>{objective}</li>)}
          </ul>
        </div>
      )}

      {chunks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="adm-modal-field-label" style={{ marginBottom: 8 }}>Lesson Chunks</div>
          {chunks.slice(0, 6).map((chunk, index) => (
            <div key={index} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6, color: 'var(--adm-text)' }}>
                {chunk.title || `Chunk ${index + 1}`}
              </div>
              <div
                className="content-view"
                dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(getPreviewHtml(chunk)) }}
              />
            </div>
          ))}
        </div>
      )}

      {Object.keys(sections || {}).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="adm-modal-field-label" style={{ marginBottom: 8 }}>Sections</div>
          {Object.entries(sections).slice(0, 6).map(([name, value]) => (
            <div key={name} style={{ marginBottom: 8 }}>
              <strong>{name}</strong>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--adm-text-muted)', marginTop: 4 }}>
                {Array.isArray(value) ? value.slice(0, 4).join('\n') : String(value || '')}
              </div>
            </div>
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="adm-modal-field-label" style={{ marginBottom: 8 }}>Questions</div>
          {questions.slice(0, 12).map((question, index) => (
            <div key={index} style={{ padding: '10px 0', borderBottom: '1px solid var(--adm-border)' }}>
              <div style={{ fontWeight: 700 }}>{index + 1}. {repairJoinedWords(question.prompt || question.question || question.text || 'Question')}</div>
              {Array.isArray(question.options) && question.options.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                  {question.options.map(repairJoinedWords).join(' | ')}
                </div>
              )}
              {(question.answer || question.correct_answer || question.model_answer) && (
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  <strong>Answer:</strong> {repairJoinedWords(question.answer || question.correct_answer || question.model_answer)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {exercises.length > 0 && (
        <div>
          <div className="adm-modal-field-label" style={{ marginBottom: 8 }}>Lesson Exercises</div>
          {exercises.slice(0, 8).map((exercise, index) => (
            <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid var(--adm-border)' }}>
              <strong>{index + 1}. {exercise.prompt || exercise.question}</strong>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                {exercise.type || 'exercise'}{exercise.answer ? ` | Answer: ${exercise.answer}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentDetailModal({ item, onClose, onApprove, onReject }) {
  const [note, setNote]     = useState('');
  const [acting, setActing] = useState(null);
  const [msg, setMsg]       = useState('');

  const handleAction = async (action) => {
    setActing(action);
    try {
      const res = await api.admin.reviewContent(item.id, { status: action === 'approve' ? 'published' : 'rejected', adminNote: note });
      if (res?.success) {
        setMsg(action === 'approve' ? 'Approved' : 'Rejected');
        (action === 'approve' ? onApprove : onReject)?.(res.content || { ...item, status: action === 'approve' ? 'published' : 'rejected' });
      } else {
        setMsg(res?.error || 'Error');
      }
    } catch { setMsg('Error'); }
    setActing(null);
    setTimeout(() => setMsg(''), 3000);
  };

  const typeMeta = TYPE_BADGE[item.type] || 'adm-badge-gray';
  const statusMeta = STATUS_BADGE[item.status] || 'adm-badge-gray';

  return (
    <AdminModal
      title="Content Details"
      onClose={onClose}
      width={620}
      footer={
        <>
          {msg && (
            <span style={{ marginRight: 'auto', fontSize: 12, color: msg === 'Approved' ? 'var(--adm-green)' : msg === 'Rejected' ? 'var(--adm-red)' : 'var(--adm-text-muted)' }}>
              {msg}
            </span>
          )}
          <button type="button" className="adm-btn adm-btn-outline" onClick={onClose}>Close</button>
          {item.status === 'pending' && (
            <>
              <button
                type="button"
                className="adm-btn adm-btn-outline"
                style={{ borderColor: 'var(--adm-red)', color: 'var(--adm-red)' }}
                onClick={() => handleAction('reject')}
                disabled={!!acting}
              >
                <FiX size={13} /> {acting === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => handleAction('approve')}
                disabled={!!acting}
              >
                <FiCheck size={13} /> {acting === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            </>
          )}
        </>
      }
    >
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--adm-border)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--adm-text)', marginBottom: 6, lineHeight: 1.3 }}>
              {item.title || 'Untitled'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`adm-badge ${typeMeta}`}>{item.type || 'text'}</span>
              <span className={`adm-badge ${statusMeta}`}>{item.status || 'draft'}</span>
              {item.createdAt && (
                <span style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>
                  Submitted {new Date(item.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {item.thumbnailUrl && (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 'var(--adm-radius-sm)', marginTop: 10 }}
          />
        )}
      </div>

      {/* Fields */}
      <div className="adm-modal-field-grid">
        {item.description && (
          <div className="adm-modal-field" style={{ gridColumn: '1 / -1' }}>
            <div className="adm-modal-field-label">Description</div>
            <div className="adm-modal-field-value" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.description}</div>
          </div>
        )}
        {(item.course?.title || item.courseName) && (
          <div className="adm-modal-field">
            <div className="adm-modal-field-label">Course</div>
            <div className="adm-modal-field-value">{item.course?.title || item.courseName}</div>
          </div>
        )}
        {(item.contributor?.name || item.author?.name || item.uploaderName) && (
          <div className="adm-modal-field">
            <div className="adm-modal-field-label">Contributor</div>
            <div className="adm-modal-field-value">{item.contributor?.name || item.author?.name || item.uploaderName}</div>
          </div>
        )}
        {(item.contributor?.email || item.author?.email) && (
          <div className="adm-modal-field">
            <div className="adm-modal-field-label">Contributor Email</div>
            <div className="adm-modal-field-value">{item.contributor?.email || item.author?.email}</div>
          </div>
        )}
        {item.duration && (
          <div className="adm-modal-field">
            <div className="adm-modal-field-label">Duration</div>
            <div className="adm-modal-field-value">{item.duration}</div>
          </div>
        )}
        {item.views != null && (
          <div className="adm-modal-field">
            <div className="adm-modal-field-label">Views</div>
            <div className="adm-modal-field-value">{fmt(item.views)}</div>
          </div>
        )}
        {item.url && (
          <div className="adm-modal-field" style={{ gridColumn: '1 / -1' }}>
            <div className="adm-modal-field-label">Content URL</div>
            <div className="adm-modal-field-value">
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--adm-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {item.url} <FiExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
        {item.adminNote && (
          <div className="adm-modal-field" style={{ gridColumn: '1 / -1' }}>
            <div className="adm-modal-field-label">Admin Note</div>
            <div className="adm-modal-field-value">{item.adminNote}</div>
          </div>
        )}
      </div>

      <ContentPreviewBlocks item={item} />

      {/* Admin note for pending review */}
      {item.status === 'pending' && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--adm-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Review Note (optional)
          </div>
          <textarea
            style={{
              width: '100%', minHeight: 72, padding: '10px 12px', border: '1px solid var(--adm-border)',
              borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)',
              fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
            placeholder="Add a note for the contributor…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
    </AdminModal>
  );
}

function PendingReviewTab() {
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage]     = useState(1);
  const PER_PAGE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getPendingContent({ limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
      if (res?.success) { setItems(res.content || []); setTotal(res.total || 0); }
    } catch { setItems([]); }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleReviewed = (updated) => {
    setItems((prev) => prev.filter((i) => i.id !== updated.id));
    setTotal((t) => Math.max(0, t - 1));
    setSelected(null);
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <>
      {selected && (
        <ContentDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onApprove={handleReviewed}
          onReject={handleReviewed}
        />
      )}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiClock size={15} /> Pending Contributor Submissions
          </h3>
          <span className="adm-badge adm-badge-amber">{total} pending</span>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading submissions…</div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Course</th>
                    <th>Contributor</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(item)}>
                      <td style={{ maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title || '—'}
                        </div>
                      </td>
                      <td><span className={`adm-badge ${TYPE_BADGE[item.type] || 'adm-badge-gray'}`}>{item.type || 'text'}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{item.course?.title || item.courseName || '—'}</td>
                      <td style={{ fontSize: 12 }}>{item.contributor?.name || item.author?.name || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><FiCheck /></div>
                        <p>No pending submissions — you're all caught up!</p>
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

export default function ContentSection({ period }) {
  const [tab, setTab]         = useState('all');
  const [stats, setStats]     = useState(null);
  const [content, setContent] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [typeFilter, setType] = useState('all');
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState(null);
  const PER_PAGE = 10;

  useEffect(() => {
    if (tab !== 'all') return;
    setLoading(true);
    const params = { limit: PER_PAGE, offset: (page - 1) * PER_PAGE };
    if (search)               params.search = search;
    if (typeFilter !== 'all') params.type   = typeFilter;

    Promise.all([
      api.admin.getStats(period).catch(() => null),
      api.admin.getContent(params).catch(() => null),
    ]).then(([statsRes, contentRes]) => {
      if (statsRes?.success)  setStats(statsRes.stats);
      if (contentRes?.success) {
        setContent(contentRes.content || []);
        setTotal(contentRes.total || contentRes.content?.length || 0);
      }
      setLoading(false);
    });
  }, [tab, period, search, typeFilter, page]);

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <>
      {/* Tab bar */}
      <div className="adm-modal-tabs" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`adm-modal-tab${tab === 'all' ? ' is-active' : ''}`}
          onClick={() => setTab('all')}
        >
          <FiBook size={13} /> All Content
        </button>
        <button
          type="button"
          className={`adm-modal-tab${tab === 'pending' ? ' is-active' : ''}`}
          onClick={() => setTab('pending')}
        >
          <FiClock size={13} /> Pending Review
        </button>
      </div>

      {tab === 'pending' && <PendingReviewTab />}

      {tab === 'all' && (
        <>
          {selected && (
            <ContentDetailModal
              item={selected}
              onClose={() => setSelected(null)}
              onApprove={(updated) => { setContent((prev) => prev.map((c) => c.id === updated.id ? updated : c)); setSelected(updated); }}
              onReject={(updated) => { setContent((prev) => prev.map((c) => c.id === updated.id ? updated : c)); setSelected(updated); }}
            />
          )}

          {/* Overview stats */}
          <div className="adm-stats">
            {[
              { label: 'Total Content',      value: fmt(stats?.total_content),     icon: FiBook },
              { label: 'Text Lessons',       value: fmt(stats?.textLessons),       icon: FiBook,        accent: 'blue'  },
              { label: 'Video Lessons',      value: fmt(stats?.videoLessons),      icon: FiVideo,       accent: 'green' },
              { label: 'Test Items',         value: fmt(stats?.testItems),         icon: FiCheckSquare, accent: 'amber' },
              { label: 'Edutainment',        value: fmt(stats?.edutainment),       icon: FiPlay,        accent: 'red'   },
              { label: 'Resource Files',     value: fmt(stats?.resourceFiles),     icon: FiFile,        accent: 'blue'  },
              { label: 'Study Groups',       value: fmt(stats?.studyGroups),       icon: FiUsers        },
              { label: 'Communities',        value: fmt(stats?.communities),       icon: FiUsers,       accent: 'blue'  },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className={`adm-stat${accent ? ` accent-${accent}` : ''}`}>
                <div className="adm-stat-top">
                  <span className="adm-stat-label">{label}</span>
                  <span className="adm-stat-icon"><Icon /></span>
                </div>
                <div className="adm-stat-value">{value}</div>
              </div>
            ))}
          </div>

          {/* Institution + Programme breakdown */}
          <div className="adm-grid-2">
            <div className="adm-card">
              <div className="adm-card-header">
                <h3 className="adm-card-title">By Institution Category</h3>
              </div>
              <div className="adm-card-body">
                {(stats?.contentByInstitution || []).length > 0 ? (
                  stats.contentByInstitution.map((item, i) => {
                    const max = Math.max(...stats.contentByInstitution.map((d) => d.count), 1);
                    const pct = Math.round((item.count / max) * 100);
                    return (
                      <div key={item.label || i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12 }}>{item.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(item.count)}</span>
                        </div>
                        <div className="adm-progress-bar">
                          <div className="adm-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="adm-empty"><div className="adm-empty-icon">📚</div><p>No institution data yet.</p></div>
                )}
              </div>
            </div>

            <div className="adm-card">
              <div className="adm-card-header">
                <h3 className="adm-card-title">Top Programme Categories</h3>
              </div>
              <div className="adm-card-body">
                {(stats?.contentByProgramme || []).length > 0 ? (
                  stats.contentByProgramme.slice(0, 6).map((item, i) => {
                    const max = Math.max(...stats.contentByProgramme.map((d) => d.count), 1);
                    const pct = Math.round((item.count / max) * 100);
                    return (
                      <div key={item.label || i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12 }}>{item.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(item.count)}</span>
                        </div>
                        <div className="adm-progress-bar">
                          <div className="adm-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="adm-empty"><div className="adm-empty-icon">🎓</div><p>No programme data yet.</p></div>
                )}
              </div>
            </div>
          </div>

          {/* Content table */}
          <div className="adm-card">
            <div className="adm-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
              <h3 className="adm-card-title">All Content</h3>
              <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiSearch size={13} style={{ color: 'var(--adm-text-muted)' }} />
                  <input
                    className="adm-search"
                    placeholder="Search content…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <select className="adm-select" value={typeFilter} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                  <option value="all">All Types</option>
                  <option value="text">Text</option>
                  <option value="video">Video</option>
                  <option value="test">Test</option>
                  <option value="edutainment">Edutainment</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="adm-loading"><div className="adm-spinner" /> Loading content…</div>
            ) : (
              <>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Course</th>
                        <th>Contributor</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.map((item) => (
                        <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(item)}>
                          <td style={{ maxWidth: 200 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title || '—'}
                            </div>
                          </td>
                          <td>
                            <span className={`adm-badge ${TYPE_BADGE[item.type] || 'adm-badge-gray'}`}>
                              {item.type || 'text'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                            {item.course?.title || item.courseName || '—'}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {item.contributor?.name || item.author?.name || '—'}
                          </td>
                          <td>
                            <span className={`adm-badge ${STATUS_BADGE[item.status] || 'adm-badge-gray'}`}>
                              {item.status || 'draft'}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                      {content.length === 0 && (
                        <tr>
                          <td colSpan={6}>
                            <div className="adm-empty"><div className="adm-empty-icon">📖</div><p>No content found.</p></div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '14px 20px', borderTop: '1px solid var(--adm-border)' }}>
                    <button type="button" className="adm-btn adm-btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--adm-text-muted)', padding: '0 8px' }}>
                      Page {page} of {totalPages}
                    </span>
                    <button type="button" className="adm-btn adm-btn-outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
