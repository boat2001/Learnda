import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCheck, FiEdit3, FiHeart, FiMoreVertical, FiSend, FiX } from 'react-icons/fi';

// ── Config ────────────────────────────────────────────────────────────────────

export const DISCUSSION_CONFIG = {
  discussion: {
    label: 'Discussion',
    shortLabel: 'Discussion',
    boardLabel: 'Discussion',
    composeLabel: 'Post',
    replyLabel: 'Reply',
    placeholder: 'Write your message...',
    emptyTitle: 'No discussion yet',
    emptyCopy: 'Start the discussion around this lesson chunk.',
  },
  question: {
    label: 'Ask A Question',
    shortLabel: 'Question',
    boardLabel: 'Questions',
    composeLabel: 'Ask Question',
    replyLabel: 'Answer',
    placeholder: 'Ask your question...',
    emptyTitle: 'No questions yet',
    emptyCopy: 'Start the first discussion around this lesson chunk or concept.',
  },
  comment: {
    label: 'Give A Comment',
    shortLabel: 'Comment',
    boardLabel: 'Comments',
    composeLabel: 'Post Comment',
    replyLabel: 'Reply',
    placeholder: 'Write your comment...',
    emptyTitle: 'No comments yet',
    emptyCopy: 'Share a quick insight, reaction, or study note with other learners.',
  },
  error: {
    label: 'Report An Error',
    shortLabel: 'Error report',
    boardLabel: 'Error Reports',
    composeLabel: 'Send Report',
    replyLabel: 'Comment',
    placeholder: 'Report your issue...',
    emptyTitle: 'No error reports yet',
    emptyCopy: 'Flag unclear wording, content issues, or broken illustrations here.',
  },
};

export const DISCUSSION_TYPES = ['question', 'comment', 'error'];

// ── Helpers (exported) ────────────────────────────────────────────────────────

export const getUserKey = (user) => String(user?.id || user?.email || 'guest').trim();

export const saveStoredJson = (key, value) => {
  if (typeof window === 'undefined' || !key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage write failures.
  }
};

export const createEmptyDiscussionBoards = () => ({
  question: [],
  comment: [],
  error: [],
});

export const normalizeDiscussionBucket = (bucket = {}) => {
  const normalized = createEmptyDiscussionBoards();
  DISCUSSION_TYPES.forEach((type) => {
    normalized[type] = Array.isArray(bucket?.[type])
      ? bucket[type].map((entry, index) => normalizeDiscussionEntry(entry, index)).filter((entry) => entry.body)
      : [];
  });
  return normalized;
};

export const normalizeDiscussionStore = (raw, fallbackChunkId = '') => {
  if (!raw || typeof raw !== 'object') return {};

  const isLegacyStore = DISCUSSION_TYPES.some((type) => Array.isArray(raw?.[type]));
  if (isLegacyStore) {
    if (!fallbackChunkId) return {};
    return {
      [fallbackChunkId]: normalizeDiscussionBucket(raw),
    };
  }

  return Object.entries(raw).reduce((accumulator, [chunkId, bucket]) => {
    const normalizedChunkId = safeText(chunkId);
    if (!normalizedChunkId) return accumulator;
    accumulator[normalizedChunkId] = normalizeDiscussionBucket(bucket);
    return accumulator;
  }, {});
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const safeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const normalizeDiscussionReply = (reply = {}, index = 0) => ({
  id: safeText(reply.id) || `reply-${index}`,
  body: safeText(reply.body),
  authorKey: safeText(reply.authorKey),
  authorName: safeText(reply.authorName) || 'Learnda Student',
  authorAvatar: safeText(reply.authorAvatar) || null,
  createdAt: safeText(reply.createdAt) || new Date().toISOString(),
});

const normalizeDiscussionEntry = (entry = {}, index = 0) => {
  const likedBy = Array.isArray(entry.likedBy)
    ? entry.likedBy.map((item) => safeText(item)).filter(Boolean)
    : [];

  return {
    id: safeText(entry.id) || `entry-${index}`,
    body: safeText(entry.body),
    authorKey: safeText(entry.authorKey),
    authorName: safeText(entry.authorName) || 'Learnda Student',
    authorAvatar: safeText(entry.authorAvatar) || null,
    createdAt: safeText(entry.createdAt) || new Date().toISOString(),
    likes: Math.max(0, Number(entry.likes || likedBy.length || 0)),
    likedBy,
    replies: Array.isArray(entry.replies)
      ? entry.replies.map((reply, replyIndex) => normalizeDiscussionReply(reply, replyIndex)).filter((reply) => reply.body)
      : [],
  };
};

const getReplySummaryLabel = (type, count) => {
  const total = Number(count || 0);
  if (type === 'question') {
    return `${total} ${total === 1 ? 'answer' : 'answers'}`;
  }
  return `${total} ${total === 1 ? 'reply' : 'replies'}`;
};

const getDiscussionSummary = (type, entries = []) => {
  const itemCount = entries.length;
  const replyCount = entries.reduce((total, entry) => total + (entry.replies?.length || 0), 0);

  if (type === 'discussion') {
    const questionCount = entries.filter((entry) => entry.discussionType === 'question').length;
    const commentCount = entries.filter((entry) => entry.discussionType !== 'question').length;
    return `${itemCount} messages • ${questionCount} ${questionCount === 1 ? 'question' : 'questions'} • ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`;
  }

  if (type === 'question') {
    return `${itemCount} ${itemCount === 1 ? 'question' : 'questions'} • ${replyCount} ${replyCount === 1 ? 'answer' : 'answers'}`;
  }

  if (type === 'error') {
    return `${itemCount} ${itemCount === 1 ? 'reported error' : 'reported errors'} • ${replyCount} ${replyCount === 1 ? 'fix' : 'fixes'}`;
  }

  return `${itemCount} ${itemCount === 1 ? 'comment' : 'comments'} • ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiscussionPanel({
  type,
  entries,
  draft,
  composerType,
  replyDrafts,
  activeReplyTarget,
  theme,
  currentUserKey,
  onClose,
  onDraftChange,
  onComposerTypeChange,
  onReplyDraftChange,
  onSubmit,
  onReply,
  onOpenReply,
  onCloseReply,
  onToggleLike,
  onEditEntry,
  onEditReply,
}) {
  if (!type) return null;

  const config = DISCUSSION_CONFIG[type];
  const discussionSummary = getDiscussionSummary(type, entries);
  const isCombinedDiscussion = type === 'discussion';
  const activeReplyFormRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const [ownerMenuTarget, setOwnerMenuTarget] = useState('');
  const [editingTarget, setEditingTarget] = useState('');
  const [editingDraft, setEditingDraft] = useState('');

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const parseTargetKey = useCallback((targetKey) => {
    const [kind = '', boardType = '', entryId = '', replyId = ''] = String(targetKey || '').split(':');
    return { kind, boardType, entryId, replyId };
  }, []);

  const beginEditingTarget = useCallback((targetKey, currentBody) => {
    setOwnerMenuTarget('');
    setEditingTarget(targetKey);
    setEditingDraft(currentBody);
  }, []);

  const cancelEditingTarget = useCallback(() => {
    setEditingTarget('');
    setEditingDraft('');
  }, []);

  const submitEditingTarget = useCallback((event) => {
    event.preventDefault();
    const nextBody = safeText(editingDraft);
    if (!nextBody || !editingTarget) return;

    const { kind, boardType, entryId, replyId } = parseTargetKey(editingTarget);
    if (kind === 'entry' && entryId) {
      onEditEntry(entryId, nextBody, boardType || type);
    }
    if (kind === 'reply' && entryId && replyId) {
      onEditReply(entryId, replyId, nextBody, boardType || type);
    }
    setEditingTarget('');
    setEditingDraft('');
  }, [editingDraft, editingTarget, onEditEntry, onEditReply, parseTargetKey]);

  const handleOwnerLongPressStart = useCallback((event, targetKey) => {
    if (event.pointerType === 'mouse') return;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      setOwnerMenuTarget(targetKey);
    }, 420);
  }, [clearLongPress]);

  useEffect(() => {
    if (!activeReplyTarget) return undefined;

    const handlePointerDown = (event) => {
      if (!activeReplyFormRef.current?.contains(event.target)) {
        onCloseReply();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeReplyTarget, onCloseReply]);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  return (
    <div className={`lesson-shell theme-${theme} lesson-discussion-overlay lesson-thread-overlay`} onClick={onClose}>
      <div
        className="lesson-discussion-modal lesson-thread-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-discussion-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lesson-thread-panel-shell">
          <div className="lesson-discussion-topbar">
            <div className="lesson-discussion-header">
              <h3 id="lesson-discussion-title">{config.boardLabel}</h3>
              <p className="lesson-discussion-summary">{discussionSummary}</p>
            </div>

            <button type="button" className="lesson-discussion-close" onClick={onClose} aria-label="Close lesson discussion">
              <FiX />
            </button>
          </div>

          <div
            className="lesson-discussion-list"
            onClick={(event) => {
              if (!event.target.closest('.lesson-owner-tools')) {
                setOwnerMenuTarget('');
              }
            }}
          >
            {entries.length === 0 ? (
              <div className="lesson-discussion-empty">
                <h4>{config.emptyTitle}</h4>
                <p>{config.emptyCopy}</p>
              </div>
            ) : (
              entries.map((entry) => {
                const entryBoardType = entry.discussionType || type;
                const isLiked = currentUserKey && entry.likedBy?.includes(currentUserKey);
                const isOwnEntry = currentUserKey && entry.authorKey === currentUserKey;
                const entryTargetKey = `entry:${entryBoardType}:${entry.id}`;
                const isEntryMenuOpen = ownerMenuTarget === entryTargetKey;
                const isEntryEditing = editingTarget === entryTargetKey;
                const entryReplyTarget = `${entryBoardType}:${entry.id}`;

                return (
                  <article
                    key={entry.id}
                    className={`lesson-thread-card ${isOwnEntry ? 'is-own' : ''} ${isEntryMenuOpen ? 'has-owner-menu-open' : ''}`}
                    onPointerDown={isOwnEntry ? (event) => handleOwnerLongPressStart(event, entryTargetKey) : undefined}
                    onPointerUp={isOwnEntry ? clearLongPress : undefined}
                    onPointerLeave={isOwnEntry ? clearLongPress : undefined}
                    onPointerCancel={isOwnEntry ? clearLongPress : undefined}
                  >
                    <div className="lesson-thread-head">
                      <div className="lesson-thread-avatar">
                        {entry.authorAvatar ? (
                          <img src={entry.authorAvatar} alt={entry.authorName} />
                        ) : (
                          <span>{entry.authorName?.charAt(0) || 'S'}</span>
                        )}
                      </div>
                      <div className="lesson-thread-meta">
                        <strong>{entry.authorName}</strong>
                        <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                        {isCombinedDiscussion ? (
                          <span className={`lesson-thread-type-tag is-${entryBoardType}`}>
                            {entryBoardType === 'question' ? 'Question' : 'Comment'}
                          </span>
                        ) : null}
                      </div>
                      {isOwnEntry && (
                        <div className={`lesson-owner-tools ${isEntryMenuOpen ? 'is-open' : ''}`}>
                          <button
                            type="button"
                            className="lesson-owner-toggle"
                            aria-label="Open message actions"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOwnerMenuTarget((current) => (current === entryTargetKey ? '' : entryTargetKey));
                            }}
                          >
                            <FiMoreVertical />
                          </button>
                          {isEntryMenuOpen && (
                            <div className="lesson-owner-menu">
                              <button
                                type="button"
                                onClick={() => beginEditingTarget(entryTargetKey, entry.body)}
                              >
                                <FiEdit3 />
                                <span>Edit</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isEntryEditing ? (
                      <form className="lesson-inline-edit-form" onSubmit={submitEditingTarget}>
                        <input
                          type="text"
                          value={editingDraft}
                          onChange={(event) => setEditingDraft(event.target.value)}
                          autoFocus
                        />
                        <div className="lesson-inline-edit-actions">
                          <button type="submit" aria-label="Save message">
                            <FiCheck />
                          </button>
                          <button type="button" aria-label="Cancel editing" onClick={cancelEditingTarget}>
                            <FiX />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p className="lesson-thread-body">{entry.body}</p>
                    )}

                    <div className="lesson-thread-actions">
                      <button
                        type="button"
                        className={`lesson-thread-like ${isLiked ? 'is-active' : ''}`}
                        onClick={() => onToggleLike(entry.id, entryBoardType)}
                        aria-pressed={isLiked ? 'true' : 'false'}
                      >
                        <FiHeart />
                        <span>{entry.likes || 0}</span>
                      </button>
                      <button type="button" onClick={() => onOpenReply(entry.id, entryBoardType)}>
                        {config.replyLabel}
                      </button>
                      <span>{getReplySummaryLabel(entryBoardType, entry.replies?.length || 0)}</span>
                    </div>

                    {entry.replies?.length > 0 && (
                      <div className="lesson-replies">
                        {entry.replies.map((reply) => {
                          const isOwnReply = currentUserKey && reply.authorKey === currentUserKey;
                          const replyTargetKey = `reply:${entryBoardType}:${entry.id}:${reply.id}`;
                          const isReplyMenuOpen = ownerMenuTarget === replyTargetKey;
                          const isReplyEditing = editingTarget === replyTargetKey; /*
                            ? `${entry.body.slice(0, 72).trim()}…`
                            : entry.body;

                          */
                          return (
                            <div
                              key={reply.id}
                              className={`lesson-reply-card ${isOwnReply ? 'is-own' : ''} ${isReplyMenuOpen ? 'has-owner-menu-open' : ''}`}
                              onPointerDown={isOwnReply ? (event) => handleOwnerLongPressStart(event, replyTargetKey) : undefined}
                              onPointerUp={isOwnReply ? clearLongPress : undefined}
                              onPointerLeave={isOwnReply ? clearLongPress : undefined}
                              onPointerCancel={isOwnReply ? clearLongPress : undefined}
                            >
                              <div className="lesson-reply-head">
                                <div className="lesson-reply-meta">
                                  <strong>{reply.authorName}</strong>
                                  <span>{new Date(reply.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                </div>
                                {isOwnReply && (
                                  <div className={`lesson-owner-tools ${isReplyMenuOpen ? 'is-open' : ''}`}>
                                    <button
                                      type="button"
                                      className="lesson-owner-toggle"
                                      aria-label="Open reply actions"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOwnerMenuTarget((current) => (current === replyTargetKey ? '' : replyTargetKey));
                                      }}
                                    >
                                      <FiMoreVertical />
                                    </button>
                                    {isReplyMenuOpen && (
                                      <div className="lesson-owner-menu">
                                        <button
                                          type="button"
                                          onClick={() => beginEditingTarget(replyTargetKey, reply.body)}
                                        >
                                          <FiEdit3 />
                                          <span>Edit</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {isReplyEditing ? (
                                <form className="lesson-inline-edit-form is-reply" onSubmit={submitEditingTarget}>
                                  <input
                                    type="text"
                                    value={editingDraft}
                                    onChange={(event) => setEditingDraft(event.target.value)}
                                    autoFocus
                                  />
                                  <div className="lesson-inline-edit-actions">
                                    <button type="submit" aria-label="Save reply">
                                      <FiCheck />
                                    </button>
                                    <button type="button" aria-label="Cancel editing" onClick={cancelEditingTarget}>
                                      <FiX />
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <p>{reply.body}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {activeReplyTarget === entryReplyTarget && (
                      <form
                        ref={activeReplyFormRef}
                        className="lesson-reply-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          onReply(entry.id, entryBoardType);
                        }}
                      >
                        <input
                          value={replyDrafts[entry.id] || ''}
                          onChange={(event) => onReplyDraftChange(entry.id, event.target.value)}
                          placeholder="Reply..."
                        />
                        <button type="submit" aria-label={config.replyLabel}>
                          <FiSend />
                        </button>
                      </form>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <form className="lesson-discussion-composer lesson-discussion-composer-bottom" onSubmit={onSubmit}>
            <div className="lesson-discussion-composer-copy">
              <span>Add your own</span>
              <strong>{config.shortLabel}</strong>
            </div>
            {isCombinedDiscussion ? (
              <div className="lesson-discussion-type-switch" role="radiogroup" aria-label="Tag this message">
                <button
                  type="button"
                  role="radio"
                  aria-checked={composerType === 'comment'}
                  className={composerType === 'comment' ? 'is-active' : ''}
                  onClick={() => onComposerTypeChange('comment')}
                >
                  Comment
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={composerType === 'question'}
                  className={composerType === 'question' ? 'is-active' : ''}
                  onClick={() => onComposerTypeChange('question')}
                >
                  Question
                </button>
              </div>
            ) : null}
            <input
              type="text"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={config.placeholder}
            />
            <button type="submit" className="lesson-discussion-submit" aria-label={config.composeLabel}>
              <FiSend />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
