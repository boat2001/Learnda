import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAnalyticsWithContext } from '../../hooks/useAnalytics';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiAward,
  FiBookOpen,
  FiCpu,
  FiExternalLink,
  FiChevronDown,
  FiFileText,
  FiImage,
  FiInfo,
  FiLayers,
  FiMic,
  FiMoon,
  FiPaperclip,
  FiSend,
  FiSmile,
  FiSquare,
  FiSun,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import useChatSidePanelMobileLayout, { CHAT_SIDE_PANEL_MOBILE_MQ } from '../../hooks/useChatSidePanelMobileLayout';
import usePLS from '../../hooks/usePLS';
import api, { resolveUploadUrl } from '../../services/api';
import {
  getStoredThemePreference,
  resolveThemePreference,
  saveThemePreference,
} from '../../utils/theme';
import { playUiSound } from '../../utils/uiSounds';
import { SharetherChatBackdrop } from '../../components/common/SharetherChatBackdrop';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import {
  canRequestMicrophone,
  getMicrophoneErrorMessage,
  getVoiceRecorderConfig,
} from '../../utils/voiceRecording';
import './StudyGroupRoom.css';

const stripGroupSuffix = (raw = '') => {
  const text = String(raw || '').trim();
  if (!text) return text;
  return text.replace(/\s*study\s+group\s*$/i, '').trim() || text;
};

const QUICK_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '🤣', '😂', '🙂', '😉', '😊',
  '😍', '🥰', '😘', '😋', '🤪', '🤔', '😎', '🤩', '🥳', '😤',
  '😢', '😭', '😱', '🤯', '😴', '🤓', '🧐', '🙃', '😐', '😏',
  '🙏', '👍', '👎', '👏', '🙌', '🤝', '💪', '👌', '✌️', '🫶',
  '🔥', '💡', '⭐', '✨', '🎯', '📚', '✅', '❌', '❤️', '🧠',
];
const POLL_INTERVAL_MS = 10_000;
const PANEL_PREVIEW_LIMIT = 4;
const STUDY_GROUP_MSG_MAX_LEN = 2000;
/** Show character count when this many characters are used (soft limit heads-up). */
const STUDY_GROUP_MSG_COUNT_FROM = 1600;

const EXTERNAL_URL_RE = /https?:\/\/[^\s]+|www\.[a-zA-Z0-9.-]+\.[a-z]{2,}[^\s]*/i;
const LINK_TOKEN_RE = /\[LINK:([^\]]+)\]/g;

function renderMessageBody(body) {
  const parts = [];
  let last = 0;
  let match;
  LINK_TOKEN_RE.lastIndex = 0;
  while ((match = LINK_TOKEN_RE.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <span key={match.index} className="sgr-bubble__disabledLink" title="External links are disabled for member security">
        🔒 {match[1]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts.length > 1 ? parts : body;
}
/** Matches CSS breakpoint where side panels switch to overlays (≤900px = closed by default). */
const STUDY_GROUP_DESKTOP_SIDE_PANELS_MQ = '(min-width: 901px)';

/** Desktop (≥901px): both side rails open by default; mobile overlays default closed. */
const sidePanelsOpenByLayoutDefault = () => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(STUDY_GROUP_DESKTOP_SIDE_PANELS_MQ).matches;
};

/** Matches CSS overlay mode — only here do we close the other panel when opening one. */
const isStudyGroupChatMobileOverlay = () =>
  typeof window !== 'undefined' && window.matchMedia(CHAT_SIDE_PANEL_MOBILE_MQ).matches;

function formatRecordingTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Created-at from API (snake_case) or Sequelize-shaped payloads (camelCase). */
function messageTimestamp(message) {
  const raw = message?.created_at ?? message?.createdAt ?? null;
  return raw != null ? String(raw) : '';
}

/** Short local 24h clock (HH:mm), no AM/PM. */
function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function messageTimeTitle(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return undefined;
  const datePart = d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  return `${datePart} · ${formatMessageTime(dateStr)}`;
}

function messageAuthorId(message) {
  const author = message?.author;
  if (author?.id != null) return String(author.id);
  if (message?.user_id != null) return String(message.user_id);
  if (message?.userId != null) return String(message.userId);
  return '';
}

/** Local calendar day key for grouping (YYYY-MM-DD in the viewer's timezone). */
function localDayKey(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** WhatsApp-style sticky day label: Today, Yesterday, or a written date. */
function chatDayDividerLabel(dayKey) {
  if (!dayKey) return '';
  const parts = dayKey.split('-').map(Number);
  const y = parts[0];
  const m = parts[1] - 1;
  const day = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return '';

  const thatStart = new Date(y, m, day);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (thatStart.getTime() === todayStart.getTime()) return 'Today';
  if (thatStart.getTime() === yesterdayStart.getTime()) return 'Yesterday';

  const sameYear = y === now.getFullYear();
  return thatStart.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function ChatTimeline({ messages, userId }) {
  return messages.flatMap((m, i) => {
    const dayKey = localDayKey(messageTimestamp(m));
    const prevKey = i > 0 ? localDayKey(messageTimestamp(messages[i - 1])) : null;
    const isMine = String(m.author?.id || '') === String(userId || '');
    const nodes = [];
    if (dayKey && dayKey !== prevKey) {
      const label = chatDayDividerLabel(dayKey);
      if (label) {
        nodes.push(
          <div
            key={`day-${dayKey}-${m.id}`}
            className="sgr-chat__day"
            role="separator"
            aria-label={label}
          >
            <span className="sgr-chat__day-label">{label}</span>
          </div>,
        );
      }
    }
    nodes.push(<MessageBubble key={m.id} message={m} isMine={isMine} />);
    return nodes;
  });
}

/**
 * When the message is only emoji (plus whitespace). Returns grapheme-cluster count or null.
 * Uses Intl.Segmenter when available so ZWJ sequences (e.g. family) count as one emoji.
 */
function getEmojiOnlyClusterCount(body) {
  const raw = String(body ?? '').normalize('NFC').trim();
  if (!raw) return null;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let count = 0;
    for (const { segment } of segmenter.segment(raw)) {
      if (/^\s+$/u.test(segment)) continue;
      const condensed = segment.replace(/\s+/gu, '');
      if (!condensed) continue;
      if (!/\p{Extended_Pictographic}/u.test(segment)) return null;
      count += 1;
    }
    return count > 0 ? count : null;
  }

  const collapsed = raw.replace(/\s+/gu, '');
  if (!collapsed.length) return null;
  if (!/^[\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(collapsed)) return null;
  const pictos = collapsed.match(/\p{Extended_Pictographic}/gu);
  return pictos && pictos.length ? pictos.length : null;
}

/** CSS tier 1=largest bubble (solo emoji), 2=two sharing, … 6=many scaled down */
function emojiBubbleTierFromCount(count) {
  if (!count) return null;
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 4;
  if (count === 5) return 5;
  return 6;
}

function FileAttachment({ file }) {
  const url = resolveUploadUrl(file.url);
  const isImage = String(file.mime_type || '').startsWith('image/');
  const [imageFailed, setImageFailed] = useState(false);
  if (isImage && !imageFailed) {
    return (
      <a className="sgr-file-card sgr-file-card--image" href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={file.name}
          className="sgr-file-card__img"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
        <span className="sgr-file-card__name">{file.name}</span>
      </a>
    );
  }
  return (
    <a className="sgr-file-card" href={url} target="_blank" rel="noopener noreferrer" download={file.name}>
      <span className="sgr-file-card__icon" aria-hidden><FiPaperclip /></span>
      <span className="sgr-file-card__info">
        <span className="sgr-file-card__name">{file.name}</span>
        {file.size ? <span className="sgr-file-card__size">{fileSize(file.size)}</span> : null}
      </span>
      <FiExternalLink className="sgr-file-card__go" aria-hidden />
    </a>
  );
}

function MessageBubble({ message, isMine }) {
  const link = message.metadata?.link;
  const voice = message.metadata?.voice;
  const file = message.metadata?.file;
  const author = message.author || {};
  const ts = messageTimestamp(message);
  const timeLabel = formatMessageTime(ts);
  const bodyIsAuto = file && (message.body === `📎 ${file.name}` || message.body === '📎 Attachment');
  const emojiOnlyCount =
    !link?.url && !file?.url && !voice?.url && !bodyIsAuto ? getEmojiOnlyClusterCount(message.body) : null;
  const emojiTier = emojiBubbleTierFromCount(emojiOnlyCount);

  const bubbleClass = [
    'sgr-bubble',
    isMine ? 'sgr-bubble--mine' : '',
    emojiTier != null ? `sgr-bubble--emoji-only sgr-bubble--emoji-tier-${emojiTier}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={bubbleClass}>
      {!isMine ? (
        <div className="sgr-bubble__avatar" aria-hidden>
          {(author.full_name || '?').slice(0, 1).toUpperCase()}
        </div>
      ) : null}

      <div className="sgr-bubble__body">
        {!isMine ? (
          <header className="sgr-bubble__head">
            <span className="sgr-bubble__name">{author.full_name || 'Student'}</span>
          </header>
        ) : null}

        {link?.url ? (
          <a
            className="sgr-rich-card"
            href={link.url}
            target={String(link.url).startsWith('http') ? '_blank' : undefined}
            rel={String(link.url).startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            <span className="sgr-rich-card__icon" aria-hidden>
              {link.kind === 'practice' ? (
                <FiCpu />
              ) : link.kind === 'edutainment' ? (
                <FiLayers />
              ) : link.kind === 'badge' ? (
                <FiAward />
              ) : (
                <FiBookOpen />
              )}
            </span>
            <span className="sgr-rich-card__text">
              <span className="sgr-rich-card__tag">
                {link.kind === 'practice'
                  ? 'Practice'
                  : link.kind === 'edutainment'
                    ? 'Edutainment'
                    : link.kind === 'badge'
                      ? 'Badge'
                      : 'Lesson'}
              </span>
              <span className="sgr-rich-card__title">{link.title}</span>
              {link.subtitle ? <span className="sgr-rich-card__sub">{link.subtitle}</span> : null}
            </span>
            <FiExternalLink className="sgr-rich-card__go" aria-hidden />
          </a>
        ) : null}

        {bodyIsAuto && (file?.url || voice?.url || timeLabel) ? (
          <div className="sgr-bubble__tailRow">
            <div className="sgr-bubble__tailMain">
              {file?.url ? <FileAttachment file={file} /> : null}
              {voice?.url ? (
                <div className="sgr-voice">
                  <audio controls preload="metadata" className="sgr-voice__audio">
                    <source src={resolveUploadUrl(voice.url)} type={voice.mime_type || 'audio/webm'} />
                    <a href={resolveUploadUrl(voice.url)}>Download voice note</a>
                  </audio>
                </div>
              ) : null}
            </div>
            {timeLabel ? (
              <time
                className="sgr-bubble__time sgr-bubble__time--tail"
                dateTime={ts || undefined}
                title={messageTimeTitle(ts)}
              >
                {timeLabel}
              </time>
            ) : null}
          </div>
        ) : (
          <>
            {file?.url ? <FileAttachment file={file} /> : null}
            {voice?.url ? (
              <div className="sgr-voice">
                <audio controls preload="metadata" className="sgr-voice__audio">
                  <source src={resolveUploadUrl(voice.url)} type={voice.mime_type || 'audio/webm'} />
                  <a href={resolveUploadUrl(voice.url)}>Download voice note</a>
                </audio>
              </div>
            ) : null}
          </>
        )}

        {!bodyIsAuto ? (
          <p className="sgr-bubble__text">
            <span className="sgr-bubble__textBody">{renderMessageBody(message.body)}</span>
            {timeLabel ? (
              <time
                className="sgr-bubble__time sgr-bubble__time--stamp"
                dateTime={ts || undefined}
                title={messageTimeTitle(ts)}
              >
                {timeLabel}
              </time>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function PanelSection({ id, title, count, children, expanded, onToggle }) {
  const hasOverflow = Number(count) > PANEL_PREVIEW_LIMIT;
  return (
    <section className={`sgr-panel-section ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="sgr-panel-section__head"
        onClick={
          hasOverflow
            ? () => {
                playUiSound(expanded ? 'sectionClose' : 'sectionOpen');
                onToggle(id);
              }
            : undefined
        }
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <span className="sgr-panel-section__meta">
          {count ? <strong>{count}</strong> : null}
          {hasOverflow ? <FiChevronDown aria-hidden /> : null}
        </span>
      </button>
      <div className="sgr-panel-section__body">{children}</div>
    </section>
  );
}

export default function StudyGroupRoom() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshPLS } = usePLS();
  const { trackEvent } = useAnalyticsWithContext();

  // Theme preference (mirrors LessonViewer pattern so the chat room keeps
  // theme parity with the lesson stage).
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const [chatTheme, setChatTheme] = useState(() => resolveThemePreference(getStoredThemePreference()));

  const handleThemeToggle = useCallback(() => {
    const nextPreference = chatTheme === 'dark' ? 'light' : 'dark';
    const { preference, resolved } = saveThemePreference(nextPreference);
    setThemePreference(preference);
    setChatTheme(resolved);
  }, [chatTheme]);

  // Keep the resolved theme in sync if the user toggles preference elsewhere.
  useEffect(() => {
    const resolved = resolveThemePreference(themePreference);
    setChatTheme((prev) => (prev === resolved ? prev : resolved));
  }, [themePreference]);

  const [room, setRoom] = useState(null);
  const [roomReady, setRoomReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [composerStatus, setComposerStatus] = useState('');
  const [showMembersPanel, setShowMembersPanel] = useState(sidePanelsOpenByLayoutDefault);
  const [showInfoPanel, setShowInfoPanel] = useState(sidePanelsOpenByLayoutDefault);
  const isChatMobileOverlayLayout = useChatSidePanelMobileLayout();
  const [expandedPanelSections, setExpandedPanelSections] = useState({
    members: false,
    lessons: false,
    practice: false,
    edutainment: false,
    media: false,
    files: false
  });

  // Voice notes (mic recording)
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const listEndRef = useRef(null);
  const didInitialChatScrollRef = useRef(false);
  const fileInputRef = useRef(null);
  const composerTextareaRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const [attachedFile, setAttachedFile] = useState(null);
  const [attachPreviewUrl, setAttachPreviewUrl] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const seenGroupMessageIdsRef = useRef(null);

  const group = room?.group;
  const pageTitle = group?.is_official ? stripGroupSuffix(group?.title || '') : (group?.title || '');
  usePageTitle(pageTitle || 'Study Group');

  const togglePanelSection = useCallback((id) => {
    setExpandedPanelSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleMembersPanel = useCallback(() => {
    setShowMembersPanel((v) => {
      const next = !v;
      if (next && isStudyGroupChatMobileOverlay()) setShowInfoPanel(false);
      return next;
    });
  }, []);

  const toggleInfoPanel = useCallback(() => {
    setShowInfoPanel((v) => {
      const next = !v;
      if (next && isStudyGroupChatMobileOverlay()) setShowMembersPanel(false);
      return next;
    });
  }, []);

  const dismissMobileSidePanels = useCallback(() => {
    setShowMembersPanel(false);
    setShowInfoPanel(false);
  }, []);

  const loadRoom = useCallback(async () => {
    if (!groupId) return;
    setLoadError('');
    setMessages([]);
    try {
      const res = await api.studyGroups.getRoom(groupId);
      if (!res?.success) {
        setLoadError(res?.error || 'Could not load this group.');
        setRoom(null);
        return;
      }

      let initialMessages = null;
      if (res.data?.is_member) {
        try {
          const msgRes = await api.studyGroups.getMessages(groupId);
          if (msgRes?.success && Array.isArray(msgRes.data?.messages)) {
            initialMessages = msgRes.data.messages;
          }
        } catch {
          /* non-fatal; polling will retry */
        }
      }

      setRoom(res.data);
      if (initialMessages) {
        setMessages(initialMessages);
      }
    } catch (e) {
      setLoadError(e?.message || 'Could not load this group.');
      setRoom(null);
    } finally {
      setRoomReady(true);
    }
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    if (!groupId || !room?.is_member) return;
    try {
      const res = await api.studyGroups.getMessages(groupId);
      if (res?.success && Array.isArray(res.data?.messages)) {
        setMessages(res.data.messages);
      }
    } catch {
      /* keep cached messages */
    }
  }, [groupId, room?.is_member]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!room?.is_member) return undefined;
    const t = window.setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [room?.is_member, loadMessages]);

  useEffect(() => {
    didInitialChatScrollRef.current = false;
    seenGroupMessageIdsRef.current = null;
  }, [groupId]);

  useEffect(() => {
    if (!messages.length) return;
    const behavior = didInitialChatScrollRef.current ? 'smooth' : 'auto';
    didInitialChatScrollRef.current = true;
    listEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (!room?.is_member || !user?.id) return;
    if (!messages.length) {
      seenGroupMessageIdsRef.current = null;
      return;
    }
    const idSet = new Set(messages.map((m) => (m?.id != null ? String(m.id) : '')).filter(Boolean));
    if (!seenGroupMessageIdsRef.current) {
      seenGroupMessageIdsRef.current = idSet;
      return;
    }
    const prev = seenGroupMessageIdsRef.current;
    const added = messages.filter((m) => m?.id != null && !prev.has(String(m.id)));
    seenGroupMessageIdsRef.current = idSet;
    if (!added.length) return;
    const mine = String(user.id);
    if (added.some((m) => messageAuthorId(m) && messageAuthorId(m) !== mine)) {
      playUiSound('groupMessage');
    }
  }, [messages, room?.is_member, user?.id]);

  /** WhatsApp-like: grow textarea with wrapped text until CSS max-height, then scroll vertically */
  const clampComposerTextareaHeight = useCallback(() => {
    const el = composerTextareaRef.current;
    if (!el) return;
    const maxPxRaw = Number.parseFloat(getComputedStyle(el).maxHeight);
    const minPxRaw = Number.parseFloat(getComputedStyle(el).minHeight);
    const maxHeight = Number.isFinite(maxPxRaw) && maxPxRaw > 0 ? maxPxRaw : 176;
    const minHeight = Number.isFinite(minPxRaw) && minPxRaw > 0 ? minPxRaw : 43;
    el.style.height = '';
    el.style.overflowY = 'hidden';
    const capped = Math.min(el.scrollHeight, maxHeight);
    const nextHeight = Math.max(minHeight, capped);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    clampComposerTextareaHeight();
  }, [draft, showEmoji, clampComposerTextareaHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('resize', clampComposerTextareaHeight);
    return () => window.removeEventListener('resize', clampComposerTextareaHeight);
  }, [clampComposerTextareaHeight]);

  /** Rich paste (Word, Slack, browsers) inserts plain characters only — no hidden HTML/formatting junk. */
  const handleComposerPaste = useCallback(
    (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      const types = cd.types ? Array.from(cd.types) : [];
      if (types.some((t) => t === 'Files')) return;

      if (!types.includes('text/html')) return;

      const plain = String(cd.getData('text/plain') ?? '').replace(/\r\n/g, '\n');
      if (!plain) return;

      const ta = composerTextareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;

      e.preventDefault();

      let insertedLen = 0;
      setDraft((prev) => {
        const selectedLen = end - start;
        const room = Math.max(0, STUDY_GROUP_MSG_MAX_LEN - prev.length + selectedLen);
        const ins = plain.length <= room ? plain : plain.slice(0, room);
        insertedLen = ins.length;
        return prev.slice(0, start) + ins + prev.slice(end);
      });

      queueMicrotask(() => {
        const el = composerTextareaRef.current;
        if (!el) return;
        el.selectionStart = el.selectionEnd = start + insertedLen;
        clampComposerTextareaHeight();
      });
    },
    [clampComposerTextareaHeight],
  );

  const handleJoin = async () => {
    if (!groupId) return;
    setJoining(true);
    setLoadError('');
    try {
      const res = await api.studyGroups.join(groupId);
      if (!res?.success) {
        setLoadError(res?.error || 'Could not join this group.');
        return;
      }
      trackEvent('study_group_joined', { group_id: groupId, group_name: room?.name });
      refreshPLS?.().catch(() => {});
      await loadRoom();
    } catch (e) {
      setLoadError(e?.message || 'Could not join.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupId) return;
    if (!window.confirm('Leave this group? You can rejoin from study groups anytime.')) return;
    setLeavingGroup(true);
    try {
      const res = await api.studyGroups.leave(groupId);
      if (!res?.success) {
        window.alert(res?.error || 'Could not leave this group.');
        return;
      }
      trackEvent('study_group_left', { group_id: groupId, group_name: room?.name });
      refreshPLS?.().catch(() => {});
      navigate('/groups');
    } catch (e) {
      window.alert(e?.message || 'Could not leave this group.');
    } finally {
      setLeavingGroup(false);
    }
  };

  const handleSend = async () => {
    const text = draft.replace(/\r\n/g, '\n').trim();
    const hasContent = text || attachedFile;
    if (!hasContent || !groupId || !room?.is_member || sending) return;
    setSending(true);
    setComposerStatus('');
    try {
      let message = null;

      if (attachedFile) {
        const fd = new FormData();
        fd.append('file', attachedFile, attachedFile.name);
        if (text) fd.append('caption', text);
        const res = await api.studyGroups.postFileMessage(groupId, fd);
        if (res?.success && res.data?.message) {
          message = res.data.message;
        } else {
          setComposerStatus(res?.error || 'File could not be sent.');
          return;
        }
      } else {
        const res = await api.studyGroups.postMessage(groupId, { body: text, metadata: {} });
        if (res?.success && res.data?.message) {
          message = res.data.message;
        } else {
          setComposerStatus(res?.error || 'Message could not be sent.');
          return;
        }
      }

      if (message) {
        setMessages((prev) => [...prev, message]);
        playUiSound('messageSent');
        trackEvent('study_group_message_sent', {
          group_id: groupId,
          message_type: attachedFile ? 'file' : 'text',
          has_attachment: !!attachedFile,
        });
      }
      setDraft('');
      if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl);
      setAttachedFile(null);
      setAttachPreviewUrl(null);
      setShowEmoji(false);
    } catch (e) {
      setComposerStatus(e?.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl);
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAttachedFile(file);
    setAttachPreviewUrl(preview);
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl);
    setAttachedFile(null);
    setAttachPreviewUrl(null);
  };

  const appendEmoji = (emoji) => setDraft((d) => `${d}${emoji}`);

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopStream = () => {
    stopRecordingTimer();
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (!groupId || !room?.is_member || voiceBusy) return;
    if (!canRequestMicrophone()) {
      setComposerStatus(getMicrophoneErrorMessage());
      return;
    }
    const recorderConfig = getVoiceRecorderConfig();
    if (!recorderConfig) {
      setComposerStatus('Voice notes are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const { mime, ext } = recorderConfig;
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stopRecordingTimer();
        stopStream();
        mediaRecorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (!blob.size) {
          setRecording(false);
          return;
        }
        setVoiceBusy(true);
        try {
          const fd = new FormData();
          fd.append('audio', blob, `voice-note.${ext}`);
          const res = await api.studyGroups.postVoiceMessage(groupId, fd);
          if (res?.success && res.data?.message) {
            setMessages((prev) => [...prev, res.data.message]);
            playUiSound('messageSent');
          } else {
            setComposerStatus(res?.error || 'Voice upload failed.');
          }
        } catch (e) {
          setComposerStatus(e?.message || 'Voice upload failed.');
        } finally {
          setVoiceBusy(false);
          setRecording(false);
        }
      };
      mr.start(200);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      setRecording(true);
      setComposerStatus('');
    } catch (error) {
      setComposerStatus(getMicrophoneErrorMessage(error));
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      mr.stop();
    } else {
      stopStream();
      setRecording(false);
    }
  };

  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      stopStream();
      if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl);
    },
    []
  );

  // Lock body scroll while inside the chat (lesson-style fullscreen)
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, []);

  const isMember = Boolean(room?.is_member);
  const memberCount = group?.member_count || 0;
  const isOfficial = Boolean(group?.is_official);
  const displayTitle = isOfficial ? stripGroupSuffix(group?.title) : group?.title;
  // For official course groups the title already conveys the course, so we
  // suppress the eyebrow. For custom groups we still show the related course
  // (or the audience label) as orientation.
  const eyebrowParts = [];
  if (!isOfficial && (group?.course_name || group?.course_code)) {
    eyebrowParts.push(group.course_name || group.course_code);
  }
  if (group?.audience_label) {
    const type = String(group.audience_type || '').toLowerCase();
    eyebrowParts.push(
      type === 'class' ? `Class ${group.audience_label}` :
      type === 'level' ? `Level ${group.audience_label}` :
      group.audience_label
    );
  }
  const eyebrow = eyebrowParts.join(' · ');

  const allMembers = useMemo(() => {
    const sourceMembers = Array.isArray(room?.members)
      ? room.members
      : Array.isArray(room?.group?.members)
        ? room.group.members
        : [];
    const byId = new Map();
    sourceMembers.forEach((member) => {
      const id = String(member?.id || member?.user_id || member?.user?.id || '');
      if (!id) return;
      byId.set(id, {
        id,
        name: member?.full_name || member?.name || member?.user?.full_name || 'Student',
        role: member?.role || member?.membership_role || 'member',
        avatar_url: member?.avatar_url || member?.user?.avatar_url || null,
        online: Boolean(member?.online || member?.is_online || member?.active_now)
      });
    });
    messages.forEach((message) => {
      const author = message.author || {};
      const id = String(author.id || '');
      if (!id || byId.has(id)) return;
      byId.set(id, {
        id,
        name: author.full_name || 'Student',
        role: 'member',
        avatar_url: author.avatar_url || null,
        online:
          Number.isFinite(new Date(messageTimestamp(message)).getTime()) &&
          Date.now() - new Date(messageTimestamp(message)).getTime() < 5 * 60 * 1000,
      });
    });
    if (user?.id && !byId.has(String(user.id))) {
      byId.set(String(user.id), {
        id: String(user.id),
        name: user.full_name || 'You',
        role: 'member',
        avatar_url: user.avatar_url || null,
        online: true
      });
    }
    return Array.from(byId.values()).sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }, [messages, room?.group?.members, room?.members, user]);

  const onlineCount = allMembers.filter((member) => member.online).length;
  const groupContent = useMemo(() => {
    const buckets = {
      lessons: [],
      practice: [],
      edutainment: [],
      media: [],
      files: []
    };
    messages.forEach((message) => {
      const link = message.metadata?.link;
      const file = message.metadata?.file;
      const ts = messageTimestamp(message);
      if (link?.kind === 'lesson') buckets.lessons.push({ ...link, id: `lesson-${message.id}`, time: ts });
      if (link?.kind === 'practice') buckets.practice.push({ ...link, id: `practice-${message.id}`, time: ts });
      if (link?.kind === 'edutainment') buckets.edutainment.push({ ...link, id: `edutainment-${message.id}`, time: ts });
      if (file?.url) {
        const item = { ...file, id: `file-${message.id}`, time: ts };
        if (String(file.mime_type || '').startsWith('image/') || String(file.mime_type || '').startsWith('video/')) {
          buckets.media.push(item);
        } else {
          buckets.files.push(item);
        }
      }
    });
    Object.keys(buckets).forEach((key) => {
      buckets[key].reverse();
    });
    return buckets;
  }, [messages]);

  const visibleItems = (items, key) => expandedPanelSections[key] ? items : items.slice(0, PANEL_PREVIEW_LIMIT);

  if (!groupId) return <Navigate to="/groups" replace />;

  if (roomReady && loadError && !room) {
    return (
      <div className="sgr-shell sgr-shell--error">
        <button type="button" className="sgr-back-btn" onClick={() => navigate('/groups')}>
          <FiArrowLeft aria-hidden /> Back to study groups
        </button>
        <div className="sgr-error-pane">
          <h1>{loadError}</h1>
          <p>The group may have been removed or your access changed.</p>
        </div>
      </div>
    );
  }

  if (!roomReady || !room || !group) {
    return (
      <div className="sgr-shell">
        <div className="sgr-skeleton-header" />
        <div className="sgr-skeleton-body" />
      </div>
    );
  }

  return (
    <div
      className={`sgr-shell theme-${chatTheme}`}
      data-theme-aware="true"
      data-theme={chatTheme}
    >
      <header className="sgr-topbar">
        <button type="button" className="sgr-back-btn" onClick={() => navigate('/groups')} aria-label="Back to study groups">
          <FiArrowLeft aria-hidden />
        </button>

        {isMember ? (
          <button
            type="button"
            className={`sgr-panel-toggle sgr-panel-toggle--members ${showMembersPanel ? 'is-active' : ''}`}
            onClick={toggleMembersPanel}
            aria-label="Toggle group members"
            aria-expanded={showMembersPanel}
            title="Group members"
          >
            <FiUsers aria-hidden />
          </button>
        ) : null}

        <div className="sgr-topbar__main">
          {eyebrow ? <p className="sgr-topbar__eyebrow">{eyebrow}</p> : null}
          <h1 className="sgr-topbar__title">{displayTitle}</h1>
        </div>

        <div className="sgr-topbar__meta">
          <div className="sgr-topbar__stats">
            <button
              type="button"
              className="sgr-theme-toggle"
              onClick={handleThemeToggle}
              aria-label={chatTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={chatTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {chatTheme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
          </div>

          {isMember ? (
            <button
              type="button"
              className={`sgr-panel-toggle sgr-panel-toggle--info ${showInfoPanel ? 'is-active' : ''}`}
              onClick={toggleInfoPanel}
              aria-label="Toggle group info"
              aria-expanded={showInfoPanel}
              title="Group info"
            >
              <FiInfo aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      {!isMember ? (
        <div className="sgr-gate">
          <div className="sgr-gate__inner">
            <h2>Join {group.title} to open the chat</h2>
            <p>
              Members can chat, share lessons and practice sets, send voice notes, and files for revision sessions.
            </p>
            <button type="button" className="sgr-primary-btn" disabled={joining} onClick={handleJoin}>
              {joining ? 'Joining…' : 'Join group'}
            </button>
            {loadError ? <p className="sgr-error-line">{loadError}</p> : null}
          </div>
        </div>
      ) : (
        <main className={`sgr-stage ${showMembersPanel ? 'sgr-stage--members-open' : ''} ${showInfoPanel ? 'sgr-stage--info-open' : ''}`}>
          <aside className={`sgr-side-panel sgr-side-panel--members ${showMembersPanel ? 'is-open' : ''}`} aria-label="Group members">
            <header className="sgr-side-panel__head">
              <div>
                <span className="sgr-side-panel__eyebrow">Study group</span>
                <h2>Members</h2>
              </div>
              <button type="button" className="sgr-side-panel__close" onClick={() => setShowMembersPanel(false)} aria-label="Close members panel">
                <FiX aria-hidden />
              </button>
            </header>
            <div className="sgr-members-summary">
              <span><strong>{onlineCount}</strong> online</span>
              <span><strong>{memberCount || allMembers.length}</strong> students</span>
            </div>
            <PanelSection
              id="members"
              title="Students"
              count={allMembers.length}
              expanded={expandedPanelSections.members}
              onToggle={togglePanelSection}
            >
              <div className="sgr-member-list">
                {visibleItems(allMembers, 'members').map((member) => (
                  <div className="sgr-member-row" key={member.id}>
                    <span className="sgr-member-row__avatar" aria-hidden>
                      {member.avatar_url ? <img src={resolveUploadUrl(member.avatar_url)} alt="" /> : member.name.slice(0, 1).toUpperCase()}
                      <span className={`sgr-member-row__presence ${member.online ? 'is-online' : ''}`} />
                    </span>
                    <span className="sgr-member-row__text">
                      <strong>{String(member.id) === String(user?.id) ? 'You' : member.name}</strong>
                      <small>{member.online ? 'Online now' : member.role}</small>
                    </span>
                  </div>
                ))}
              </div>
            </PanelSection>
          </aside>

          <section className="sgr-chat" aria-label="Group chat">
            <SharetherChatBackdrop patternSeed={`study-group-chat-${group?.id ?? groupId ?? 'room'}`} />
            <div className="sgr-chat__messages">
              {messages.length === 0 ? (
                <div className="sgr-chat__empty">
                  <p>No messages yet — say hi, share what you are working on, or drop a lesson link.</p>
                </div>
              ) : (
                <ChatTimeline messages={messages} userId={user?.id} />
              )}
              <div ref={listEndRef} />
            </div>

            <div className="sgr-composer">
              {recording ? (
                <div className="sgr-recording-bar" role="status" aria-live="polite">
                  <span className="sgr-recording-wave" aria-hidden>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className="sgr-recording-wave__bar" style={{ animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </span>
                  <span className="sgr-recording-label">Recording</span>
                  <span className="sgr-recording-timer">{formatRecordingTime(recordingSeconds)}</span>
                  <button
                    type="button"
                    className="sgr-recording-cancel"
                    onClick={() => { stopRecordingTimer(); stopStream(); setRecording(false); setRecordingSeconds(0); }}
                    aria-label="Cancel recording"
                  >
                    <FiX />
                  </button>
                </div>
              ) : null}

              {attachedFile && !recording ? (
                <div className="sgr-attach-preview">
                  {attachPreviewUrl ? (
                    <img src={attachPreviewUrl} alt={attachedFile.name} className="sgr-attach-preview__thumb" />
                  ) : (
                    <span className="sgr-attach-preview__icon" aria-hidden><FiPaperclip /></span>
                  )}
                  <span className="sgr-attach-preview__info">
                    <span className="sgr-attach-preview__name">{attachedFile.name}</span>
                    <span className="sgr-attach-preview__size">{fileSize(attachedFile.size)}</span>
                  </span>
                  <button
                    type="button"
                    className="sgr-attach-preview__remove"
                    onClick={handleRemoveAttachment}
                    aria-label="Remove attachment"
                  >
                    <FiX />
                  </button>
                </div>
              ) : null}

              {showEmoji ? (
                <div className="sgr-emoji-panel" role="listbox" aria-label="Quick emoji">
                  {QUICK_EMOJIS.map((e, emojiIndex) => (
                    <button key={`${emojiIndex}-${e}`} type="button" className="sgr-emoji-btn" onClick={() => appendEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              ) : null}

              <p id="sgr-composer-hint" className="sgr-sr-only">
                Spell checking is enabled. Send with Enter on desktop or with Control Enter. New line:
                Shift Enter. Paste from formatted apps uses plain text only.
              </p>

              <div className="sgr-composer__row">
                <button
                  type="button"
                  className={`sgr-tool sgr-tool--mic ${recording ? 'is-recording' : ''}`}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={voiceBusy}
                  aria-label={recording ? 'Stop and send voice note' : 'Record voice note'}
                  title={recording ? 'Stop recording' : 'Voice note'}
                >
                  {recording ? <FiSquare /> : <FiMic />}
                </button>

                <div className="sgr-composer__field">
                  <textarea
                    ref={composerTextareaRef}
                    id="sgr-composer-message"
                    className="sgr-input"
                    name="study_group_message_content"
                    rows={1}
                    maxLength={STUDY_GROUP_MSG_MAX_LEN}
                    spellCheck
                    autoCapitalize="sentences"
                    autoCorrect="on"
                    autoComplete="off"
                    enterKeyHint="send"
                    inputMode="text"
                    aria-label="Group message"
                    aria-describedby="sgr-composer-hint"
                    title="Enter sends (desktop); Shift+Enter newline; Ctrl or ⌘+Enter always sends"
                    placeholder="Message the group…"
                    value={draft}
                    data-form-type="other"
                    onChange={(e) => setDraft(e.target.value)}
                    onPaste={handleComposerPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSend();
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
                        if (isDesktop) {
                          e.preventDefault();
                          handleSend();
                        }
                      }
                    }}
                  />
                  <div className="sgr-composer__field-actions">
                    <button
                      type="button"
                      className={`sgr-field-action ${showEmoji ? 'is-active' : ''}`}
                      onClick={() => setShowEmoji((v) => !v)}
                      aria-expanded={showEmoji}
                      aria-label="Emoji"
                      title="Emoji"
                    >
                      <FiSmile aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`sgr-field-action ${attachedFile ? 'is-attached' : ''}`}
                      onClick={handleAttachClick}
                      aria-label="Attach file"
                      title="Attach file"
                    >
                      <FiPaperclip aria-hidden />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sgr-file-input"
                    onChange={handleFileChange}
                    aria-hidden
                    tabIndex={-1}
                  />
                </div>

                <button
                  type="button"
                  className="sgr-send"
                  onClick={handleSend}
                  disabled={sending || (!draft.trim() && !attachedFile)}
                  aria-label="Send message"
                  title="Send"
                >
                  <FiSend />
                </button>
              </div>

              {EXTERNAL_URL_RE.test(draft) ? (
                <p className="sgr-link-notice" aria-live="polite">
                  🔒 External links are disabled to keep the community secure — the link will be replaced when sent.
                </p>
              ) : draft.length >= STUDY_GROUP_MSG_COUNT_FROM ? (
                <p
                  className={`sgr-composer__char-hint ${draft.length >= STUDY_GROUP_MSG_MAX_LEN - 200 ? 'is-near-limit' : ''}`}
                  aria-live="polite"
                >
                  {draft.length >= STUDY_GROUP_MSG_MAX_LEN - 60
                    ? `${(STUDY_GROUP_MSG_MAX_LEN - draft.length).toLocaleString()} characters left`
                    : `${draft.length.toLocaleString()} / ${STUDY_GROUP_MSG_MAX_LEN.toLocaleString()}`}
                </p>
              ) : null}

              {composerStatus ? <p className="sgr-composer__status">{composerStatus}</p> : null}
            </div>
          </section>

          <aside className={`sgr-side-panel sgr-side-panel--info ${showInfoPanel ? 'is-open' : ''}`} aria-label="Group information and shared content">
            <header className="sgr-side-panel__head">
              <div>
                <h2>Group info</h2>
              </div>
              <button type="button" className="sgr-side-panel__close" onClick={() => setShowInfoPanel(false)} aria-label="Close group info panel">
                <FiX aria-hidden />
              </button>
            </header>
            <div className="sgr-group-card">
              <strong>{displayTitle}</strong>
              <p>{group.description || 'Lessons, practice links, media, and revision files shared by this group will stay here.'}</p>
            </div>

            <PanelSection id="lessons" title="Lessons" count={groupContent.lessons.length} expanded={expandedPanelSections.lessons} onToggle={togglePanelSection}>
              <div className="sgr-content-list">
                {visibleItems(groupContent.lessons, 'lessons').length ? visibleItems(groupContent.lessons, 'lessons').map((item) => (
                  <a className="sgr-content-row" href={item.url} key={item.id} target={item.url?.startsWith('http') ? '_blank' : undefined} rel={item.url?.startsWith('http') ? 'noopener noreferrer' : undefined}>
                    <span className="sgr-content-row__icon"><FiBookOpen aria-hidden /></span>
                    <span><strong>{item.title}</strong><small>{item.subtitle || relativeTime(item.time)}</small></span>
                  </a>
                )) : <p className="sgr-panel-empty">No lesson links shared yet.</p>}
              </div>
            </PanelSection>

            <PanelSection id="practice" title="Practice" count={groupContent.practice.length} expanded={expandedPanelSections.practice} onToggle={togglePanelSection}>
              <div className="sgr-content-list">
                {visibleItems(groupContent.practice, 'practice').length ? visibleItems(groupContent.practice, 'practice').map((item) => (
                  <a className="sgr-content-row" href={item.url} key={item.id} target={item.url?.startsWith('http') ? '_blank' : undefined} rel={item.url?.startsWith('http') ? 'noopener noreferrer' : undefined}>
                    <span className="sgr-content-row__icon is-practice"><FiCpu aria-hidden /></span>
                    <span><strong>{item.title}</strong><small>{item.subtitle || relativeTime(item.time)}</small></span>
                  </a>
                )) : <p className="sgr-panel-empty">Practice sets will appear here.</p>}
              </div>
            </PanelSection>

            <PanelSection id="edutainment" title="Edutainment" count={groupContent.edutainment.length} expanded={expandedPanelSections.edutainment} onToggle={togglePanelSection}>
              <div className="sgr-content-list">
                {visibleItems(groupContent.edutainment, 'edutainment').length ? visibleItems(groupContent.edutainment, 'edutainment').map((item) => (
                  <a className="sgr-content-row" href={item.url} key={item.id} target={item.url?.startsWith('http') ? '_blank' : undefined} rel={item.url?.startsWith('http') ? 'noopener noreferrer' : undefined}>
                    <span className="sgr-content-row__icon is-edutainment"><FiLayers aria-hidden /></span>
                    <span><strong>{item.title}</strong><small>{item.subtitle || relativeTime(item.time)}</small></span>
                  </a>
                )) : <p className="sgr-panel-empty">Fun study content lands here.</p>}
              </div>
            </PanelSection>

            <PanelSection id="media" title="Media" count={groupContent.media.length} expanded={expandedPanelSections.media} onToggle={togglePanelSection}>
              <div className="sgr-media-grid">
                {visibleItems(groupContent.media, 'media').length ? visibleItems(groupContent.media, 'media').map((item) => {
                  const url = resolveUploadUrl(item.url);
                  return (
                    <a className="sgr-media-tile" href={url} target="_blank" rel="noopener noreferrer" key={item.id} title={item.name}>
                      {String(item.mime_type || '').startsWith('image/') ? <img src={url} alt={item.name} /> : <FiImage aria-hidden />}
                    </a>
                  );
                }) : <p className="sgr-panel-empty">Sent media will collect here.</p>}
              </div>
            </PanelSection>

            <PanelSection id="files" title="Files" count={groupContent.files.length} expanded={expandedPanelSections.files} onToggle={togglePanelSection}>
              <div className="sgr-content-list">
                {visibleItems(groupContent.files, 'files').length ? visibleItems(groupContent.files, 'files').map((item) => (
                  <a className="sgr-content-row" href={resolveUploadUrl(item.url)} key={item.id} target="_blank" rel="noopener noreferrer" download={item.name}>
                    <span className="sgr-content-row__icon is-file"><FiFileText aria-hidden /></span>
                    <span><strong>{item.name}</strong><small>{fileSize(item.size) || relativeTime(item.time)}</small></span>
                  </a>
                )) : <p className="sgr-panel-empty">Documents and files will show here.</p>}
              </div>
            </PanelSection>

            <div className="sgr-info-panel-footer">
              <button
                type="button"
                className="sgr-leave-group-btn"
                onClick={handleLeaveGroup}
                disabled={leavingGroup}
              >
                {leavingGroup ? 'Leaving…' : 'Leave group'}
              </button>
            </div>
          </aside>

          {isChatMobileOverlayLayout && (showMembersPanel || showInfoPanel) ? (
            <button
              type="button"
              className="sgr-panel-outside-dismiss"
              aria-label="Close side panel"
              onClick={dismissMobileSidePanels}
            />
          ) : null}
        </main>
      )}
    </div>
  );
}
