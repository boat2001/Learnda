import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CommunityChatTimeline from './forum/ChatTimeline';
import CommunityMessageBubble, { FileAttachmentCommunity } from './forum/MessageBubble';
import PanelSection from './forum/PanelSection';
import {
  communityPanelsOpenByLayoutDefault, isCommunityChatMobileOverlay,
  COMMUNITY_DESKTOP_SIDE_PANELS_MQ,
  messageTimestamp, formatRecordingTime, fileSize, formatMessageTime,
  messageTimeTitle, communityMessageAuthorId, localDayKey,
  chatDayDividerLabel, getEmojiOnlyClusterCount, emojiBubbleTierFromCount,
  renderMessageBody,
} from './forum/helpers';
import { useAnalyticsWithContext } from '../hooks/useAnalytics';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiAward,
  FiBookOpen,
  FiChevronDown,
  FiCpu,
  FiExternalLink,
  FiImage,
  FiInfo,
  FiLayers,
  FiMessageSquare,
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
import { useAuth } from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import useChatSidePanelMobileLayout, { CHAT_SIDE_PANEL_MOBILE_MQ } from '../hooks/useChatSidePanelMobileLayout';
import api, { resolveUploadUrl } from '../services/api';
import AuthModal from '../components/auth/AuthModal';
import { LearndaChatBackdrop } from '../components/common/LearndaChatBackdrop';
import { lockBodyScroll } from '../utils/bodyScrollLock';
import {
  canRequestMicrophone,
  getMicrophoneErrorMessage,
  getVoiceRecorderConfig,
} from '../utils/voiceRecording';
import {
  getStoredThemePreference,
  resolveThemePreference,
  saveThemePreference,
} from '../utils/theme';
import { playUiSound } from '../utils/uiSounds';
import './Forum.css';
import './PLS/StudyGroupRoom.css';

const POLL_INTERVAL_MS = 10_000;
const COMMUNITY_MSG_MAX_LEN = 2000;
const COMMUNITY_MSG_COUNT_FROM = 1600;
const PANEL_PREVIEW_LIMIT = 5;

const EXTERNAL_URL_RE = /https?:\/\/[^\s]+|www\.[a-zA-Z0-9.-]+\.[a-z]{2,}[^\s]*/i;

const QUICK_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '🤣', '😂', '🙂', '😉', '😊',
  '😍', '🥰', '😘', '😋', '🤪', '🤔', '😎', '🤩', '🥳', '😤',
  '😢', '😭', '😱', '🤯', '😴', '🤓', '🧐', '🙃', '😐', '😏',
  '🙏', '👍', '👎', '👏', '🙌', '🤝', '💪', '👌', '✌️', '🫶',
  '🔥', '💡', '⭐', '✨', '🎯', '📚', '✅', '❌', '❤️', '🧠',
];

export default function Forum() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trackEvent } = useAnalyticsWithContext();

  const communityType = searchParams.get('type') || 'global';
  const isCollegeCommunity = communityType === 'college';
  const collegeShortName = user?.institution ? String(user.institution).split(',')[0].trim() : null;

  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const [chatTheme, setChatTheme] = useState(() => resolveThemePreference(getStoredThemePreference()));

  const handleThemeToggle = useCallback(() => {
    const nextPreference = chatTheme === 'dark' ? 'light' : 'dark';
    const { preference, resolved } = saveThemePreference(nextPreference);
    setThemePreference(preference);
    setChatTheme(resolved);
  }, [chatTheme]);

  useEffect(() => {
    const resolved = resolveThemePreference(themePreference);
    setChatTheme((prev) => (prev === resolved ? prev : resolved));
  }, [themePreference]);

  const [messages, setMessages] = useState([]);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [roomLoading, setRoomLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [composerStatus, setComposerStatus] = useState('');
  const [toast, setToast] = useState({ text: '', type: 'info' });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const [attachedFile, setAttachedFile] = useState(null);
  const [attachPreviewUrl, setAttachPreviewUrl] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [showMembersPanel, setShowMembersPanel] = useState(() => communityPanelsOpenByLayoutDefault());
  const [showInfoPanel, setShowInfoPanel] = useState(() => communityPanelsOpenByLayoutDefault());
  const isChatMobileOverlayLayout = useChatSidePanelMobileLayout();
  const [expandedPanelSections, setExpandedPanelSections] = useState({
    members: false,
    media: false,
    links: false,
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [authOnboardingStep, setAuthOnboardingStep] = useState(null);

  const listEndRef = useRef(null);
  const composerTextareaRef = useRef(null);
  const seenCommunityMessageIdsRef = useRef(null);

  usePageTitle('Community Forum');

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    return lockBodyScroll();
  }, []);

  useEffect(() => {
    const handleOpenAuthModal = (event) => {
      const detail = event?.detail;
      const nextMode = typeof detail === 'string' ? detail : detail?.mode || 'login';
      const nextOnboarding =
        typeof detail === 'object' && detail ? detail.forceOnboardingStep || null : null;
      setAuthModalMode(nextMode === 'register' ? 'register' : 'login');
      setAuthOnboardingStep(nextOnboarding);
      setShowAuthModal(true);
    };
    window.addEventListener('openAuthModal', handleOpenAuthModal);
    return () => window.removeEventListener('openAuthModal', handleOpenAuthModal);
  }, []);

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

  const loadRoom = useCallback(async () => {
    setLoadError('');
    try {
      const response = await api.community.getChatRoom({ limit: 50_000 });
      if (!Array.isArray(response?.messages)) {
        throw new Error(response?.error || 'Unable to load community chat.');
      }
      setMessages(response.messages);
      setTotalMessageCount(Number(response.message_count_total) || response.messages.length);
    } catch (e) {
      setLoadError(e?.message || 'Unable to load community chat.');
      setMessages([]);
    } finally {
      setRoomLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (roomLoading) return undefined;
    const t = window.setInterval(loadRoom, POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [roomLoading, loadRoom]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (!messages.length) {
      seenCommunityMessageIdsRef.current = null;
      return;
    }
    const idSet = new Set(messages.map((m) => (m?.id != null ? String(m.id) : '')).filter(Boolean));
    if (!seenCommunityMessageIdsRef.current) {
      seenCommunityMessageIdsRef.current = idSet;
      return;
    }
    const prev = seenCommunityMessageIdsRef.current;
    const added = messages.filter((m) => m?.id != null && !prev.has(String(m.id)));
    seenCommunityMessageIdsRef.current = idSet;
    if (!added.length) return;
    const mine = String(user.id);
    if (added.some((m) => communityMessageAuthorId(m) && communityMessageAuthorId(m) !== mine)) {
      playUiSound('communityMessage');
    }
  }, [messages, isAuthenticated, user?.id]);

  const togglePanelSection = useCallback((id) => {
    setExpandedPanelSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleMembersPanel = useCallback(() => {
    setShowMembersPanel((v) => {
      const next = !v;
      if (next && isCommunityChatMobileOverlay()) setShowInfoPanel(false);
      return next;
    });
  }, []);

  const toggleInfoPanel = useCallback(() => {
    setShowInfoPanel((v) => {
      const next = !v;
      if (next && isCommunityChatMobileOverlay()) setShowMembersPanel(false);
      return next;
    });
  }, []);

  const dismissMobileSidePanels = useCallback(() => {
    setShowMembersPanel(false);
    setShowInfoPanel(false);
  }, []);

  const visibleItems = (items, key) =>
    expandedPanelSections[key] ? items : items.slice(0, PANEL_PREVIEW_LIMIT);

  const allMembers = useMemo(() => {
    const byId = new Map();
    [...messages].reverse().forEach((message) => {
      const author = message.author || {};
      const id = String(author.id || '');
      if (!id || byId.has(id)) return;
      const online =
        Number.isFinite(new Date(messageTimestamp(message)).getTime()) &&
        Date.now() - new Date(messageTimestamp(message)).getTime() < 5 * 60 * 1000;
      byId.set(id, {
        id,
        name: author.full_name || 'Student',
        role: 'member',
        avatar_url: author.avatar_url || null,
        online,
      });
    });
    if (user?.id && !byId.has(String(user.id))) {
      byId.set(String(user.id), {
        id: String(user.id),
        name: user.full_name || 'You',
        role: 'member',
        avatar_url: user.avatar_url || null,
        online: true,
      });
    }
    return Array.from(byId.values()).sort(
      (a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name),
    );
  }, [messages, user]);

  const onlineCount = allMembers.filter((m) => m.online).length;

  const scrapedLinks = useMemo(() => {
    const urlRe = /\b(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"[\]】]*)/gi;
    const seen = new Set();
    const out = [];
    [...messages].reverse().forEach((message) => {
      const raw = message.body || '';
      let match = urlRe.exec(raw);
      while (match !== null) {
        const url = match[0].replace(/[,.)]}]+$/, '');
        if (url.startsWith('http') && !seen.has(url)) {
          seen.add(url);
          const lower = url.toLowerCase();
          let kind = 'link';
          if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(lower)) kind = 'image';
          if (youtubeHost(lower)) kind = 'video';
          out.push({
            id: `${message.id}-${url}`,
            url,
            title: truncateUrl(url),
            author: message.author?.full_name,
            kind,
            time: messageTimestamp(message),
          });
        }
        match = urlRe.exec(raw);
      }
    });
    return out;
  }, [messages]);

  const quickLinks = useMemo(
    () => [
      { id: 'groups', title: 'Study groups', subtitle: 'Course chat spaces', url: '/groups', icon: 'layers' },
      { id: 'learn', title: 'Learn', subtitle: 'Courses & lessons', url: '/learn', icon: 'book' },
      { id: 'practice', title: 'Practice', subtitle: 'Quiz yourself', url: '/practice', icon: 'cpu' },
      { id: 'resources', title: 'Resources', subtitle: 'Files & materials', url: '/resources', icon: 'layers' },
    ],
    [],
  );

  const leaveCommunity = () => navigate('/');

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
        const room = Math.max(0, COMMUNITY_MSG_MAX_LEN - prev.length + selectedLen);
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
    if (!isAuthenticated || voiceBusy || sending) return;
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
      mr.ondataavailable = (ev) => {
        if (ev.data?.size) chunksRef.current.push(ev.data);
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
          const res = await api.community.postChatVoiceMessage(fd);
          if (res?.success && res.message) {
            setMessages((prev) => [...prev, res.message]);
            playUiSound('messageSent');
            setDraft('');
          } else {
            setComposerStatus(res?.error || 'Voice upload failed.');
          }
        } catch (e) {
          setComposerStatus(e?.message || 'Voice upload failed.');
        } finally {
          setVoiceBusy(false);
          setRecording(false);
          clampComposerTextareaHeight();
        }
      };
      mr.start(200);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
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
    [],
  );

  const handleSend = async () => {
    const text = draft.replace(/\r\n/g, '\n').trim();
    const hasContent = text || attachedFile;
    if (!hasContent || !isAuthenticated || sending) return;
    setSending(true);
    setComposerStatus('');
    try {
      let messageOut = null;

      if (attachedFile) {
        const fd = new FormData();
        fd.append('file', attachedFile, attachedFile.name);
        if (text) fd.append('caption', text);
        const res = await api.community.postChatFileMessage(fd);
        if (res?.success && res.message) {
          messageOut = res.message;
        } else {
          setComposerStatus(res?.error || 'File could not be sent.');
          return;
        }
      } else {
        const res = await api.community.postChatMessage({ body: text, metadata: {} });
        if (res?.success && res.message) {
          messageOut = res.message;
        } else {
          setComposerStatus(res?.error || 'Message could not be sent.');
          return;
        }
      }

      if (messageOut) {
        setMessages((prev) => [...prev, messageOut]);
        playUiSound('messageSent');
        trackEvent('community_message_sent', {
          message_type: attachedFile ? 'file' : 'text',
          has_attachment: !!attachedFile,
        });
      }
      setDraft('');
      setShowEmoji(false);
      if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl);
      setAttachedFile(null);
      setAttachPreviewUrl(null);
    } catch (err) {
      setComposerStatus(err?.message || 'Could not send.');
    } finally {
      setSending(false);
      clampComposerTextareaHeight();
    }
  };

  const copyRoomLink = async () => {
    try {
      const url = `${window.location.origin}/forum`;
      await navigator.clipboard.writeText(url);
      setToast({ text: 'Community link copied.', type: 'success' });
    } catch {
      setToast({ text: 'Could not copy link.', type: 'error' });
    }
  };

  useEffect(() => {
    if (!toast.text) return undefined;
    const t = window.setTimeout(() => setToast({ text: '', type: 'info' }), 3200);
    return () => window.clearTimeout(t);
  }, [toast.text]);

  if (loadError && !roomLoading && messages.length === 0) {
    return (
      <>
        <div
          className={`sgr-shell sgr-shell--error theme-${chatTheme}`}
          data-theme-aware="true"
          data-theme={chatTheme}
        >
          <button type="button" className="sgr-back-btn" onClick={leaveCommunity}>
            <FiArrowLeft aria-hidden /> Back to Learnda
          </button>
          <div className="sgr-error-pane">
            <h1>Something went wrong</h1>
            <p>{loadError}</p>
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setAuthOnboardingStep(null);
          }}
          initialMode={authModalMode}
          forceOnboardingStep={authOnboardingStep}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`sgr-shell theme-${chatTheme}`}
        data-theme-aware="true"
        data-theme={chatTheme}
      >
        <header className="sgr-topbar">
          <button type="button" className="sgr-back-btn" onClick={leaveCommunity} aria-label="Back to Learnda">
            <FiArrowLeft aria-hidden />
          </button>

          <button
            type="button"
            className={`sgr-panel-toggle sgr-panel-toggle--members ${showMembersPanel ? 'is-active' : ''}`}
            onClick={toggleMembersPanel}
            aria-label="Toggle recently active members"
            aria-expanded={showMembersPanel}
            title="Members"
          >
            <FiUsers aria-hidden />
          </button>

          <div className="sgr-topbar__main">
            <p className="sgr-topbar__eyebrow">{isCollegeCommunity ? `${collegeShortName || 'College'} · campus community` : 'All students · one space'}</p>
            <h1 className="sgr-topbar__title">Community Forum</h1>
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

            <button
              type="button"
              className={`sgr-panel-toggle sgr-panel-toggle--info ${showInfoPanel ? 'is-active' : ''}`}
              onClick={toggleInfoPanel}
              aria-label="Toggle community info"
              aria-expanded={showInfoPanel}
              title="Community info"
            >
              <FiInfo aria-hidden />
            </button>
          </div>
        </header>

        {toast.text ? (
          <div className={`forum-toast forum-toast--${toast.type}`} role="status">
            <FiAlertCircle aria-hidden /> {toast.text}
            <button type="button" className="forum-toast__close" onClick={() => setToast({ text: '', type: 'info' })} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}

        <main
          className={`sgr-stage ${showMembersPanel ? 'sgr-stage--members-open' : ''} ${showInfoPanel ? 'sgr-stage--info-open' : ''}`}
        >
          <aside
            className={`sgr-side-panel sgr-side-panel--members ${showMembersPanel ? 'is-open' : ''}`}
            aria-label="Community members"
          >
            <header className="sgr-side-panel__head">
              <div>
                <span className="sgr-side-panel__eyebrow">Community</span>
                <h2>Members</h2>
              </div>
              <button
                type="button"
                className="sgr-side-panel__close"
                onClick={() => setShowMembersPanel(false)}
                aria-label="Close members panel"
              >
                <FiX aria-hidden />
              </button>
            </header>
            <div className="sgr-members-summary">
              <span>
                <strong>{onlineCount}</strong> active now
              </span>
              <span>
                <strong>{allMembers.length}</strong> in chat
              </span>
            </div>
            <PanelSection
              id="members"
              title="Recently seen"
              count={allMembers.length}
              expanded={expandedPanelSections.members}
              onToggle={togglePanelSection}
            >
              <div className="sgr-member-list">
                {visibleItems(allMembers, 'members').map((member) => (
                  <div className="sgr-member-row" key={member.id}>
                    <span className="sgr-member-row__avatar" aria-hidden>
                      {member.avatar_url ? (
                        <img src={resolveUploadUrl(member.avatar_url)} alt="" />
                      ) : (
                        member.name.slice(0, 1).toUpperCase()
                      )}
                      <span className={`sgr-member-row__presence ${member.online ? 'is-online' : ''}`} />
                    </span>
                    <span className="sgr-member-row__text">
                      <strong>{String(member.id) === String(user?.id) ? 'You' : member.name}</strong>
                      <small>{member.online ? 'Active now' : 'Student'}</small>
                    </span>
                  </div>
                ))}
              </div>
            </PanelSection>
          </aside>

          <section className="sgr-chat" aria-label="Community chat">
            <LearndaChatBackdrop patternSeed="community-forum-chat" />
            <div className="sgr-chat__messages">
              {roomLoading ? (
                <div className="sgr-chat__empty">
                  <p>Loading messages…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="sgr-chat__empty">
                  <p>No messages yet — say hi and help someone out today.</p>
                </div>
              ) : (
                <CommunityChatTimeline messages={messages} userId={user?.id} />
              )}
              <div ref={listEndRef} />
            </div>

            <div className="sgr-composer">
              {isAuthenticated && recording ? (
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
                    onClick={() => {
                      stopRecordingTimer();
                      stopStream();
                      setRecording(false);
                      setRecordingSeconds(0);
                    }}
                    aria-label="Cancel recording"
                  >
                    <FiX />
                  </button>
                </div>
              ) : null}

              {isAuthenticated && attachedFile && !recording ? (
                <div className="sgr-attach-preview">
                  {attachPreviewUrl ? (
                    <img src={attachPreviewUrl} alt={attachedFile.name} className="sgr-attach-preview__thumb" />
                  ) : (
                    <span className="sgr-attach-preview__icon" aria-hidden>
                      <FiPaperclip />
                    </span>
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

              {isAuthenticated && showEmoji ? (
                <div className="sgr-emoji-panel" role="listbox" aria-label="Quick emoji">
                  {QUICK_EMOJIS.map((e, emojiIndex) => (
                    <button key={`${emojiIndex}-${e}`} type="button" className="sgr-emoji-btn" onClick={() => appendEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              ) : null}

              <p id="community-composer-hint" className="sgr-sr-only">
                Send with Enter on desktop or Control Enter. New line: Shift Enter.
              </p>

              {isAuthenticated ? (
                <>
                  <div className="sgr-composer__row">
                    <button
                      type="button"
                      className={`sgr-tool sgr-tool--mic ${recording ? 'is-recording' : ''}`}
                      onClick={recording ? stopRecording : startRecording}
                      disabled={voiceBusy || sending}
                      aria-label={recording ? 'Stop and send voice note' : 'Record voice note'}
                      title={recording ? 'Stop recording' : 'Voice note'}
                    >
                      {recording ? <FiSquare /> : <FiMic />}
                    </button>

                    <div className="sgr-composer__field forum-composer__field">
                      <textarea
                        ref={composerTextareaRef}
                        id="community-composer-message"
                        className="sgr-input"
                        name="community_chat_message"
                        rows={1}
                        maxLength={COMMUNITY_MSG_MAX_LEN}
                        spellCheck
                        autoCapitalize="sentences"
                        autoCorrect="on"
                        autoComplete="off"
                        enterKeyHint="send"
                        inputMode="text"
                        aria-label="Community message"
                        aria-describedby="community-composer-hint"
                        title="Enter sends (desktop); Shift+Enter newline; Ctrl or ⌘+Enter always sends"
                        placeholder="Message everyone…"
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
                  ) : draft.length >= COMMUNITY_MSG_COUNT_FROM ? (
                    <p
                      className={`sgr-composer__char-hint ${draft.length >= COMMUNITY_MSG_MAX_LEN - 200 ? 'is-near-limit' : ''}`}
                      aria-live="polite"
                    >
                      {draft.length >= COMMUNITY_MSG_MAX_LEN - 60
                        ? `${(COMMUNITY_MSG_MAX_LEN - draft.length).toLocaleString()} characters left`
                        : `${draft.length.toLocaleString()} / ${COMMUNITY_MSG_MAX_LEN.toLocaleString()}`}
                    </p>
                  ) : null}
                  {composerStatus ? <p className="sgr-composer__status">{composerStatus}</p> : null}
                </>
              ) : (
                <div className="community-chat-guest">
                  <FiMessageSquare aria-hidden />
                  <p>Sign in to join the conversation.</p>
                  <button
                    type="button"
                    className="sgr-primary-btn"
                    onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }))}
                  >
                    Sign in
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside
            className={`sgr-side-panel sgr-side-panel--info ${showInfoPanel ? 'is-open' : ''}`}
            aria-label="Community information"
          >
            <header className="sgr-side-panel__head">
              <div>
                <span className="sgr-side-panel__eyebrow">About this space</span>
                <h2>Community</h2>
              </div>
              <button
                type="button"
                className="sgr-side-panel__close"
                onClick={() => setShowInfoPanel(false)}
                aria-label="Close info panel"
              >
                <FiX aria-hidden />
              </button>
            </header>

            <div className="forum-info-stats">
              <span>
                <strong>{totalMessageCount.toLocaleString()}</strong> messages
              </span>
              <span>
                <strong>{allMembers.length}</strong> students here
              </span>
            </div>

            <button type="button" className="forum-info-copy" onClick={copyRoomLink}>
              Copy community link
            </button>

            <PanelSection
              id="media"
              title="Links & media from chat"
              count={scrapedLinks.length}
              expanded={expandedPanelSections.media}
              onToggle={togglePanelSection}
            >
              {scrapedLinks.length === 0 ? (
                <p className="forum-panel-empty">When people share URLs, they will show up here.</p>
              ) : (
                <ul className="forum-link-list">
                  {visibleItems(scrapedLinks, 'media').map((item) => (
                    <li key={item.id}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="forum-link-row">
                        {item.kind === 'image' ? <FiImage aria-hidden /> : item.kind === 'video' ? <FiLayers aria-hidden /> : <FiExternalLink aria-hidden />}
                        <span>{item.title}</span>
                      </a>
                      {item.author ? <small className="forum-link-meta">Shared by {item.author}</small> : null}
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>

            <PanelSection
              id="links"
              title="Shortcuts"
              count={quickLinks.length}
              expanded={expandedPanelSections.links}
              onToggle={togglePanelSection}
            >
              <div className="forum-shortcuts">
                {visibleItems(quickLinks, 'links').map((item) => (
                  <button key={item.id} type="button" className="forum-shortcut" onClick={() => navigate(item.url)}>
                    <span className="forum-shortcut__icon" aria-hidden>
                      {item.icon === 'cpu' ? <FiCpu /> : item.icon === 'book' ? <FiBookOpen /> : <FiLayers />}
                    </span>
                    <span className="forum-shortcut__text">
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                  </button>
                ))}
              </div>
            </PanelSection>

            <div className="forum-tip">
              <FiUsers aria-hidden />
              <p>
                Use voice notes, files, and emoji here — or join a study group for course-specific chat.
              </p>
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
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setAuthOnboardingStep(null);
        }}
        initialMode={authModalMode}
        forceOnboardingStep={authOnboardingStep}
      />
    </>
  );
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}`;
    let s = `${u.hostname}${path.length > 36 ? `${path.slice(0, 18)}…` : path}`;
    if (s.length > 52) s = `${s.slice(0, 50)}…`;
    return s;
  } catch {
    return url.length > 52 ? `${url.slice(0, 50)}…` : url;
  }
}

function youtubeHost(lowerUrl) {
  return /youtube\.com|youtu\.be/.test(lowerUrl);
}
