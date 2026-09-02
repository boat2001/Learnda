import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiBookmark,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiCornerDownRight,
  FiFileText,
  FiHeart,
  FiInfo,
  FiMessageCircle,
  FiMoon,
  FiPenTool,
  FiPlayCircle,
  FiSend,
  FiShare2,
  FiSmile,
  FiSun,
  FiThumbsUp,
  FiX,
} from 'react-icons/fi';
import { FaBookmark, FaComment, FaQuoteLeft, FaThumbsUp } from 'react-icons/fa6';
import api from '../../services/api';
import { sanitizeLessonHtml } from '../../utils/sanitizeHtml';
import {
  getStoredThemePreference,
  resolveThemePreference,
  saveThemePreference,
} from '../../utils/theme';
import {
  EDUTAINMENT_TYPE_META,
  formatCommentDate,
  getContentBody,
  toDisplayNameCase,
} from './homeUtils';
import './EdutainmentModal.css';

const SWIPE_THRESHOLD = 52;
const SWIPE_VELOCITY = 0.32;
const TRACK_VIEW_MS = 1200;
const CONSUMED_MS = 1500;
const RELATED_COUNT = 3;

const TYPE_ICONS = {
  quote: FaQuoteLeft,
  fact: FiInfo,
  joke: FiSmile,
  article: FiFileText,
  story: FiPlayCircle,
};

const decodeEntities = (value = '') => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const stripHtml = (value = '') => decodeEntities(value).replace(/<[^>]*>/g, ' ');
const cleanText = (value = '') => stripHtml(value).replace(/\s+/g, ' ').trim();

const isSameText = (a = '', b = '') => {
  const left = cleanText(a).toLowerCase();
  const right = cleanText(b).toLowerCase();
  return Boolean(left && right && left === right);
};

const dedupeItems = (items) => {
  const seen = new Set();
  return (items || []).filter((item) => {
    const id = String(
      item?.contentId || item?.id || item?.stateKey || item?.key ||
      `${item?.title || ''}|${item?.body || item?.preview || ''}`
    );
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const resolveMomentImage = (item) =>
  item?.imageUrl || item?.image_url || item?.coverImage || item?.cover_image ||
  item?.image || item?.thumbnailUrl || item?.thumbnail_url || item?.thumbnail ||
  item?.media?.url || item?.mediaUrl || '';

const hasAnyMomentItems = (itemsByType) =>
  Object.values(itemsByType || {}).some((list) => Array.isArray(list) && list.length > 0);

// ── Reaction sounds (Web Audio API, no files needed) ──────────────────────────
let _audioCtx = null;
const getAudioCtx = () => {
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      _audioCtx = new Ctor();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  } catch { return null; }
};

const playReactionSound = (type) => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;

    const tone = (freq, offset, dur, vol = 0.25, shape = 'sine') => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = shape;
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(ctx.destination);
      const s = t + offset;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(vol, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      osc.start(s);
      osc.stop(s + dur + 0.02);
    };

    const sweep = (f0, f1, offset, dur, vol = 0.18) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t + offset);
      osc.frequency.exponentialRampToValueAtTime(f1, t + offset + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      const s = t + offset;
      g.gain.setValueAtTime(vol, s);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      osc.start(s);
      osc.stop(s + dur + 0.02);
    };

    if (type === 'like') {
      // Upbeat double-ding C5 → E5 — celebratory
      tone(523, 0,    0.18, 0.28);
      tone(659, 0.1,  0.2,  0.28);
    } else if (type === 'comment') {
      // Friendly bubble pop — descending sine
      sweep(880, 420, 0, 0.14, 0.22);
    } else if (type === 'save') {
      // Satisfying ascending triad — A4 → C#5 → E5
      tone(440, 0,    0.18, 0.2);
      tone(554, 0.07, 0.16, 0.18);
      tone(659, 0.14, 0.18, 0.22);
    } else if (type === 'share') {
      // Rising whoosh + sparkle ping
      sweep(280, 1100, 0,    0.18, 0.16);
      tone(1047,       0.15, 0.18, 0.22);
    }
  } catch { /* audio blocked or unsupported */ }
};

// Rewrite legacy PHP-era asset paths, strip AOS attributes, and wrap bare text paragraphs in <p> tags.
const rewriteArticleHtml = (html) => {
  const rewritten = String(html || '')
    .replace(/src="\.\.\/assets\/images\/(?:blogs|otherfiles)\/([^"]+)"/g, 'src="/articles/$1"')
    .replace(/\s+data-aos="[^"]*"/g, '');
  return rewritten
    .split(/\n{2,}/)
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return '';
      if (/^</.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .filter(Boolean)
    .join('');
};

const buildDisplayContent = (item, type, expanded) => {
  if (!item) {
    return { title: '', body: '', teaser: '', hasMore: false, hasHtml: false, html: '' };
  }
  const rawBody = getContentBody(item, '') || item.body || item.content || '';
  const rawPreview = item.preview || item.description || '';
  const rawTitle = item.title || '';
  const bodyText = cleanText(rawBody || rawPreview || rawTitle);
  const titleText = cleanText(rawTitle);
  const previewText = cleanText(rawPreview);
  const bodyHasHtml = /<\/?[a-z][\s\S]*>/i.test(String(rawBody || ''));

  if (type === 'quote') {
    const quoteText = isSameText(titleText, 'Sharether Quote') ? bodyText : (bodyText || titleText || previewText);
    return { title: '', body: quoteText, teaser: quoteText, hasMore: false, hasHtml: false, html: '' };
  }
  if (type === 'fact' || type === 'joke') {
    const body = bodyText || previewText || titleText;
    const title = titleText && !isSameText(titleText, body) ? titleText : '';
    return { title, body, teaser: body, hasMore: false, hasHtml: false, html: '' };
  }
  const title = titleText || previewText || bodyText;
  const body = bodyText || previewText || titleText;
  return {
    title,
    body,
    teaser: body,
    hasHtml: bodyHasHtml,
    html: expanded && bodyHasHtml ? sanitizeLessonHtml(rewriteArticleHtml(rawBody)) : '',
  };
};

export default function MomentsViewer({
  open,
  initialType,
  initialItemId,
  itemsByType,
  onClose,
  onMarkConsumed,
  currentUser,
}) {
  const activeType = initialType || 'article';

  // ── State ─────────────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentOverflows, setContentOverflows] = useState(false);
  const [interactionsByContent, setInteractionsByContent] = useState({});
  const [commentsByContent, setCommentsByContent] = useState({});
  const [commentDraft, setCommentDraft] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [emojiBurst, setEmojiBurst] = useState({ emoji: '', nonce: 0 });
  const [feedback, setFeedback] = useState('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [transitionClass, setTransitionClass] = useState('');
  const [sessionItemsByType, setSessionItemsByType] = useState(null);
  const [theme, setTheme] = useState(() => resolveThemePreference(getStoredThemePreference()));

  // ── Refs ──────────────────────────────────────────────────────────────────
  const touchRef = useRef(null);
  const proseRef = useRef(null);
  const commentInputRef = useRef(null);
  const stageRef = useRef(null);
  const consumedRef = useRef(null);
  const trackViewRef = useRef(null);
  const openKeyRef = useRef('');
  const initialIndexKeyRef = useRef('');

  // ── Open / reset ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      openKeyRef.current = '';
      initialIndexKeyRef.current = '';
      setSessionItemsByType(null);
      return;
    }
    const key = `${activeType}|${initialItemId}`;
    if (openKeyRef.current === key) return;
    openKeyRef.current = key;
    initialIndexKeyRef.current = '';
    setCurrentIndex(0);
    setIsExpanded(false);
    setShowComments(false);
    setReplyingTo(null);
    setCommentDraft('');
    setFeedback('');
    setTransitionClass('');
    setDragOffset({ x: 0, y: 0 });
    setSessionItemsByType(hasAnyMomentItems(itemsByType) ? itemsByType : null);
  }, [open, activeType, initialItemId, itemsByType]);

  useEffect(() => {
    if (!open || sessionItemsByType) return;
    if (hasAnyMomentItems(itemsByType)) setSessionItemsByType(itemsByType);
  }, [open, itemsByType, sessionItemsByType]);

  // Locate initial item index when items load.
  useEffect(() => {
    if (!open || !initialItemId) return;
    const key = `${openKeyRef.current}|${activeType}|${initialItemId}`;
    if (initialIndexKeyRef.current === key) return;
    const raw = (sessionItemsByType || itemsByType)?.[activeType] || [];
    const idx = raw.findIndex((item) =>
      String(item?.contentId || item?.id || '') === String(initialItemId)
    );
    if (idx >= 0) {
      initialIndexKeyRef.current = key;
      setCurrentIndex(idx);
    }
  }, [open, activeType, initialItemId, itemsByType, sessionItemsByType]);

  // History / back-gesture wiring (Android back button closes the viewer).
  useEffect(() => {
    if (!open) return undefined;
    const onPop = () => onClose?.();
    try { window.history.pushState({ momentsViewer: true }, ''); } catch { /* noop */ }
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Do NOT call history.back() here. Doing so fires a popstate that React
      // Router intercepts as a POP navigation, which can scroll-restore the page
      // while the body overflow is still transitioning, leaving the page stuck.
    };
  }, [open, onClose]);

  // ── Derived items ─────────────────────────────────────────────────────────
  const items = useMemo(
    () => dedupeItems((sessionItemsByType || itemsByType)?.[activeType] || []),
    [itemsByType, sessionItemsByType, activeType]
  );
  const safeIndex = Math.min(currentIndex, Math.max(items.length - 1, 0));
  const currentItem = items[safeIndex] || null;
  const currentImageUrl = useMemo(() => resolveMomentImage(currentItem), [currentItem]);
  const currentContentId = currentItem?.contentId || currentItem?.id || null;
  const interaction = currentContentId ? interactionsByContent[currentContentId] : null;
  const liked = Boolean(interaction?.liked);
  const saved = Boolean(interaction?.saved);
  const shared = Boolean(interaction?.shared);
  const comments = useMemo(
    () => (currentContentId ? commentsByContent[currentContentId] || [] : []),
    [commentsByContent, currentContentId]
  );
  const meta = EDUTAINMENT_TYPE_META[activeType] || {};
  const isLongForm = activeType === 'article' || activeType === 'story';
  const displayContent = useMemo(
    () => buildDisplayContent(currentItem, activeType, isExpanded),
    [currentItem, activeType, isExpanded]
  );
  const likeCount = interaction?.like_count ?? interaction?.likes ?? currentItem?.reactions?.likes ?? currentItem?.stats?.like_count ?? 0;
  const commentCount = comments.length || currentItem?.reactions?.comments || 0;
  const shareCount = interaction?.share_count ?? currentItem?.reactions?.shares ?? currentItem?.stats?.share_count ?? 0;

  // Related items: other items from the same type, exclude current.
  const relatedItems = useMemo(
    () => items.filter((_, i) => i !== safeIndex).slice(0, RELATED_COUNT),
    [items, safeIndex]
  );

  // ── Overflow detection: show "Read more" only when text is visually clipped ──
  useEffect(() => {
    const el = proseRef.current;
    if (!el || isExpanded) { setContentOverflows(false); return; }
    let rafId;
    const check = () => {
      const parent = el.parentElement;
      if (!parent) return;
      setContentOverflows(el.scrollHeight > parent.clientHeight + 4);
    };
    // rAF ensures layout has settled after CSS constraints are applied
    rafId = requestAnimationFrame(check);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el.parentElement || el);
    return () => { cancelAnimationFrame(rafId); ro?.disconnect(); };
  }, [displayContent.body, isExpanded]);

  // ── Per-item side effects ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !currentItem) return undefined;
    setIsExpanded(false);
    setContentOverflows(false);
    setShowComments(false);
    setReplyingTo(null);
    if (stageRef.current) stageRef.current.scrollTop = 0;
    clearTimeout(consumedRef.current);
    clearTimeout(trackViewRef.current);
    consumedRef.current = setTimeout(() => onMarkConsumed?.(currentItem), CONSUMED_MS);
    if (!currentContentId) return () => { clearTimeout(consumedRef.current); clearTimeout(trackViewRef.current); };
    trackViewRef.current = setTimeout(() => {
      api.content.trackView(currentContentId, 0, 0).catch(() => null);
    }, TRACK_VIEW_MS);
    let active = true;
    Promise.all([
      api.content.getInteractions(currentContentId).catch(() => null),
      api.content.getComments(currentContentId).catch(() => null),
    ]).then(([ints, commentsResp]) => {
      if (!active) return;
      if (ints?.success !== false) setInteractionsByContent((p) => ({ ...p, [currentContentId]: ints }));
      if (commentsResp?.comments) setCommentsByContent((p) => ({ ...p, [currentContentId]: commentsResp.comments }));
    });
    return () => { active = false; clearTimeout(consumedRef.current); clearTimeout(trackViewRef.current); };
  }, [open, currentContentId, currentItem, onMarkConsumed]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleClose = () => onClose?.();

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    saveThemePreference(next);
    setTheme(next);
  };

  const goHorizontal = (dir) => {
    const next = Math.max(0, Math.min(items.length - 1, safeIndex + dir));
    if (next === safeIndex) return;
    setTransitionClass(dir > 0 ? 'slide-from-right' : 'slide-from-left');
    setCurrentIndex(next);
  };

  const goToItem = (item) => {
    const idx = items.findIndex((i) =>
      String(i?.contentId || i?.id) === String(item?.contentId || item?.id)
    );
    if (idx < 0) return;
    setTransitionClass('fade-in');
    setCurrentIndex(idx);
    setIsExpanded(false);
    if (stageRef.current) stageRef.current.scrollTop = 0;
  };

  // ── Action handlers ───────────────────────────────────────────────────────
  const triggerBurst = (emoji) => setEmojiBurst({ emoji, nonce: Date.now() });
  const showFeedback = (msg, ms = 1600) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), ms);
  };

  const handleLike = async () => {
    triggerBurst('👍');
    playReactionSound('like');
    if (!currentContentId) return;
    setInteractionsByContent((p) => {
      const cur = p[currentContentId] || {};
      const wasLiked = Boolean(cur.liked);
      const baseCount = cur.like_count ?? currentItem?.reactions?.likes ?? currentItem?.stats?.like_count ?? 0;
      return {
        ...p,
        [currentContentId]: {
          ...cur,
          liked: !wasLiked,
          like_count: wasLiked ? Math.max(0, baseCount - 1) : baseCount + 1,
        },
      };
    });
    try { await api.content.like(currentContentId); } catch { /* optimistic */ }
  };

  const handleSave = async () => {
    if (!currentContentId) return;
    playReactionSound('save');
    const next = !saved;
    setInteractionsByContent((p) => {
      const cur = p[currentContentId] || {};
      return { ...p, [currentContentId]: { ...cur, saved: next } };
    });
    showFeedback(next ? 'Saved to your library' : 'Removed from library');
    try { await api.content.save(currentContentId); } catch { /* optimistic */ }
  };

  const handleShare = async () => {
    if (!currentContentId) { showFeedback('Nothing to share yet'); return; }
    triggerBurst('🔗');
    playReactionSound('share');
    const url = `${window.location.origin}/`;
    try {
      if (navigator.share) {
        await navigator.share({ title: currentItem?.title || 'Sharether', url }).catch(() => null);
        showFeedback('Shared!');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showFeedback('Link copied');
      } else {
        showFeedback('Sharing not supported');
      }
      setInteractionsByContent((p) => {
        const cur = p[currentContentId] || {};
        const baseShares = cur.share_count ?? currentItem?.reactions?.shares ?? currentItem?.stats?.share_count ?? 0;
        return { ...p, [currentContentId]: { ...cur, shared: true, share_count: baseShares + 1 } };
      });
      await api.content.share(currentContentId).catch(() => null);
    } catch { /* ignore */ }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const text = commentDraft.trim();
    if (!text || !currentContentId) return;
    setSubmittingComment(true);
    const optimistic = {
      id: `local-${Date.now()}`,
      content: text,
      author_id: currentUser?.id || null,
      author_name: currentUser?.full_name || 'You',
      author_avatar: currentUser?.avatar_url || null,
      created_at: new Date().toISOString(),
      likes: 0,
      reply_to: replyingTo?.id || null,
      reply_to_author: replyingTo?.author_name || null,
      pending: true,
    };
    setCommentsByContent((p) => ({ ...p, [currentContentId]: [optimistic, ...(p[currentContentId] || [])] }));
    setCommentDraft('');
    setReplyingTo(null);
    playReactionSound('comment');
    try {
      await api.content.addComment(currentContentId, text);
      setCommentsByContent((p) => ({
        ...p,
        [currentContentId]: (p[currentContentId] || []).map((c) =>
          c.id === optimistic.id ? { ...c, pending: false } : c
        ),
      }));
    } catch { /* keep pending */ } finally { setSubmittingComment(false); }
  };

  const handleReply = (comment) => {
    setReplyingTo({
      id: comment.id,
      author_name: comment.author_name,
      content: (comment.content || comment.body || '').slice(0, 80),
    });
    setShowComments(true);
    setTimeout(() => commentInputRef.current?.focus(), 60);
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'Escape') { e.preventDefault(); showComments ? setShowComments(false) : handleClose(); return; }
      if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); goHorizontal(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'h') { e.preventDefault(); goHorizontal(-1); }
      else if (e.key === 'c') { e.preventDefault(); setShowComments((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showComments, items.length, safeIndex]);

  // ── Touch (horizontal nav — no conflict with vertical article scroll) ────────
  const onTouchStart = (e) => {
    if (showComments) return;
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const onTouchMove = (e) => {
    const start = touchRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical — let native scroll handle
    e.preventDefault();
    setDragOffset({ x: dx * 0.45, y: 0 });
  };

  const onTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    setDragOffset({ x: 0, y: 0 });
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical — ignore
    const elapsed = Math.max(1, Date.now() - start.time);
    const fast = Math.abs(dx) / elapsed > SWIPE_VELOCITY;
    if (Math.abs(dx) > SWIPE_THRESHOLD || fast) {
      goHorizontal(dx < 0 ? 1 : -1);
    }
  };

  const onWheel = (e) => {
    if (showComments) return;
    if (Math.abs(e.deltaX) < 20) return;
    goHorizontal(e.deltaX > 0 ? 1 : -1);
  };

  const dragStyle = dragOffset.x
    ? { transform: `translate3d(${dragOffset.x}px,0,0)`, transition: 'none' }
    : undefined;

  // ── Render ────────────────────────────────────────────────────────────────
  if (!open) return null;

  const TypeIcon = TYPE_ICONS[activeType] ?? null;
  const typeLabel = `${meta.plural || meta.label || activeType} for today`;

  return (
    <div className="edut-overlay" onClick={handleClose} aria-hidden="true">
    <div
      className={`edut-viewer edut-viewer--${activeType}`}
      role="dialog"
      aria-modal="true"
      aria-label={typeLabel}
      onWheel={onWheel}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="edut-header">
        <div className="edut-header-brand">
          <img
            src={`${import.meta.env.BASE_URL}sharether-logo.webp`}
            alt="Sharether"
            className="edut-header-logo"
          />
        </div>
        <div className="edut-header-title-block">
          <span className="edut-header-glyph" aria-hidden="true">
            {TypeIcon ? <TypeIcon /> : meta.glyph}
          </span>
          <span className="edut-header-title">{typeLabel}</span>
        </div>

        <div className="edut-header-meta">
          {items.length > 1 ? (
            <span className="edut-header-counter">{safeIndex + 1} / {items.length}</span>
          ) : null}
          <button
            type="button"
            className="edut-header-btn"
            onClick={handleThemeToggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
          </button>
        </div>

        <div className="edut-header-close-wrap">
          <button type="button" className="edut-header-btn edut-close" onClick={handleClose} aria-label="Close viewer">
            <FiX />
          </button>
        </div>
      </header>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      {items.length > 1 ? (
        <div className="edut-progress" aria-hidden="true">
          {items.map((_, i) => (
            <span
              key={i}
              className={`edut-progress-seg${i < safeIndex ? ' is-done' : ''}${i === safeIndex ? ' is-current' : ''}`}
            />
          ))}
        </div>
      ) : null}

      {/* ── Stage ───────────────────────────────────────────────────────── */}
      <div
        className={`edut-stage${isLongForm && isExpanded ? ' is-scrollable' : ''}`}
        ref={stageRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {!currentItem ? (
          <div className="edut-empty">
            <span aria-hidden="true">{meta.glyph || '✦'}</span>
            <p>Nothing here yet.</p>
          </div>
        ) : (
          <article
            key={`${activeType}-${safeIndex}`}
            className={[
              'edut-article',
              isLongForm ? 'is-long' : 'is-short',
              isLongForm && isExpanded ? 'is-expanded' : '',
              transitionClass,
            ].filter(Boolean).join(' ')}
            style={dragStyle}
            onAnimationEnd={() => setTransitionClass('')}
          >
            {isLongForm ? (
              /* ── Article / Story ─────────────────────────────────────── */
              <>
                {displayContent.title ? (
                  <h1 className="edut-lf-title">{displayContent.title}</h1>
                ) : null}
                {/* Hero image above prose only in collapsed state */}
                {currentImageUrl && !isExpanded ? (
                  <div className="edut-lf-image">
                    <img src={currentImageUrl} alt={displayContent.title || meta.label} loading="eager" decoding="async" />
                  </div>
                ) : null}
                <div className={`edut-prose-wrap${!isExpanded ? ' is-clipped' : ''}`}>
                  {/* Hero image moves inside the scroll area when expanded so it can't be lost */}
                  {isExpanded && currentImageUrl ? (
                    <div className="edut-lf-image edut-lf-image--prose">
                      <img src={currentImageUrl} alt={displayContent.title || meta.label} loading="eager" decoding="async" />
                    </div>
                  ) : null}
                  {displayContent.hasHtml && isExpanded ? (
                    <div
                      className="edut-prose edut-prose-html"
                      dangerouslySetInnerHTML={{ __html: displayContent.html }}
                    />
                  ) : (
                    <p className="edut-prose" ref={proseRef}>{displayContent.body}</p>
                  )}
                  {!isExpanded && contentOverflows ? (
                    <div className="edut-prose-fade">
                      <button
                        type="button"
                        className="edut-read-more"
                        onClick={() => {
                          setIsExpanded(true);
                          requestAnimationFrame(() => {
                            if (stageRef.current) stageRef.current.scrollTop = 0;
                          });
                        }}
                      >
                        Read more <FiChevronDown aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                  {isExpanded ? (
                    <button
                      type="button"
                      className="edut-read-more"
                      onClick={() => {
                        setIsExpanded(false);
                        if (stageRef.current) stageRef.current.scrollTop = 0;
                      }}
                    >
                      Show less <FiChevronUp aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {/* ── Author byline (shown after expanding) ─────────── */}
                {isExpanded && currentItem?.author ? (
                  <div className="edut-author-card">
                    <div className="edut-author-avatar" aria-hidden="true">
                      {currentItem.author.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="edut-author-info">
                      <span className="edut-author-card__label">Written by</span>
                      <span className="edut-author-card__name">{currentItem.author}</span>
                    </div>
                    <FiPenTool className="edut-author-card__deco" aria-hidden="true" />
                  </div>
                ) : null}

                {/* ── Related content (shown after expanding) ───────── */}
                {isExpanded && relatedItems.length > 0 ? (
                  <div className="edut-related">
                    <p className="edut-related-heading">More to read</p>
                    <div className="edut-related-list">
                      {relatedItems.map((item) => {
                        const img = resolveMomentImage(item);
                        const title = item.title || item.preview || cleanText(item.body || '');
                        return (
                          <button
                            key={item.contentId || item.id}
                            type="button"
                            className="edut-related-card"
                            onClick={() => goToItem(item)}
                          >
                            {img ? (
                              <div className="edut-related-img">
                                <img src={img} alt="" loading="lazy" />
                              </div>
                            ) : (
                              <div className="edut-related-img edut-related-img--placeholder">
                                <span aria-hidden="true">{meta.glyph}</span>
                              </div>
                            )}
                            <p className="edut-related-title">{title}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              /* ── Quote / Fact / Joke ─────────────────────────────────── */
              <div className="edut-sf-inner">
                <div className="edut-sf-glyph" aria-hidden="true">
                  {TypeIcon ? <TypeIcon /> : meta.glyph}
                </div>
                <span className="edut-label">{meta.label}</span>
                {displayContent.title && activeType !== 'quote' ? (
                  <h2 className="edut-sf-title">{displayContent.title}</h2>
                ) : null}
                <p className={`edut-prose edut-prose--${activeType}`}>{displayContent.body}</p>
                {currentItem.author && activeType === 'quote' && !isSameText(currentItem.author, displayContent.body) ? (
                  <p className="edut-author">— {currentItem.author}</p>
                ) : null}
              </div>
            )}
          </article>
        )}
      </div>


      {/* ── Bottom action bar ────────────────────────────────────────────── */}
      {currentItem ? (
        <div className="edut-action-bar" role="toolbar" aria-label="Content actions">
          <button
            type="button"
            className={`edut-action-btn${liked ? ' is-active' : ''}`}
            onClick={handleLike}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            {liked ? <FaThumbsUp aria-hidden="true" /> : <FiThumbsUp aria-hidden="true" />}
            <span className="edut-action-count">{likeCount || 0}</span>
          </button>

          <button
            type="button"
            className={`edut-action-btn${commentCount > 0 || showComments ? ' is-active' : ''}`}
            onClick={() => setShowComments((v) => !v)}
            aria-pressed={showComments}
            aria-label="Comments"
          >
            {commentCount > 0 || showComments ? <FaComment aria-hidden="true" /> : <FiMessageCircle aria-hidden="true" />}
            <span className="edut-action-count">{commentCount || 0}</span>
          </button>

          <button
            type="button"
            className={`edut-action-btn${saved ? ' is-active' : ''}`}
            onClick={() => { if (!saved) triggerBurst('🔖'); handleSave(); }}
            aria-pressed={saved}
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            {saved ? <FaBookmark aria-hidden="true" /> : <FiBookmark aria-hidden="true" />}
          </button>

          <button type="button" className={`edut-action-btn${shared ? ' is-active' : ''}`} onClick={handleShare} aria-label="Share">
            <FiShare2 aria-hidden="true" />
            <span className="edut-action-count">{shareCount || 0}</span>
          </button>
        </div>
      ) : null}

      {/* ── Comments panel ──────────────────────────────────────────────── */}
      {showComments ? (
        <section className="edut-comments-panel" aria-label="Conversation">
          <div className="edut-comments-grabber" aria-hidden="true" />
          <header className="edut-comments-header">
            <div className="edut-comments-title-block">
              <span className="edut-comments-title">Conversation</span>
              <span className="edut-comments-count">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
            </div>
            <button type="button" className="edut-comments-close" onClick={() => setShowComments(false)} aria-label="Close">
              <FiX />
            </button>
          </header>

          {comments.length ? (
            <ul className="edut-comments-list">
              {comments.map((comment) => {
                const isOwn = comment.pending ||
                  (currentUser?.id != null && comment.author_id != null &&
                    String(comment.author_id) === String(currentUser.id));
                return (
                  <li key={comment.id || `${comment.created_at}-${comment.content}`} className={`edut-comment${comment.pending ? ' is-pending' : ''}${isOwn ? ' edut-comment--mine' : ''}`}>
                    <div className="edut-comment-avatar" aria-hidden="true">
                      {comment.author_avatar ? <img src={comment.author_avatar} alt="" /> : <span>{(comment.author_name || '?').slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="edut-comment-body">
                      <div className="edut-comment-meta">
                        <strong>{toDisplayNameCase(comment.author_name || 'Sharether member')}</strong>
                        <span>{formatCommentDate(comment.created_at)}</span>
                        {comment.pending ? <span className="edut-comment-pending">Sending…</span> : null}
                      </div>
                      {comment.reply_to_author ? (
                        <span className="edut-comment-reply-target"><FiCornerDownRight aria-hidden="true" />{toDisplayNameCase(comment.reply_to_author)}</span>
                      ) : null}
                      <p>{comment.content || comment.body}</p>
                      <div className="edut-comment-actions">
                        <button type="button" className="edut-comment-action" aria-label="Like comment"><FiThumbsUp aria-hidden="true" /><span>{comment.likes || 0}</span></button>
                        <button type="button" className="edut-comment-action" onClick={() => handleReply(comment)}>Reply</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="edut-comments-empty">
              <span aria-hidden="true">💬</span>
              <p>Be the first to react with a thought.</p>
            </div>
          )}

          {replyingTo ? (
            <div className="edut-reply-pill" role="status">
              <FiCornerDownRight aria-hidden="true" />
              <span className="edut-reply-preview">{replyingTo.content || replyingTo.author_name}</span>
              <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><FiX /></button>
            </div>
          ) : null}

          <form className="edut-comment-form" onSubmit={handleSubmitComment}>
            <textarea
              ref={commentInputRef}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Add to the conversation…"
              rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment(e); }}
            />
            <button type="submit" className="edut-comment-submit" disabled={!commentDraft.trim() || submittingComment} aria-label="Post">
              <FiSend />
            </button>
          </form>
        </section>
      ) : null}

      {/* ── Emoji burst ─────────────────────────────────────────────────── */}
      {emojiBurst.emoji ? (
        <div className="edut-burst-layer" key={`burst-${emojiBurst.nonce}`} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="edut-burst-particle"
              style={{
                '--bd': `${i * 28}ms`,
                '--bx': `${(Math.cos((i / 8) * Math.PI * 2) * 80).toFixed(0)}px`,
                '--by': `${(Math.sin((i / 8) * Math.PI * 2) * 80 - 40).toFixed(0)}px`,
                '--br': `${(Math.random() * 60 - 30).toFixed(0)}deg`,
              }}
            >
              {emojiBurst.emoji}
            </span>
          ))}
        </div>
      ) : null}

      {/* ── Feedback toast ──────────────────────────────────────────────── */}
      {feedback ? (
        <div className="edut-feedback" role="status" aria-live="polite">{feedback}</div>
      ) : null}
    </div>
    </div>
  );
}
