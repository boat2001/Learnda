import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBookmark,
  FiCheck,
  FiCheckCircle,
  FiCoffee,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiEdit3,
  FiEye,
  FiHeart,
  FiMessageSquare,
  FiMoreHorizontal,
  FiMoreVertical,
  FiMoon,
  FiSend,
  FiShare2,
  FiSun,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import { useContent } from '../../hooks/useContent';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useGamification } from '../../hooks/useGamification';
import { usePLS } from '../../hooks/usePLS';
import usePageTitle from '../../hooks/usePageTitle';
import UpgradePrompt from '../../components/subscription/UpgradePrompt';
import FeatureLockModal from '../../components/subscription/FeatureLockModal';
import UpgradeModalHost from '../../components/subscription/UpgradeModalHost';
import AuthModal from '../../components/auth/AuthModal';
import ShareToStudyGroupModal from '../../components/studyGroups/ShareToStudyGroupModal';
import ShareToCommunityModal from '../../components/community/ShareToCommunityModal';
import ConfettiOverlay from '../../components/gamification/ConfettiOverlay';
import LessonIllustration from '../../components/content/LessonIllustration';
import ProgressLeaderboardDrawer from '../ProgressLeaderboardDrawer';
import { consumeGuestContentView, buildGuestLimitMessage } from '../../utils/guestContentAccess';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { buildCoursePath } from '../../utils/courseRouting';
import { ONBOARDING_STEPS } from '../../utils/onboarding';
import { loadRegistrationDraft } from '../../utils/registrationDraft';
import { normalizeLessonSchema } from '../../utils/lessonSchema';
import {
  buildPrelimProgressStorageKey,
  markPrelimComplete,
} from '../../utils/prelimProgress';
import {
  isPracticePrelimLessonId,
  loadPracticePrelimPreviewLesson,
  savePracticePrelimPreviewLesson,
} from '../../utils/practicePrelimPreview';
import {
  FINAL_ASSESSMENT_PASS_PERCENT as SHARED_FINAL_ASSESSMENT_PASS_PERCENT,
  buildLessonBlocks as buildSharedLessonBlocks,
  evaluateExercise as evaluateSharedExercise,
  evaluateObjectiveSetQuestion,
  evaluateAssessmentSubmission,
  formatDurationLabel as formatSharedDurationLabel,
} from '../../utils/lessonAssessment';
import api from '../../services/api';
import {
  getStoredThemePreference,
  resolveThemePreference,
  saveThemePreference,
  subscribeToSystemThemeChange,
} from '../../utils/theme';
import { playUiSound } from '../../utils/uiSounds';
import contentService from '../../services/contentService';
import { isUuidString } from '../../utils/viewCounts';
import './LessonViewer.css';
import 'katex/dist/katex.min.css';
import LessonDiscussionModal from './LessonDiscussionModal';
import {
  DISCUSSION_CONFIG, DISCUSSION_TYPES, createEmptyDiscussionBoards,
} from './lessonDiscussion';

const CHUNK_COMPLETE_DELAY_SECONDS = 5;
const DISCUSSION_STORAGE_PREFIX = 'sharether:lesson-discussion';
const HIGHLIGHT_STORAGE_PREFIX = 'sharether:lesson-highlights';
const LESSON_STATE_VERSION = 1;
const MAX_PERSISTED_ASSESSMENT_ATTEMPTS = 6;

const POSITIVE_PARTICLES = [
  { x: 12, y: 20, dx: -18, dy: -54, delay: 0, scale: 0.72, glitter: true },
  { x: 28, y: 10, dx: -8, dy: -64, delay: 70, scale: 0.82, glitter: false },
  { x: 48, y: 18, dx: 0, dy: -70, delay: 120, scale: 0.92, glitter: true },
  { x: 66, y: 8, dx: 12, dy: -60, delay: 38, scale: 0.78, glitter: false },
  { x: 84, y: 22, dx: 22, dy: -50, delay: 98, scale: 0.68, glitter: true },
];

const NEGATIVE_PARTICLES = [
  { x: 18, y: 18, dx: -28, dy: -22, delay: 0, scale: 0.64, glitter: false },
  { x: 36, y: 12, dx: -10, dy: -34, delay: 60, scale: 0.72, glitter: true },
  { x: 52, y: 16, dx: 0, dy: -38, delay: 110, scale: 0.82, glitter: false },
  { x: 68, y: 10, dx: 16, dy: -30, delay: 45, scale: 0.76, glitter: true },
  { x: 82, y: 18, dx: 28, dy: -20, delay: 96, scale: 0.62, glitter: false },
];

const LESSON_COMPLETE_PARTICLES = [
  { x: '12%', drift: '-12px', delay: '0ms', duration: '2800ms', hue: 'orange' },
  { x: '18%', drift: '10px', delay: '120ms', duration: '2960ms', hue: 'mint' },
  { x: '24%', drift: '14px', delay: '210ms', duration: '3060ms', hue: 'gold' },
  { x: '32%', drift: '-8px', delay: '320ms', duration: '2680ms', hue: 'blue' },
  { x: '39%', drift: '8px', delay: '180ms', duration: '2920ms', hue: 'orange' },
  { x: '46%', drift: '11px', delay: '80ms', duration: '3220ms', hue: 'mint' },
  { x: '54%', drift: '-14px', delay: '470ms', duration: '2860ms', hue: 'gold' },
  { x: '61%', drift: '12px', delay: '130ms', duration: '3100ms', hue: 'blue' },
  { x: '68%', drift: '9px', delay: '260ms', duration: '3140ms', hue: 'orange' },
  { x: '75%', drift: '-9px', delay: '380ms', duration: '2760ms', hue: 'mint' },
  { x: '82%', drift: '10px', delay: '160ms', duration: '2880ms', hue: 'gold' },
  { x: '88%', drift: '13px', delay: '90ms', duration: '3000ms', hue: 'blue' },
  { x: '93%', drift: '-6px', delay: '430ms', duration: '2900ms', hue: 'orange' },
  { x: '96%', drift: '7px', delay: '250ms', duration: '2700ms', hue: 'mint' },
];

const EMPTY_COMPLETION_SUMMARY = {
  key: 0,
  headline: '',
  body: '',
  xpEarned: 0,
  rankBefore: null,
  rankAfter: null,
  nextLesson: null,
  assessmentPercent: null,
  assessmentDurationSeconds: null,
};

const getUserRankFromEntries = (entries, userId) => {
  if (!Array.isArray(entries) || !userId) return null;

  const match = entries.find((entry) =>
    Boolean(entry?.is_current_user) || String(entry?.user_id || entry?.userId || '') === String(userId)
  );

  const rank = Number(match?.rank);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const safeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// LessonParagraph — renders HTML content (rich text, math via KaTeX)
// ---------------------------------------------------------------------------
let _katexAutoRender = null;
const getKatexAutoRender = () => {
  if (_katexAutoRender) return Promise.resolve(_katexAutoRender);
  return import('katex/dist/contrib/auto-render').then((mod) => {
    _katexAutoRender = mod.default || mod;
    return _katexAutoRender;
  }).catch(() => null);
};

const MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
];

let DOMPurify = null;
const getDOMPurify = () => {
  if (DOMPurify) return DOMPurify;
  try {
    // eslint-disable-next-line no-undef
    DOMPurify = window.DOMPurify || require('dompurify');
  } catch {
    DOMPurify = { sanitize: (h) => h };
  }
  return DOMPurify;
};

const isHtmlContent = (text) => /<[a-zA-Z]/.test(text);

const LessonParagraph = ({ html, highlights, chunkId }) => {
  const ref = useRef(null);
  const isHtml = isHtmlContent(html || '');

  useLayoutEffect(() => {
    if (!ref.current) return;
    getKatexAutoRender().then((renderMathInElement) => {
      if (renderMathInElement && ref.current) {
        try {
          renderMathInElement(ref.current, {
            delimiters: MATH_DELIMITERS,
            throwOnError: false,
            output: 'htmlAndMathml',
          });
        } catch {
          // KaTeX render failed silently
        }
      }
    });
  }, [html]);

  if (isHtml) {
    const purify = getDOMPurify();
    const clean = purify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'sup', 'sub', 'mark', 'span', 'div', 'a',
      ],
      ALLOWED_ATTR: ['href', 'class', 'style', 'target', 'rel'],
    });
    return (
      <div
        ref={ref}
        className="lesson-paragraph-html"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  return (
    <p ref={ref}>
      {renderTextWithHighlights(html, highlights, chunkId)}
    </p>
  );
};
// ---------------------------------------------------------------------------

const isPlainRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeNumberRecord = (value) => Object.entries(isPlainRecord(value) ? value : {}).reduce((accumulator, [key, entry]) => {
  const normalizedKey = safeText(key);
  if (!normalizedKey) return accumulator;
  accumulator[normalizedKey] = Math.max(0, toFiniteNumber(entry, 0));
  return accumulator;
}, {});

const normalizeStringRecord = (value) => Object.entries(isPlainRecord(value) ? value : {}).reduce((accumulator, [key, entry]) => {
  const normalizedKey = safeText(key);
  if (!normalizedKey) return accumulator;
  accumulator[normalizedKey] = typeof entry === 'string' ? entry : String(entry ?? '');
  return accumulator;
}, {});

const normalizeBooleanRecord = (value) => Object.entries(isPlainRecord(value) ? value : {}).reduce((accumulator, [key, entry]) => {
  const normalizedKey = safeText(key);
  if (!normalizedKey || !entry) return accumulator;
  accumulator[normalizedKey] = true;
  return accumulator;
}, {});

const sanitizePersistedAssessmentResult = (value) => {
  if (!isPlainRecord(value)) return null;

  const totalQuestions = Math.max(0, toFiniteNumber(value.totalQuestions ?? value.total_questions, 0));
  return {
    key: Math.max(0, toFiniteNumber(value.key, Date.now())),
    passed: Boolean(value.passed),
    correctCount: Math.max(0, toFiniteNumber(value.correctCount ?? value.correct_count, 0)),
    totalQuestions,
    percentScore: clamp(toFiniteNumber(value.percentScore ?? value.percent_score, 0), 0, 100),
    durationSeconds: Math.max(0, toFiniteNumber(value.durationSeconds ?? value.duration_seconds, 0)),
    evaluations: Array.isArray(value.evaluations) ? value.evaluations : [],
  };
};

const sanitizePersistedAssessmentAttempt = (value, fallbackIndex = 0) => {
  const result = sanitizePersistedAssessmentResult(value);
  if (!result) return null;

  return {
    key: result.key || Date.now() + fallbackIndex,
    passed: result.passed,
    correctCount: result.correctCount,
    totalQuestions: result.totalQuestions,
    percentScore: result.percentScore,
    durationSeconds: result.durationSeconds,
    submittedAt: safeText(value?.submittedAt ?? value?.submitted_at) || null,
  };
};

const normalizeChunkFeedbackRecord = (value) => Object.entries(isPlainRecord(value) ? value : {}).reduce((accumulator, [key, entry]) => {
  const normalizedKey = safeText(key);
  if (!normalizedKey || !isPlainRecord(entry)) return accumulator;
  accumulator[normalizedKey] = {
    checked: Boolean(entry.checked),
    correct: Boolean(entry.correct),
    explanation: safeText(entry.explanation),
    expectedAnswer: safeText(entry.expectedAnswer ?? entry.expected_answer),
    response: typeof entry.response === 'string' ? entry.response : String(entry.response ?? ''),
    points: Math.max(0, toFiniteNumber(entry.points, 0)),
  };
  return accumulator;
}, {});

const sanitizePersistedNextLesson = (value) => {
  const id = safeText(value?.id);
  if (!id) return null;

  const lessonNumber = toFiniteNumber(value?.lessonNumber ?? value?.lesson_number, 0);
  const title = safeText(value?.title || value?.lessonTitle);
  return {
    id,
    lessonNumber: lessonNumber > 0 ? lessonNumber : null,
    title: title || null,
  };
};

const sanitizePersistedCompletionSummary = (value) => {
  if (!isPlainRecord(value)) return null;

  const rankBefore = toFiniteNumber(value.rankBefore ?? value.rank_before, NaN);
  const rankAfter = toFiniteNumber(value.rankAfter ?? value.rank_after, NaN);
  const assessmentPercent = toFiniteNumber(value.assessmentPercent ?? value.assessment_percent, NaN);
  const assessmentDurationSeconds = toFiniteNumber(
    value.assessmentDurationSeconds ?? value.assessment_duration_seconds,
    NaN
  );

  return {
    key: Math.max(0, toFiniteNumber(value.key, 0)),
    headline: safeText(value.headline),
    body: safeText(value.body),
    xpEarned: Math.max(0, toFiniteNumber(value.xpEarned ?? value.xp_earned, 0)),
    rankBefore: Number.isFinite(rankBefore) && rankBefore > 0 ? rankBefore : null,
    rankAfter: Number.isFinite(rankAfter) && rankAfter > 0 ? rankAfter : null,
    nextLesson: sanitizePersistedNextLesson(value.nextLesson ?? value.next_lesson),
    assessmentPercent: Number.isFinite(assessmentPercent) ? clamp(assessmentPercent, 0, 100) : null,
    assessmentDurationSeconds: Number.isFinite(assessmentDurationSeconds)
      ? Math.max(0, assessmentDurationSeconds)
      : null,
  };
};

const extractPersistedLessonState = (lesson) => {
  const userEngagement = isPlainRecord(lesson?.user_engagement) ? lesson.user_engagement : {};
  const metadata = isPlainRecord(userEngagement.metadata) ? userEngagement.metadata : {};
  const lessonState = isPlainRecord(metadata.lesson_state)
    ? metadata.lesson_state
    : isPlainRecord(userEngagement.lesson_state)
      ? userEngagement.lesson_state
      : null;

  if (!lessonState && !userEngagement.completed && !userEngagement.completion_summary) {
    return null;
  }

  const finalAssessment = isPlainRecord(lessonState?.final_assessment)
    ? lessonState.final_assessment
    : isPlainRecord(metadata.final_assessment)
      ? metadata.final_assessment
      : isPlainRecord(userEngagement.final_assessment)
        ? userEngagement.final_assessment
        : {};
  const completionSummary = sanitizePersistedCompletionSummary(
    lessonState?.completion_summary ||
      metadata.completion_summary ||
      userEngagement.completion_summary
  );

  return {
    currentStageId: safeText(lessonState?.current_stage?.id || lessonState?.current_stage_id),
    currentStageKind: safeText(lessonState?.current_stage?.kind || lessonState?.current_stage_kind),
    currentStageIndex: Math.max(0, toFiniteNumber(lessonState?.current_stage?.index ?? lessonState?.current_stage_index, 0)),
    timeSpentSeconds: Math.max(
      0,
      toFiniteNumber(
        lessonState?.time_spent_seconds ??
          metadata.time_spent_seconds ??
          userEngagement.duration_seconds,
        0
      )
    ),
    contentChunkElapsed: normalizeNumberRecord(lessonState?.content_chunk_elapsed),
    chunkResponses: normalizeStringRecord(lessonState?.chunk_responses),
    chunkFeedback: normalizeChunkFeedbackRecord(lessonState?.chunk_feedback),
    visitedExerciseChunks: normalizeBooleanRecord(lessonState?.visited_exercise_chunks),
    lessonXpEarned: Math.max(0, toFiniteNumber(lessonState?.lesson_xp_earned ?? metadata.lesson_xp_earned, 0)),
    discussionBoards: normalizeDiscussionStore(
      lessonState?.discussion_boards || metadata.discussion_boards || {},
      safeText(lessonState?.current_stage?.chunk_id)
    ),
    completed: Boolean(
      lessonState?.completed ??
        metadata.completed ??
        userEngagement.completed
    ),
    finalAssessment: {
      responses: normalizeStringRecord(finalAssessment?.responses),
      result: sanitizePersistedAssessmentResult(finalAssessment?.result),
      elapsedSeconds: Math.max(0, toFiniteNumber(finalAssessment?.elapsed_seconds ?? finalAssessment?.elapsedSeconds, 0)),
      startedAtMs: Math.max(0, toFiniteNumber(finalAssessment?.started_at_ms ?? finalAssessment?.startedAtMs, 0)),
      attempts: (Array.isArray(finalAssessment?.attempts) ? finalAssessment.attempts : [])
        .map((attempt, index) => sanitizePersistedAssessmentAttempt(attempt, index))
        .filter(Boolean)
        .slice(-MAX_PERSISTED_ASSESSMENT_ATTEMPTS),
    },
    completionSummary,
  };
};

const formatOrdinal = (value) => {
  const number = Math.max(0, Number(value) || 0);
  if (!number) return '—';

  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${number}th`;
  }

  switch (number % 10) {
    case 1:
      return `${number}st`;
    case 2:
      return `${number}nd`;
    case 3:
      return `${number}rd`;
    default:
      return `${number}th`;
  }
};

const normalizeText = (value) => safeText(value).toLowerCase();

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadStoredJson = (key, fallback) => {
  if (typeof window === 'undefined' || !key) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const saveStoredJson = (key, value) => {
  if (typeof window === 'undefined' || !key) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage write failures so the lesson experience keeps working.
  }
};

const getUserKey = (user) => String(user?.id || user?.email || 'guest').trim();

const hasStoredAuthHint = () => {
  if (typeof window === 'undefined') return false;

  return ['token', 'refreshToken', 'user', 'auth-storage'].some((key) => {
    const value = window.localStorage.getItem(key);
    return value != null && String(value).trim() !== '';
  });
};

const shouldPreferRegisterPrompt = (draft) =>
  Boolean(
    draft?.registrationSession?.id ||
    draft?.registrationSession?.resume_token ||
    draft?.selectedPlanId ||
    draft?.onboardingStep ||
    draft?.profile ||
    draft?.academicSelection
  );


const normalizeDiscussionReply = (reply = {}, index = 0) => ({
  id: safeText(reply.id) || `reply-${index}`,
  body: safeText(reply.body),
  authorKey: safeText(reply.authorKey),
  authorName: safeText(reply.authorName) || 'Sharether Student',
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
    authorName: safeText(entry.authorName) || 'Sharether Student',
    authorAvatar: safeText(entry.authorAvatar) || null,
    createdAt: safeText(entry.createdAt) || new Date().toISOString(),
    likes: Math.max(0, Number(entry.likes || likedBy.length || 0)),
    likedBy,
    replies: Array.isArray(entry.replies)
      ? entry.replies.map((reply, replyIndex) => normalizeDiscussionReply(reply, replyIndex)).filter((reply) => reply.body)
      : [],
  };
};

const normalizeDiscussionBucket = (bucket = {}) => {
  const normalized = createEmptyDiscussionBoards();
  DISCUSSION_TYPES.forEach((type) => {
    normalized[type] = Array.isArray(bucket?.[type])
      ? bucket[type].map((entry, index) => normalizeDiscussionEntry(entry, index)).filter((entry) => entry.body)
      : [];
  });
  return normalized;
};

const normalizeDiscussionStore = (raw, fallbackChunkId = '') => {
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

const getLessonRole = (lesson = {}, lessonSchema = null) =>
  normalizeText(
    lessonSchema?.entity?.metadata?.lessonRole ||
      lesson?.metadata?.lesson_role ||
      lesson?.lesson_role ||
      lesson?.metadata?.content_role ||
      lesson?.content_role ||
      ''
  );

const shouldRenderIllustrationBeforeParagraph = (position, paragraphIndex) =>
  position === 'before_paragraph_0' && paragraphIndex === 0;

const shouldRenderIllustrationAfterParagraph = (position, paragraphIndex, totalParagraphs) => {
  if (position === 'between_paragraph_0_1') {
    return paragraphIndex === 0;
  }
  if (position === 'after_last_paragraph') {
    return paragraphIndex === totalParagraphs - 1;
  }
  return false;
};

const buildFallbackImage = (label, index = 0) => {
  const seeds = [
    { start: '#0b4f6c', end: '#1f8a70' },
    { start: '#7c2d12', end: '#ea580c' },
    { start: '#3b0764', end: '#9333ea' },
    { start: '#1d4ed8', end: '#06b6d4' },
  ];
  const theme = seeds[index % seeds.length];
  const title = safeText(label || 'Lesson Visual');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.start}" />
          <stop offset="100%" stop-color="${theme.end}" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" rx="48" />
      <circle cx="1240" cy="180" r="180" fill="rgba(255,255,255,0.12)" />
      <circle cx="310" cy="720" r="220" fill="rgba(255,255,255,0.08)" />
      <rect x="140" y="160" width="420" height="420" rx="56" fill="rgba(255,255,255,0.13)" />
      <text x="200" y="430" fill="#ffffff" font-size="220" font-family="Segoe UI, sans-serif" font-weight="700">S</text>
      <text x="140" y="700" fill="rgba(255,255,255,0.92)" font-size="72" font-family="Segoe UI, sans-serif" font-weight="700">${title}</text>
      <text x="140" y="772" fill="rgba(255,255,255,0.82)" font-size="34" font-family="Segoe UI, sans-serif">Illustration generated for the lesson flow</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const getCourseName = (lesson) =>
  safeText(
    lesson?.metadata?.course ||
      lesson?.course ||
      lesson?.metadata?.course_title ||
      lesson?.metadata?.course_name ||
      'Course'
  );

const renderTextWithHighlights = (text, highlights, chunkId) => {
  const chunkHighlights = highlights.filter(
    (entry) => entry?.chunkId === chunkId && safeText(entry?.text)
  );

  if (chunkHighlights.length === 0) return text;

  let nodes = [text];

  chunkHighlights.forEach((entry) => {
    const marker = safeText(entry.text);
    if (!marker) return;

    nodes = nodes.flatMap((node, nodeIndex) => {
      if (typeof node !== 'string') return [node];

      const pattern = new RegExp(escapeRegExp(marker), 'ig');
      const matches = [...node.matchAll(pattern)];
      if (matches.length === 0) return [node];

      const nextNodes = [];
      let cursor = 0;
      matches.forEach((match, matchIndex) => {
        const matchText = match[0];
        const startIndex = match.index ?? 0;
        if (startIndex > cursor) {
          nextNodes.push(node.slice(cursor, startIndex));
        }
        nextNodes.push(
          <mark key={`${entry.id}-${nodeIndex}-${matchIndex}`} className="lesson-highlight-mark">
            {matchText}
          </mark>
        );
        cursor = startIndex + matchText.length;
      });

      if (cursor < node.length) {
        nextNodes.push(node.slice(cursor));
      }

      return nextNodes;
    });
  });

  return nodes;
};

const scheduleTone = (audioContext, destination, frequency, startAt, duration, volume, type = 'sine') => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
};

export default function LessonViewer() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const previewLessonFromState = useMemo(
    () => location.state?.lessonPreview || loadPracticePrelimPreviewLesson(lessonId) || null,
    [lessonId, location.state?.lessonPreview]
  );
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guestAccessBlocked, setGuestAccessBlocked] = useState(null);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [chunkAnimKey, setChunkAnimKey] = useState(0);
  const [contentChunkElapsed, setContentChunkElapsed] = useState({});
  const [chunkResponses, setChunkResponses] = useState({});
  const [chunkFeedback, setChunkFeedback] = useState({});
  // Tracks progress through an 'objective_set' exercise's questions, answered
  // one at a time — activeSetChoice is the in-progress (unconfirmed) pick for
  // the current question, activeSetFeedback is that question's just-checked
  // right/wrong result shown before advancing to the next one.
  const [activeSetChoice, setActiveSetChoice] = useState(null);
  const [activeSetFeedback, setActiveSetFeedback] = useState(null);
  const [visitedExerciseChunks, setVisitedExerciseChunks] = useState({});
  const [assessmentResponses, setAssessmentResponses] = useState({});
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [assessmentAttempts, setAssessmentAttempts] = useState([]);
  const [assessmentElapsedSeconds, setAssessmentElapsedSeconds] = useState(0);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [discussionBoards, setDiscussionBoards] = useState({});
  const [discussionBoardsLoadedKey, setDiscussionBoardsLoadedKey] = useState('');
  const [discussionModal, setDiscussionModal] = useState('');
  const [discussionDraft, setDiscussionDraft] = useState('');
  const [discussionComposerType, setDiscussionComposerType] = useState('comment');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyTarget, setActiveReplyTarget] = useState('');
  const [likeState, setLikeState] = useState({
    liked: false,
    count: 0,
    pending: false,
  });
  const [lessonXpEarned, setLessonXpEarned] = useState(0);
  const [isLessonComplete, setIsLessonComplete] = useState(false);
  const [showCompletionFlash, setShowCompletionFlash] = useState(false);
  const [lessonCompletionSummary, setLessonCompletionSummary] = useState(EMPTY_COMPLETION_SUMMARY);
  const [animatedCompletionXp, setAnimatedCompletionXp] = useState(0);
  const [animatedCompletionRank, setAnimatedCompletionRank] = useState(null);
  const [animatedHeaderXp, setAnimatedHeaderXp] = useState(0);
  const [animatedHeaderRank, setAnimatedHeaderRank] = useState(null);
  const [animatedFeedbackPoints, setAnimatedFeedbackPoints] = useState(0);
  const [feedbackBurst, setFeedbackBurst] = useState({ key: 0, tone: 'correct' });
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(false);
  const [supportStatus, setSupportStatus] = useState('');
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const [lessonTheme, setLessonTheme] = useState(() => resolveThemePreference(getStoredThemePreference()));
  const [isLessonCompletionModalOpen, setIsLessonCompletionModalOpen] = useState(false);
  const [lessonCelebrationMode, setLessonCelebrationMode] = useState(null);
  const [assessmentCelebration, setAssessmentCelebration] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authOnboardingStep, setAuthOnboardingStep] = useState(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [isStageTopicExpanded, setIsStageTopicExpanded] = useState(false);
  const [saveToPlsState, setSaveToPlsState] = useState({
    saved: false,
    pending: false,
  });
  const [sharePending, setSharePending] = useState(false);
  const [studyGroupShareOpen, setStudyGroupShareOpen] = useState(false);
  const [communityShareOpen, setCommunityShareOpen] = useState(false);
  const [shareSubmenuOpen, setShareSubmenuOpen] = useState(false);
  const [featureLockModal, setFeatureLockModal] = useState({
    isOpen: false,
    featureLabel: 'This feature',
    requiredPlan: 'Serious Student',
    planKey: 'serious',
    message: '',
  });

  const completionAwardedRef = useRef(false);
  const baselineXpRef = useRef(null);
  const audioContextRef = useRef(null);
  const lessonLoadKeyRef = useRef('');
  const lessonImpressionLoggedRef = useRef('');
  const latestProgressRef = useRef(0);
  const latestTimeSpentRef = useRef(0);
  const latestLessonSnapshotRef = useRef(null);
  const persistedLessonHydrationKeyRef = useRef('');
  const lastBroadcastLearningProgressRef = useRef({ progressPercentage: -1, completed: false });
  const lastSavedLessonStateRef = useRef('');
  const previousHeaderXpRef = useRef(null);
  const previousHeaderRankRef = useRef(null);
  const headerXpAnimationFrameRef = useRef(null);
  const headerRankAnimationFrameRef = useRef(null);
  const feedbackPanelRef = useRef(null);
  const exercisePanelRef = useRef(null);
  const assessmentListRef = useRef(null);
  const feedbackPointsAnimationFrameRef = useRef(null);
  const assessmentResultRef = useRef(null);
  const completionBreakButtonRef = useRef(null);
  const stageTopicCollapseTimerRef = useRef(null);
  const completionAnimationFrameRef = useRef(null);
  const assessmentTimerRef = useRef(null);
  const assessmentStartedAtRef = useRef(null);

  const { user, isAuthenticated, nextStep } = useAuth();
  const { hasFeature } = useSubscription();
  const { trackEvent } = useAnalytics();
  const { getContentById, trackEngagement, likeContent } = useContent();
  const {
    xp: totalUserXp,
    addXp,
    refreshProgress,
    calculateXpFromActivity,
    leaderboard,
    leaderboardRank,
    loading: gamificationLoading,
    refreshLeaderboard,
    getUserRank
  } = useGamification();
  const { addToPLS } = usePLS();
  const lessonSchema = useMemo(
    () => normalizeLessonSchema(lesson, { requestedLessonId: lessonId }),
    [lesson, lessonId]
  );
  usePageTitle(lesson ? lessonSchema.entity.title || lesson?.title || 'Lesson' : 'Lesson');

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.scrollbarGutter;
    root.style.scrollbarGutter = 'stable';
    return () => { root.style.scrollbarGutter = prev; };
  }, []);

  const userKey = useMemo(() => getUserKey(user), [user?.id, user?.email]);
  const highlightStorageKey = useMemo(
    () => `${HIGHLIGHT_STORAGE_PREFIX}:${userKey}:${lessonId}`,
    [lessonId, userKey]
  );
  const discussionStorageKey = useMemo(() => `${DISCUSSION_STORAGE_PREFIX}:${lessonId}`, [lessonId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 861px)');
    const handleViewportChange = (event) => {
      if (event.matches) {
        setIsMobileRailOpen(false);
      }
    };

    if (mediaQuery.matches) {
      setIsMobileRailOpen(false);
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => () => {
    if (stageTopicCollapseTimerRef.current) {
      window.clearTimeout(stageTopicCollapseTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setIsStageTopicExpanded(false);
    if (stageTopicCollapseTimerRef.current) {
      window.clearTimeout(stageTopicCollapseTimerRef.current);
      stageTopicCollapseTimerRef.current = null;
    }
  }, [currentStageIndex]);

  useEffect(() => {
    setLessonCompletionSummary(EMPTY_COMPLETION_SUMMARY);
    setAnimatedCompletionXp(0);
    setAnimatedCompletionRank(null);
    setIsLessonCompletionModalOpen(false);
    setLessonCelebrationMode(null);
    setAssessmentCelebration(false);
    setAssessmentResponses({});
    setAssessmentResult(null);
    setAssessmentAttempts([]);
    setAssessmentElapsedSeconds(0);
    setVisitedExerciseChunks({});
    setChunkResponses({});
    setChunkFeedback({});
    setContentChunkElapsed({});
    setTimeSpentSeconds(0);
    setLessonXpEarned(0);
    latestProgressRef.current = 0;
    latestTimeSpentRef.current = 0;
    latestLessonSnapshotRef.current = null;
    persistedLessonHydrationKeyRef.current = '';
    lastSavedLessonStateRef.current = '';
    assessmentStartedAtRef.current = null;
    if (assessmentTimerRef.current) {
      window.clearInterval(assessmentTimerRef.current);
      assessmentTimerRef.current = null;
    }
  }, [lessonId]);

  const canAccess = !lessonSchema.entity.access.isPremium || hasFeature('premium_content');
  const isVirtualLesson = Boolean(lesson?.metadata?.virtual_lesson);

  useEffect(() => {
    if (!lesson?.id || loading || isVirtualLesson) return undefined;
    if (!isUuidString(lesson.id)) return undefined;
    const key = String(lesson.id);
    if (lessonImpressionLoggedRef.current === key) return undefined;
    lessonImpressionLoggedRef.current = key;
    contentService.trackContentView(lesson.id, { duration: 0, progress: 0 }).catch(() => null);
  }, [lesson?.id, loading, isVirtualLesson]);

  const isPrelimLesson = getLessonRole(lesson, lessonSchema) === 'prelim';
  const courseName = useMemo(
    () => (lesson ? lessonSchema.entity.course.title || getCourseName(lesson) : ''),
    [lesson, lessonSchema.entity.course.title]
  );
  const studyGroupSharePayload = useMemo(() => {
    if (!lesson) return null;
    const path =
      typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
    return {
      kind: 'lesson',
      title: lessonSchema.entity.title || lesson.title || 'Lesson',
      subtitle: courseName || undefined,
      url: path || `/learn/lesson/${lessonId}`,
    };
  }, [lesson, lessonSchema.entity.title, lessonId, courseName]);
  const resolvedLessonNumber = useMemo(
    () =>
      Number(
        lesson?.lessonNumber ||
          lesson?.lesson_number ||
          lesson?.metadata?.lesson_number ||
          lesson?.metadata?.sequence ||
          1
      ) || 1,
    [lesson?.lessonNumber, lesson?.lesson_number, lesson?.metadata?.lesson_number, lesson?.metadata?.sequence]
  );
  const prelimProgressStorageKey = useMemo(
    () =>
      buildPrelimProgressStorageKey({
        courseId:
          lessonSchema.entity.course.id ||
          location.state?.courseId ||
          location.state?.course?.id ||
          null,
        courseSlug: courseName || null,
        userKey,
      }),
    [courseName, lessonSchema.entity.course.id, location.state?.course?.id, location.state?.courseId, userKey]
  );

  const handleExpandStageTopic = () => {
    if (typeof window === 'undefined') return;
    setIsStageTopicExpanded(true);
    if (stageTopicCollapseTimerRef.current) {
      window.clearTimeout(stageTopicCollapseTimerRef.current);
    }
    stageTopicCollapseTimerRef.current = window.setTimeout(() => {
      setIsStageTopicExpanded(false);
      stageTopicCollapseTimerRef.current = null;
    }, 2600);
  };

  const handleReviewCurrentChunk = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const lessonBlocks = useMemo(() => buildSharedLessonBlocks(lesson, lessonSchema), [lesson, lessonSchema]);
  const finalAssessmentQuestions = useMemo(
    () =>
      lessonBlocks
        .filter((chunk) => chunk?.exercise)
        .map((chunk, index) => ({
          id: `${chunk.id}-final-question`,
          order: index + 1,
          chunkId: chunk.id,
          chunkOrder: chunk.order,
          chunkTitle: chunk.title,
          exercise: chunk.exercise,
        })),
    [lessonBlocks]
  );
  const stages = useMemo(
    () => {
      // Some chunks (e.g. an intro/outro with nothing testable) deliberately
      // carry no exercise — skip the exercise stage for just that chunk rather
      // than forcing a filler question onto it.
      const stageItems = lessonBlocks.flatMap((chunk) =>
        isPrelimLesson || !chunk.exercise
          ? [{ id: `${chunk.id}-content`, kind: 'content', chunk }]
          : [
              { id: `${chunk.id}-content`, kind: 'content', chunk },
              { id: `${chunk.id}-exercise`, kind: 'exercise', chunk, exercise: chunk.exercise },
            ]
      );

      if (!isPrelimLesson && finalAssessmentQuestions.length > 0) {
        stageItems.push({
          id: 'lesson-final-assessment',
          kind: 'assessment',
          title: 'Final lesson test',
          chunk: lessonBlocks[lessonBlocks.length - 1] || null,
          questions: finalAssessmentQuestions,
        });
      }

      return stageItems;
    },
    [finalAssessmentQuestions, isPrelimLesson, lessonBlocks]
  );
  const contentStageIndexes = useMemo(() => {
    const indexes = [];
    stages.forEach((stage, index) => {
      if (stage.kind === 'content') {
        indexes.push(index);
      }
    });
    return indexes;
  }, [stages]);
  const currentStage = stages[currentStageIndex] || null;
  const currentChunk = currentStage?.chunk || null;
  const currentExercise = currentStage?.exercise || null;
  // Steps are shuffled once per exercise (not per render) so the learner has
  // to actually think about the arrangement rather than see the answer key in
  // original order; memo key is the exercise id, so navigating away and back
  // re-shuffles instead of restoring the exact prior layout.
  const shuffledOrderingItems = useMemo(() => {
    if (currentExercise?.type !== 'ordering') return [];
    const items = [...(currentExercise.items || [])];
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [currentExercise?.id, currentExercise?.type]);
  const currentFeedback = currentChunk ? chunkFeedback[currentChunk.id] : null;
  const feedbackExplanationText = safeText(currentFeedback?.explanation);
  const hasFeedbackExplanation =
    Boolean(feedbackExplanationText) &&
    !/^explanation\.?$/i.test(feedbackExplanationText);
  const expectedFeedbackAnswer = safeText(currentFeedback?.expectedAnswer);
  const liveUserRank = useMemo(
    () =>
      (Number.isFinite(Number(leaderboardRank)) && Number(leaderboardRank) > 0
        ? Number(leaderboardRank)
        : null) ??
      getUserRankFromEntries(leaderboard, user?.id) ??
      getUserRank(),
    [leaderboard, leaderboardRank, getUserRank, user?.id]
  );

  const coursePath = useMemo(() => {
    const locationCoursePath = safeText(location.state?.coursePath || location.state?.fromCoursePath);
    if (locationCoursePath) return locationCoursePath;

    const courseId = safeText(
      lessonSchema.entity.course.id ||
        location.state?.courseId
    );

    if (courseName) {
      return buildCoursePath({
        title: courseName,
        id: courseId || null,
        isPreview: !courseId,
      });
    }

    return '/learn';
  }, [courseName, lessonSchema.entity.course.id, location.state]);
  const lessonFallbackLink = useMemo(() => {
    const normalizedCoursePath = safeText(coursePath);
    if (normalizedCoursePath) {
      const activeTab = normalizedCoursePath.startsWith('/pls/practice/')
        ? 'practice'
        : normalizedCoursePath.startsWith('/pls/study/')
          ? 'study'
          : safeText(location.state?.activeTab);

      return {
        to: normalizedCoursePath,
        label: normalizedCoursePath === '/learn' ? 'Back to Learn' : 'Back to Course',
        state: activeTab ? { activeTab } : undefined,
      };
    }

    return {
      to: '/learn',
      label: 'Back to Learn',
    };
  }, [coursePath, location.state?.activeTab]);
  const lessonSequence = useMemo(
    () =>
      Array.isArray(location.state?.lessonSequence)
        ? location.state.lessonSequence.filter((item) => item?.id)
        : [],
    [location.state?.lessonSequence]
  );
  const lessonEntryMode = useMemo(
    () => safeText(location.state?.lessonEntryMode).toLowerCase(),
    [location.state?.lessonEntryMode]
  );
  const nextLessonInSequence = useMemo(() => {
    if (!lessonSequence.length) return null;

    const sequenceIndex = lessonSequence.findIndex((item) => String(item.id) === String(lessonId));
    if (sequenceIndex >= 0) {
      return lessonSequence[sequenceIndex + 1] || null;
    }

    return lessonSequence.find((item) => Number(item?.lessonNumber) === resolvedLessonNumber + 1) || null;
  }, [lessonId, lessonSequence, resolvedLessonNumber]);
  const assessmentStageIndex = useMemo(
    () => stages.findIndex((stage) => stage.kind === 'assessment'),
    [stages]
  );

  const playHeaderStatTone = useCallback((variant = 'xp', emphasis = false) => {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      const startAt = audioContext.currentTime + 0.005;

      if (variant === 'rank') {
        scheduleTone(audioContext, masterGain, emphasis ? 659.25 : 523.25, startAt, 0.08, emphasis ? 0.045 : 0.03, 'triangle');
        scheduleTone(audioContext, masterGain, emphasis ? 880 : 698.46, startAt + 0.055, 0.11, emphasis ? 0.055 : 0.04, 'sine');
        return;
      }

      scheduleTone(audioContext, masterGain, emphasis ? 523.25 : 392, startAt, 0.07, emphasis ? 0.038 : 0.024, 'triangle');
      scheduleTone(audioContext, masterGain, emphasis ? 659.25 : 523.25, startAt + 0.045, 0.1, emphasis ? 0.046 : 0.03, 'sine');
    } catch (error) {
      // Ignore audio failures and keep the lesson flow responsive.
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    void refreshLeaderboard('global', 'weekly');
    return undefined;
  }, [refreshLeaderboard, user]);

  useEffect(() => {
    if (!showLeaderboardModal || !user) return undefined;
    void refreshLeaderboard('global', 'weekly');
    return undefined;
  }, [refreshLeaderboard, showLeaderboardModal, user]);

  useEffect(() => {
    if (feedbackPointsAnimationFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(feedbackPointsAnimationFrameRef.current);
      feedbackPointsAnimationFrameRef.current = null;
    }

    if (!currentFeedback?.checked) {
      setAnimatedFeedbackPoints(0);
      return undefined;
    }

    const targetPoints = Math.max(0, Number(currentFeedback.points) || 0);
    if (!targetPoints || typeof window === 'undefined') {
      setAnimatedFeedbackPoints(targetPoints);
      return undefined;
    }

    let startedAt = null;
    const duration = 520;

    const animatePoints = (timestamp) => {
      if (!startedAt) {
        startedAt = timestamp;
      }

      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setAnimatedFeedbackPoints(Math.round(targetPoints * eased));

      if (progress < 1) {
        feedbackPointsAnimationFrameRef.current = window.requestAnimationFrame(animatePoints);
        return;
      }

      feedbackPointsAnimationFrameRef.current = null;
    };

    setAnimatedFeedbackPoints(0);
    feedbackPointsAnimationFrameRef.current = window.requestAnimationFrame(animatePoints);

    return () => {
      if (feedbackPointsAnimationFrameRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(feedbackPointsAnimationFrameRef.current);
        feedbackPointsAnimationFrameRef.current = null;
      }
    };
  }, [currentChunk?.id, currentFeedback?.checked, currentFeedback?.points]);

  useEffect(() => {
    if (headerXpAnimationFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(headerXpAnimationFrameRef.current);
      headerXpAnimationFrameRef.current = null;
    }
    if (headerRankAnimationFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(headerRankAnimationFrameRef.current);
      headerRankAnimationFrameRef.current = null;
    }

    previousHeaderXpRef.current = null;
    previousHeaderRankRef.current = null;
    baselineXpRef.current = null;
    setAnimatedHeaderXp(0);
    setAnimatedHeaderRank(
      Number.isFinite(Number(liveUserRank)) && Number(liveUserRank) > 0
        ? Number(liveUserRank)
        : null
    );
  }, [lessonId]);

  useEffect(() => {
    if (headerXpAnimationFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(headerXpAnimationFrameRef.current);
      headerXpAnimationFrameRef.current = null;
    }

    if (baselineXpRef.current === null) {
      baselineXpRef.current = Math.max(0, Number(totalUserXp) || 0);
    }
    const targetXp = baselineXpRef.current + Math.max(0, Number(lessonXpEarned) || 0);
    if (previousHeaderXpRef.current === null) {
      previousHeaderXpRef.current = targetXp;
      setAnimatedHeaderXp(targetXp);
      return undefined;
    }

    const startingXp = Math.max(0, Number(previousHeaderXpRef.current) || 0);
    if (startingXp === targetXp || typeof window === 'undefined') {
      previousHeaderXpRef.current = targetXp;
      setAnimatedHeaderXp(targetXp);
      return undefined;
    }

    let startedAt = null;
    let lastSoundBucket = -1;
    const duration = 1100;

    const animateHeaderXp = (timestamp) => {
      if (!startedAt) {
        startedAt = timestamp;
      }

      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const nextXp = Math.round(startingXp + ((targetXp - startingXp) * eased));
      setAnimatedHeaderXp(nextXp);

      const soundBucket = Math.min(3, Math.floor(progress * 4));
      if (soundBucket > lastSoundBucket) {
        lastSoundBucket = soundBucket;
        playHeaderStatTone('xp', progress >= 0.99);
      }

      if (progress < 1) {
        headerXpAnimationFrameRef.current = window.requestAnimationFrame(animateHeaderXp);
        return;
      }

      previousHeaderXpRef.current = targetXp;
      headerXpAnimationFrameRef.current = null;
    };

    setAnimatedHeaderXp(startingXp);
    headerXpAnimationFrameRef.current = window.requestAnimationFrame(animateHeaderXp);

    return () => {
      if (headerXpAnimationFrameRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(headerXpAnimationFrameRef.current);
        headerXpAnimationFrameRef.current = null;
      }
    };
  }, [lessonXpEarned, playHeaderStatTone]);

  useEffect(() => {
    if (headerRankAnimationFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(headerRankAnimationFrameRef.current);
      headerRankAnimationFrameRef.current = null;
    }

    const targetRank = Number.isFinite(Number(liveUserRank)) && Number(liveUserRank) > 0
      ? Number(liveUserRank)
      : null;

    if (previousHeaderRankRef.current === null) {
      previousHeaderRankRef.current = targetRank;
      setAnimatedHeaderRank(targetRank);
      return undefined;
    }

    const startingRank = previousHeaderRankRef.current;
    if (
      startingRank === targetRank ||
      targetRank === null ||
      startingRank === null ||
      typeof window === 'undefined'
    ) {
      previousHeaderRankRef.current = targetRank;
      setAnimatedHeaderRank(targetRank);
      return undefined;
    }

    let startedAt = null;
    let lastSoundBucket = -1;
    const duration = 900;

    const animateHeaderRank = (timestamp) => {
      if (!startedAt) {
        startedAt = timestamp;
      }

      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const nextRank = Math.round(startingRank + ((targetRank - startingRank) * eased));
      setAnimatedHeaderRank(nextRank);

      const soundBucket = Math.min(2, Math.floor(progress * 3));
      if (soundBucket > lastSoundBucket) {
        lastSoundBucket = soundBucket;
        playHeaderStatTone('rank', progress >= 0.99);
      }

      if (progress < 1) {
        headerRankAnimationFrameRef.current = window.requestAnimationFrame(animateHeaderRank);
        return;
      }

      previousHeaderRankRef.current = targetRank;
      headerRankAnimationFrameRef.current = null;
    };

    setAnimatedHeaderRank(startingRank);
    headerRankAnimationFrameRef.current = window.requestAnimationFrame(animateHeaderRank);

    return () => {
      if (headerRankAnimationFrameRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(headerRankAnimationFrameRef.current);
        headerRankAnimationFrameRef.current = null;
      }
    };
  }, [liveUserRank, playHeaderStatTone]);

  useEffect(() => {
    if (!currentFeedback?.checked || currentStage?.kind !== 'exercise' || typeof window === 'undefined') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const feedbackPanel = feedbackPanelRef.current;
      if (!feedbackPanel) return;

      const targetTop = window.scrollY + feedbackPanel.getBoundingClientRect().top - 18;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [currentChunk?.id, currentFeedback?.checked, currentStage?.kind]);

  useEffect(() => {
    if (!assessmentResult?.key || currentStage?.kind !== 'assessment' || typeof window === 'undefined') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const resultPanel = assessmentResultRef.current;
      if (!resultPanel) return;

      const targetTop = window.scrollY + resultPanel.getBoundingClientRect().top - 18;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [assessmentResult?.key, currentStage?.kind]);


  useEffect(() => {
    if (currentStage?.kind !== 'exercise' || !currentChunk?.id) return;

    setVisitedExerciseChunks((previous) => {
      if (previous[currentChunk.id]) return previous;
      return {
        ...previous,
        [currentChunk.id]: true,
      };
    });
  }, [currentChunk?.id, currentStage?.kind]);

  useEffect(() => {
    const resolved = resolveThemePreference(themePreference);
    setLessonTheme((previous) => (previous === resolved ? previous : resolved));
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== 'auto') {
      return undefined;
    }

    return subscribeToSystemThemeChange(() => {
      const resolved = resolveThemePreference('auto');
      setLessonTheme((previous) => (previous === resolved ? previous : resolved));
    });
  }, [themePreference]);

  const progressPercent = useMemo(() => {
    const shouldRenderCompletedProgress =
      isLessonComplete && (lessonCompletionSummary.key > 0 || currentStage?.kind === 'assessment');
    if (shouldRenderCompletedProgress) return 100;
    if (!stages.length) return Number(lesson?.user_engagement?.progress_percentage || 0);

    const stagePartial =
      currentStage?.kind === 'content'
        ? 0.45
        : currentStage?.kind === 'assessment'
          ? assessmentResult?.passed
            ? 1
            : 0.86
        : currentFeedback?.checked
          ? 1
          : 0.62;

    const sessionPercent = Math.round(
      clamp(((currentStageIndex + stagePartial) / stages.length) * 100, 0, 100)
    );

    return Math.max(sessionPercent, Number(lesson?.user_engagement?.progress_percentage || 0));
  }, [
    assessmentResult?.passed,
    currentFeedback?.checked,
    currentStage?.kind,
    currentStageIndex,
    isLessonComplete,
    lessonCompletionSummary.key,
    lesson?.user_engagement?.progress_percentage,
    stages.length,
  ]);

  const feedbackParticles = feedbackBurst.tone === 'correct' ? POSITIVE_PARTICLES : NEGATIVE_PARTICLES;

  useEffect(() => {
    latestProgressRef.current = progressPercent;
  }, [progressPercent]);

  useEffect(() => {
    latestTimeSpentRef.current = timeSpentSeconds;
  }, [timeSpentSeconds]);

  useEffect(() => {
    latestLessonSnapshotRef.current = {
      currentStageIndex,
      currentStage,
      contentChunkElapsed,
      chunkResponses,
      chunkFeedback,
      visitedExerciseChunks,
      assessmentResponses,
      assessmentResult,
      assessmentAttempts,
      assessmentElapsedSeconds,
      assessmentStartedAtMs: assessmentStartedAtRef.current,
      lessonXpEarned,
      isLessonComplete,
      lessonCompletionSummary,
      discussionBoards,
    };
  }, [
    assessmentAttempts,
    assessmentElapsedSeconds,
    assessmentResponses,
    assessmentResult,
    chunkFeedback,
    chunkResponses,
    contentChunkElapsed,
    currentStage,
    currentStageIndex,
    discussionBoards,
    isLessonComplete,
    lessonCompletionSummary,
    lessonXpEarned,
    visitedExerciseChunks,
  ]);

  const playFeedbackTone = useCallback((variant = 'correct') => {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      const startAt = audioContext.currentTime + 0.01;

      if (variant === 'correct') {
        scheduleTone(audioContext, masterGain, 349.23, startAt, 0.16, 0.12, 'triangle');
        scheduleTone(audioContext, masterGain, 440, startAt + 0.08, 0.18, 0.12, 'sine');
        scheduleTone(audioContext, masterGain, 523.25, startAt + 0.16, 0.22, 0.14, 'sine');
        return;
      }

      if (variant === 'complete') {
        scheduleTone(audioContext, masterGain, 392, startAt, 0.18, 0.1, 'triangle');
        scheduleTone(audioContext, masterGain, 523.25, startAt + 0.08, 0.2, 0.12, 'triangle');
        scheduleTone(audioContext, masterGain, 659.25, startAt + 0.16, 0.24, 0.14, 'sine');
        scheduleTone(audioContext, masterGain, 783.99, startAt + 0.25, 0.28, 0.16, 'sine');
        return;
      }

      scheduleTone(audioContext, masterGain, 220, startAt, 0.18, 0.12, 'sawtooth');
      scheduleTone(audioContext, masterGain, 196, startAt + 0.08, 0.2, 0.1, 'triangle');
      scheduleTone(audioContext, masterGain, 174.61, startAt + 0.16, 0.24, 0.08, 'sine');
    } catch (error) {
      // Ignore audio failures and keep the lesson flow responsive.
    }
  }, []);

  const playCompletionStatTone = useCallback((variant = 'xp') => {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      const startAt = audioContext.currentTime + 0.01;

      if (variant === 'rank') {
        scheduleTone(audioContext, masterGain, 493.88, startAt, 0.12, 0.09, 'triangle');
        scheduleTone(audioContext, masterGain, 659.25, startAt + 0.07, 0.16, 0.11, 'sine');
        scheduleTone(audioContext, masterGain, 783.99, startAt + 0.15, 0.18, 0.12, 'sine');
        return;
      }

      scheduleTone(audioContext, masterGain, 392, startAt, 0.1, 0.08, 'triangle');
      scheduleTone(audioContext, masterGain, 523.25, startAt + 0.06, 0.12, 0.1, 'triangle');
      scheduleTone(audioContext, masterGain, 659.25, startAt + 0.12, 0.14, 0.11, 'sine');
    } catch (error) {
      // Ignore audio failures and keep the lesson flow responsive.
    }
  }, []);

  useEffect(() => {
    if (!lessonCompletionSummary.key) return undefined;

    if (completionAnimationFrameRef.current) {
      window.cancelAnimationFrame(completionAnimationFrameRef.current);
      completionAnimationFrameRef.current = null;
    }

    const xpTarget = Math.max(0, Number(lessonCompletionSummary.xpEarned || 0));
    const rankBefore = Number(lessonCompletionSummary.rankBefore);
    const rankAfter = Number(lessonCompletionSummary.rankAfter);
    const hasRankAnimation =
      Number.isFinite(rankBefore) &&
      rankBefore > 0 &&
      Number.isFinite(rankAfter) &&
      rankAfter > 0 &&
      rankBefore !== rankAfter;

    setAnimatedCompletionXp(0);
    setAnimatedCompletionRank(
      Number.isFinite(rankAfter) && rankAfter > 0
        ? hasRankAnimation
          ? rankBefore
          : rankAfter
        : null
    );

    let startedAt = null;
    let rankAnimationStarted = false;
    playCompletionStatTone('xp');

    const animateCompletionStats = (timestamp) => {
      if (!startedAt) {
        startedAt = timestamp;
      }

      const xpDuration = 900;
      const elapsed = timestamp - startedAt;
      const xpProgress = Math.min(1, elapsed / xpDuration);
      const xpEased = 1 - ((1 - xpProgress) ** 3);
      const nextXp = Math.round(xpTarget * xpEased);
      setAnimatedCompletionXp(nextXp);

      if (xpProgress >= 1 && hasRankAnimation) {
        if (!rankAnimationStarted) {
          rankAnimationStarted = true;
          playCompletionStatTone('rank');
        }

        const rankDuration = 700;
        const rankElapsed = Math.min(rankDuration, Math.max(0, elapsed - xpDuration + 120));
        const rankProgress = Math.min(1, rankElapsed / rankDuration);
        const rankEased = 1 - ((1 - rankProgress) ** 3);
        const animatedRank = Math.round(rankBefore + ((rankAfter - rankBefore) * rankEased));
        setAnimatedCompletionRank(animatedRank);

        if (rankProgress < 1) {
          completionAnimationFrameRef.current = window.requestAnimationFrame(animateCompletionStats);
          return;
        }
      }

      if (xpProgress < 1) {
        completionAnimationFrameRef.current = window.requestAnimationFrame(animateCompletionStats);
        return;
      }

      setAnimatedCompletionXp(xpTarget);
      setAnimatedCompletionRank(Number.isFinite(rankAfter) && rankAfter > 0 ? rankAfter : null);
      completionAnimationFrameRef.current = null;
    };

    completionAnimationFrameRef.current = window.requestAnimationFrame(animateCompletionStats);

    return () => {
      if (completionAnimationFrameRef.current) {
        window.cancelAnimationFrame(completionAnimationFrameRef.current);
        completionAnimationFrameRef.current = null;
      }
    };
  }, [
    lessonCompletionSummary.key,
    lessonCompletionSummary.rankAfter,
    lessonCompletionSummary.rankBefore,
    lessonCompletionSummary.xpEarned,
    playCompletionStatTone,
  ]);

  useEffect(() => {
    if (currentStage?.kind !== 'assessment' || assessmentResult) {
      if (assessmentTimerRef.current) {
        window.clearInterval(assessmentTimerRef.current);
        assessmentTimerRef.current = null;
      }
      return undefined;
    }

    if (!assessmentStartedAtRef.current) {
      assessmentStartedAtRef.current = Date.now();
      setAssessmentElapsedSeconds(0);
    }

    const tick = () => {
      if (!assessmentStartedAtRef.current) return;
      setAssessmentElapsedSeconds(Math.max(0, Math.round((Date.now() - assessmentStartedAtRef.current) / 1000)));
    };

    tick();
    assessmentTimerRef.current = window.setInterval(tick, 1000);

    return () => {
      if (assessmentTimerRef.current) {
        window.clearInterval(assessmentTimerRef.current);
        assessmentTimerRef.current = null;
      }
    };
  }, [assessmentResult, currentStage?.kind]);

  const triggerFeedbackBurst = useCallback((tone) => {
    setFeedbackBurst({ key: Date.now(), tone });
  }, []);

  const openAuthPrompt = useCallback((mode = 'login') => {
    setAuthMode(mode);
    setAuthOnboardingStep(null);
    setShowAuthModal(true);
  }, []);

  const resolveGuestCompletionAuthMode = useCallback(() => {
    const registrationDraft = loadRegistrationDraft();
    if (shouldPreferRegisterPrompt(registrationDraft)) {
      return 'register';
    }

    if (hasStoredAuthHint()) {
      return 'login';
    }

    return 'register';
  }, []);

  const queueGuestCompletionAuthPrompt = useCallback((modeOverride = null) => {
    if (user || typeof window === 'undefined') return;

    const nextMode = modeOverride || resolveGuestCompletionAuthMode();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openAuthModal', { detail: nextMode }));
    }, 150);
  }, [resolveGuestCompletionAuthMode, user]);

  const notifyLearningProgressUpdated = useCallback((detail = {}) => {
    if (typeof window === 'undefined') return;

    const nextProgress = Math.max(
      0,
      Math.round(toFiniteNumber(detail.progressPercentage ?? latestProgressRef.current, 0))
    );
    const nextCompleted = Boolean(detail.completed);
    const previous = lastBroadcastLearningProgressRef.current;
    if (previous.progressPercentage === nextProgress && previous.completed === nextCompleted) {
      return;
    }
    lastBroadcastLearningProgressRef.current = {
      progressPercentage: nextProgress,
      completed: nextCompleted,
    };

    window.dispatchEvent(
      new CustomEvent('sharether:learning-progress-updated', {
        detail: {
          lessonId,
          courseId: lessonSchema.entity.course.id || location.state?.courseId || null,
          progressPercentage: nextProgress,
          completed: nextCompleted,
          ...detail,
        },
      })
    );
  }, [lessonId, lessonSchema.entity.course.id, location.state?.courseId]);

  const persistCompletedPrelim = useCallback(() => {
    if (!isPrelimLesson || !prelimProgressStorageKey) return;

    const nextMap = markPrelimComplete({
      storageKey: prelimProgressStorageKey,
      prelimId: lessonId,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sharether:prelim-progress-updated', {
          detail: {
            courseId: lessonSchema.entity.course.id || location.state?.courseId || null,
            prelimId: lessonId,
            progress: nextMap,
          },
        })
      );
    }
  }, [isPrelimLesson, prelimProgressStorageKey, lessonId, lessonSchema.entity.course.id, location.state?.courseId]);

  const handleThemeToggle = () => {
    const nextPreference = lessonTheme === 'dark' ? 'light' : 'dark';
    playUiSound(nextPreference === 'dark' ? 'toggleOn' : 'toggleOff');
    const { preference, resolved } = saveThemePreference(nextPreference);
    setThemePreference(preference);
    setLessonTheme(resolved);
    trackEvent('theme_toggle', {
      theme: preference,
      applied_theme: resolved,
      context: 'lesson',
    });
  };

  const closeFeatureLockModal = useCallback(() => {
    setFeatureLockModal((previous) => ({ ...previous, isOpen: false }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const reference = params.get('reference') || params.get('trxref') || '';
    const status = String(params.get('status') || '').toLowerCase();
    const resumeOnboarding = String(params.get('resume_onboarding') || '').toLowerCase();
    const hasPaymentStatus =
      status.includes('success') ||
      status.includes('cancel') ||
      status.includes('fail') ||
      status.includes('abandon');

    const registrationDraft = loadRegistrationDraft();
    const hasRegistrationSession = Boolean(
      registrationDraft?.registrationSession?.id &&
      registrationDraft?.registrationSession?.resume_token
    );
    const shouldResumeOnboarding =
      hasRegistrationSession ||
      Boolean(registrationDraft?.onboardingStep || registrationDraft?.selectedPlanId) ||
      (isAuthenticated && nextStep && nextStep !== ONBOARDING_STEPS.DONE);
    const shouldResumePlanStep = resumeOnboarding === 'plan' || reference || hasPaymentStatus;

    if (shouldResumePlanStep && shouldResumeOnboarding) {
      setAuthMode(isAuthenticated ? 'login' : 'register');
      setAuthOnboardingStep(ONBOARDING_STEPS.PLAN);
      setShowAuthModal(true);
    }
  }, [isAuthenticated, location.search, nextStep]);

  useEffect(() => {
    const handleOpenAuthModal = (event) => {
      const detail = event?.detail;
      const nextMode =
        typeof detail === 'string'
          ? detail
          : detail?.mode || 'login';
      const nextOnboardingStep =
        typeof detail === 'object' && detail
          ? detail.forceOnboardingStep || null
          : null;
      setAuthMode(nextMode === 'register' ? 'register' : 'login');
      setAuthOnboardingStep(nextOnboardingStep);
      setShowAuthModal(true);
    };

    const handleOpenFeatureLock = (event) => {
      const detail = event?.detail || {};
      setFeatureLockModal({
        isOpen: true,
        featureLabel: detail.featureLabel || 'This feature',
        requiredPlan: detail.requiredPlan || 'Serious Student',
        planKey: detail.planKey || 'serious',
        message:
          detail.message ||
          `Chip in to open up ${detail.featureLabel?.toLowerCase() || 'this feature'} — and help keep Sharether free for everyone else.`,
      });
    };

    window.addEventListener('openAuthModal', handleOpenAuthModal);
    window.addEventListener('openFeatureLockModal', handleOpenFeatureLock);

    return () => {
      window.removeEventListener('openAuthModal', handleOpenAuthModal);
      window.removeEventListener('openFeatureLockModal', handleOpenFeatureLock);
    };
  }, []);

  useEffect(() => {
    setHighlights(loadStoredJson(highlightStorageKey, []));
  }, [highlightStorageKey]);

  useEffect(() => {
    saveStoredJson(highlightStorageKey, highlights);
  }, [highlightStorageKey, highlights]);

  useEffect(() => {
    setDiscussionBoards(normalizeDiscussionStore(loadStoredJson(discussionStorageKey, {}), lessonBlocks[0]?.id || ''));
    setDiscussionBoardsLoadedKey(discussionStorageKey);
  }, [discussionStorageKey, lessonBlocks]);

  useEffect(() => {
    if (discussionBoardsLoadedKey !== discussionStorageKey) return;
    saveStoredJson(discussionStorageKey, discussionBoards);
  }, [discussionBoards, discussionBoardsLoadedKey, discussionStorageKey]);

  useEffect(() => {
    if (!supportStatus) return undefined;
    const timeoutId = window.setTimeout(() => setSupportStatus(''), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [supportStatus]);

  useEffect(() => {
    if (!feedbackBurst.key) return undefined;
    const timeoutId = window.setTimeout(() => setFeedbackBurst((previous) => ({ ...previous, key: 0 })), 900);
    return () => window.clearTimeout(timeoutId);
  }, [feedbackBurst.key]);

  useEffect(() => {
    if (!discussionModal) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setDiscussionModal('');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [discussionModal]);

  useEffect(() => {
    const activeLoadKey = `${lessonId}:${user?.id || 'guest'}`;
    if (lessonLoadKeyRef.current === activeLoadKey) {
      return undefined;
    }

    lessonLoadKeyRef.current = activeLoadKey;
    let mounted = true;

    const loadLesson = async () => {
      try {
        setLoading(true);
        setGuestAccessBlocked(null);
        setTimeSpentSeconds(0);
        setContentChunkElapsed({});
        setCurrentStageIndex(0);
        setChunkResponses({});
        setChunkFeedback({});
        setLessonXpEarned(0);
        setTimeSpentSeconds(0);
        setSupportStatus('');
        setSaveToPlsState({ saved: false, pending: false });

        if (previewLessonFromState && String(previewLessonFromState.id || '') === String(lessonId || '')) {
          const guestAccess = consumeGuestContentView({
            isAuthenticated: Boolean(user),
            contentType: previewLessonFromState?.type || 'lesson',
            contentId: previewLessonFromState?.id || lessonId,
          });

          if (!guestAccess.allowed) {
            if (!mounted) return;
            setLesson(null);
            setGuestAccessBlocked({
              title: `Daily ${guestAccess.typeLabel} limit reached`,
              message: buildGuestLimitMessage(guestAccess.typeLabel),
            });
            openAuthPrompt('register');
            return;
          }

          if (!mounted) return;

          setLesson(previewLessonFromState);
          setLikeState({ liked: false, count: 0, pending: false });
          setSaveToPlsState({ saved: false, pending: false });
          setIsLessonComplete(false);
          completionAwardedRef.current = false;
          return;
        }

        if (isPracticePrelimLessonId(lessonId)) {
          if (!mounted) return;
          setLesson(null);
          return;
        }

        const lessonData = await getContentById(lessonId);
        if (!lessonData) {
          if (!mounted) return;
          setLesson(null);
          return;
        }

        const guestAccess = consumeGuestContentView({
          isAuthenticated: Boolean(user),
          contentType: lessonData?.type || 'lesson',
          contentId: lessonData?.id || lessonId,
        });

        if (!guestAccess.allowed) {
          if (!mounted) return;
          setLesson(null);
          setGuestAccessBlocked({
            title: `Daily ${guestAccess.typeLabel} limit reached`,
            message: buildGuestLimitMessage(guestAccess.typeLabel),
          });
          openAuthPrompt('register');
          return;
        }

        if (!mounted) return;

        setLesson(lessonData);
        setLikeState({
          liked: Boolean(lessonData?.user_interactions?.liked),
          count: Number(lessonData?.stats?.like_count || 0),
          pending: false,
        });
        setSaveToPlsState({
          saved: Boolean(lessonData?.user_interactions?.saved),
          pending: false,
        });
        setIsLessonComplete(Boolean(lessonData?.user_engagement?.completed));
        completionAwardedRef.current = false;
      } catch (error) {
        console.error('Error loading lesson:', error);
        if (lessonLoadKeyRef.current === activeLoadKey) {
          lessonLoadKeyRef.current = '';
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadLesson();

    return () => {
      mounted = false;
    };
  }, [getContentById, lessonId, openAuthPrompt, previewLessonFromState, user?.id]);

  useEffect(() => {
    if (!lesson || loading) return undefined;

    const elapsedTimer = window.setInterval(() => {
      setTimeSpentSeconds((previous) => previous + 1);
      if (currentStage?.kind === 'content' && currentChunk?.id) {
        setContentChunkElapsed((previous) => ({
          ...previous,
          [currentChunk.id]: (previous[currentChunk.id] || 0) + 1,
        }));
      }
    }, 1000);

    return () => window.clearInterval(elapsedTimer);
  }, [currentChunk?.id, currentStage?.kind, lesson, loading]);

  useEffect(() => {
    if (!stages.length) {
      setCurrentStageIndex(0);
      return;
    }

    setCurrentStageIndex((previous) => clamp(previous, 0, stages.length - 1));
  }, [stages.length]);

  useEffect(() => {
    if (!lesson || !stages.length) return;

    const persistedState = extractPersistedLessonState(lesson);
    if (!persistedState) return;

    const hydrationKey = [
      lessonId,
      lesson?.user_engagement?.last_viewed_at || '',
      lesson?.user_engagement?.completed_at || '',
      lesson?.user_engagement?.progress_percentage || 0,
    ].join(':');

    if (persistedLessonHydrationKeyRef.current === hydrationKey) {
      return;
    }

    persistedLessonHydrationKeyRef.current = hydrationKey;

    setTimeSpentSeconds(persistedState.timeSpentSeconds);
    setContentChunkElapsed(persistedState.contentChunkElapsed);
    setChunkResponses(persistedState.chunkResponses);
    setChunkFeedback(persistedState.chunkFeedback);
    setVisitedExerciseChunks(persistedState.visitedExerciseChunks);
    setAssessmentResponses(persistedState.finalAssessment.responses);
    setAssessmentAttempts(persistedState.finalAssessment.attempts);
    setAssessmentResult(persistedState.finalAssessment.result);
    setAssessmentElapsedSeconds(persistedState.finalAssessment.elapsedSeconds);
    setLessonXpEarned((previous) => Math.max(previous, persistedState.lessonXpEarned));
    if (Object.keys(persistedState.discussionBoards || {}).length) {
      setDiscussionBoards((previous) => ({
        ...normalizeDiscussionStore(persistedState.discussionBoards, lessonBlocks[0]?.id || ''),
        ...normalizeDiscussionStore(previous, lessonBlocks[0]?.id || ''),
      }));
    }

    if (persistedState.completionSummary) {
      setLessonCompletionSummary({
        ...EMPTY_COMPLETION_SUMMARY,
        ...persistedState.completionSummary,
      });
    }

    const isCompleted = Boolean(lesson?.user_engagement?.completed || persistedState.completed);
    setIsLessonComplete(isCompleted);
    completionAwardedRef.current = false;

    let nextStageIndex = -1;
    if (persistedState.currentStageId) {
      nextStageIndex = stages.findIndex((stage) => String(stage?.id || '') === String(persistedState.currentStageId));
    }
    if (nextStageIndex < 0 && persistedState.currentStageIndex > 0) {
      nextStageIndex = clamp(persistedState.currentStageIndex, 0, stages.length - 1);
    }
    if (lessonEntryMode === 'revise') {
      nextStageIndex = contentStageIndexes[0] ?? 0;
    } else if (lessonEntryMode === 'assessment' && assessmentStageIndex >= 0) {
      nextStageIndex = assessmentStageIndex;
      setAssessmentResponses({});
      setAssessmentResult(null);
      setAssessmentElapsedSeconds(0);
      assessmentStartedAtRef.current = Date.now();
    } else if (isCompleted && assessmentStageIndex >= 0) {
      nextStageIndex = assessmentStageIndex;
    }
    if (nextStageIndex >= 0) {
      setCurrentStageIndex(nextStageIndex);
    }

    if (persistedState.finalAssessment.result) {
      assessmentStartedAtRef.current = null;
    } else if (persistedState.finalAssessment.startedAtMs > 0) {
      assessmentStartedAtRef.current = persistedState.finalAssessment.startedAtMs;
    }

    trackEvent('lesson_progress_restored', {
      lesson_id: lessonId,
      restored_stage_kind:
        (nextStageIndex >= 0 ? stages[nextStageIndex]?.kind : null) ||
        persistedState.currentStageKind ||
        null,
      restored_progress_percentage: Number(lesson?.user_engagement?.progress_percentage || 0),
      final_assessment_attempts: persistedState.finalAssessment.attempts.length,
      lesson_completed: isCompleted,
      lesson_entry_mode: lessonEntryMode || null,
    });
  }, [assessmentStageIndex, contentStageIndexes, lesson, lessonEntryMode, lessonId, stages, trackEvent]);

  const buildPersistedEngagementPayload = useCallback((options = {}) => {
    const snapshot = {
      ...(latestLessonSnapshotRef.current || {}),
      ...(options.snapshot || {}),
    };
    const stage = snapshot.currentStage || null;
    const durationSeconds = Math.max(
      0,
      toFiniteNumber(options.timeSpentSeconds ?? latestTimeSpentRef.current, 0)
    );
    const progressPercentage = clamp(
      toFiniteNumber(options.progressPercent ?? latestProgressRef.current, 0),
      0,
      100
    );
    const finalAssessmentAttempts = (Array.isArray(snapshot.assessmentAttempts) ? snapshot.assessmentAttempts : [])
      .map((attempt, index) => sanitizePersistedAssessmentAttempt(attempt, index))
      .filter(Boolean)
      .slice(-MAX_PERSISTED_ASSESSMENT_ATTEMPTS);
    const finalAssessmentResult = sanitizePersistedAssessmentResult(snapshot.assessmentResult);
    const completionSummary = sanitizePersistedCompletionSummary(snapshot.lessonCompletionSummary);
    const lessonState = {
      version: LESSON_STATE_VERSION,
      lesson_id: lessonId,
      saved_at: new Date().toISOString(),
      current_stage: {
        id: safeText(stage?.id),
        kind: safeText(stage?.kind),
        index: Math.max(0, toFiniteNumber(snapshot.currentStageIndex, 0)),
        chunk_id: safeText(stage?.chunk?.id),
      },
      time_spent_seconds: durationSeconds,
      content_chunk_elapsed: normalizeNumberRecord(snapshot.contentChunkElapsed),
      chunk_responses: normalizeStringRecord(snapshot.chunkResponses),
      chunk_feedback: normalizeChunkFeedbackRecord(snapshot.chunkFeedback),
      visited_exercise_chunks: normalizeBooleanRecord(snapshot.visitedExerciseChunks),
      discussion_boards: normalizeDiscussionStore(snapshot.discussionBoards || discussionBoards),
      lesson_xp_earned: Math.max(0, toFiniteNumber(snapshot.lessonXpEarned, 0)),
      completed: Boolean(options.completed ?? snapshot.isLessonComplete),
      final_assessment: {
        responses: normalizeStringRecord(snapshot.assessmentResponses),
        result: finalAssessmentResult,
        elapsed_seconds: Math.max(0, toFiniteNumber(snapshot.assessmentElapsedSeconds, 0)),
        started_at_ms: finalAssessmentResult
          ? null
          : Math.max(0, toFiniteNumber(snapshot.assessmentStartedAtMs ?? assessmentStartedAtRef.current, 0)) || null,
        attempts: finalAssessmentAttempts,
      },
      completion_summary: completionSummary,
    };

    return {
      progress_percentage: progressPercentage,
      duration_seconds: durationSeconds,
      metadata: {
        duration: durationSeconds,
        progress_percentage: progressPercentage,
        completed: lessonState.completed,
        lesson_progress: true,
        lesson_state: lessonState,
        discussion_boards: lessonState.discussion_boards,
        lesson_xp_earned: lessonState.lesson_xp_earned,
        final_assessment: lessonState.final_assessment,
        completion_summary: completionSummary,
      },
    };
  }, [discussionBoards, lessonId]);

  const saveProgress = useCallback(
    async (
      nextProgress = latestProgressRef.current,
      nextDurationSeconds = latestTimeSpentRef.current,
      snapshotOverrides = null,
      options = {}
    ) => {
      if (isVirtualLesson) return;
      if (!user || !lesson) return;

      try {
        const payload = buildPersistedEngagementPayload({
          progressPercent: nextProgress,
          timeSpentSeconds: nextDurationSeconds,
          snapshot: snapshotOverrides,
          completed: options.completed,
        });
        const signature = JSON.stringify({
          action: 'progress',
          progress_percentage: payload.progress_percentage,
          duration_seconds: payload.duration_seconds,
          metadata: payload.metadata,
        });

        if (!options.force && lastSavedLessonStateRef.current === signature) {
          return;
        }

        await trackEngagement(lessonId, 'progress', payload);
        lastSavedLessonStateRef.current = signature;
        notifyLearningProgressUpdated({
          progressPercentage: payload.progress_percentage,
          completed: Boolean(payload.metadata?.completed),
        });
      } catch (error) {
        console.error('Error saving lesson progress:', error);
      }
    },
    [buildPersistedEngagementPayload, isVirtualLesson, lesson, lessonId, notifyLearningProgressUpdated, trackEngagement, user]
  );

  useEffect(() => {
    if (discussionBoardsLoadedKey !== discussionStorageKey) return undefined;
    if (isVirtualLesson || !user || !lesson) return undefined;
    const hasDiscussionActivity = Object.values(discussionBoards || {}).some((bucket) =>
      DISCUSSION_TYPES.some((type) => Array.isArray(bucket?.[type]) && bucket[type].length > 0)
    );
    if (!hasDiscussionActivity) return undefined;

    const timeoutId = window.setTimeout(() => {
      void saveProgress(latestProgressRef.current, latestTimeSpentRef.current, { discussionBoards }, { force: true });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    discussionBoards,
    discussionBoardsLoadedKey,
    discussionStorageKey,
    isVirtualLesson,
    lesson,
    saveProgress,
    user,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!lesson || loading || isVirtualLesson || !user) return undefined;

    const intervalId = window.setInterval(() => {
      void saveProgress(latestProgressRef.current, latestTimeSpentRef.current);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isVirtualLesson, lesson, loading, saveProgress, user]);

  useEffect(() => {
    return () => {
      void saveProgress(latestProgressRef.current, latestTimeSpentRef.current);
    };
  }, [saveProgress, lessonId, user?.id]);

  const handleBackToCourse = () => {
    navigate(coursePath);
  };

  const handleCompletionBreak = () => {
    handleBackToCourse();
    queueGuestCompletionAuthPrompt();
  };

  const handleContinueToNextLesson = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (!nextLessonInSequence?.id) {
      handleBackToCourse();
      return;
    }

    const nextLessonPreview =
      nextLessonInSequence.lessonPreview ||
      loadPracticePrelimPreviewLesson(nextLessonInSequence.id) ||
      null;

    if (nextLessonPreview) {
      savePracticePrelimPreviewLesson(nextLessonPreview);
    }

    navigate(`/learn/lesson/${nextLessonInSequence.id}`, {
      state: {
        ...location.state,
        lessonPreview: nextLessonPreview,
        coursePath,
        fromCoursePath: coursePath,
        lessonSequence,
      },
    });
  };

  const handleCompletionContinue = () => {
    handleContinueToNextLesson();
    queueGuestCompletionAuthPrompt();
  };

  const fetchUserWeeklyRank = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const response = await api.gamification.getLeaderboard('global', 'weekly');
      if (response?.success) {
        const syncedRank = Number(response.current_user_rank ?? 0);
        if (Number.isFinite(syncedRank) && syncedRank > 0) {
          return Math.round(syncedRank);
        }
        return getUserRankFromEntries(response.leaderboard, user.id);
      }
    } catch (error) {
      // Fall through to cached rank.
    }

    return getUserRank();
  }, [getUserRank, user?.id]);

  const handleToggleLike = async () => {
    if (isVirtualLesson) {
      setSupportStatus('This prelim guide cannot be liked yet.');
      return;
    }
    if (!lesson?.id || likeState.pending) return;
    if (!user) {
      openAuthPrompt('login');
      return;
    }

    setLikeState((previous) => ({ ...previous, pending: true }));
    try {
      const response = await likeContent(lesson.id);
      const liked = Boolean(response?.liked);
      setLikeState((previous) => ({
        liked,
        pending: false,
        count: Math.max(0, previous.count + (liked ? 1 : -1)),
      }));
      trackEvent('lesson_like_toggle', {
        lesson_id: lesson.id,
        liked,
      });
    } catch (error) {
      setLikeState((previous) => ({ ...previous, pending: false }));
    }
  };

  const handleSelectionHighlight = () => {
    if (!highlightMode || !currentChunk || !user) return;
    if (typeof window === 'undefined') return;

    const selection = window.getSelection?.();
    const selectedText = safeText(selection?.toString());
    if (!selectedText || selectedText.length < 2) return;

    const anchorChunk = selection?.anchorNode?.parentElement?.closest('[data-highlight-chunk]');
    const focusChunk = selection?.focusNode?.parentElement?.closest('[data-highlight-chunk]');
    const chunkId = anchorChunk?.dataset.highlightChunk;

    if (!chunkId || chunkId !== focusChunk?.dataset.highlightChunk) return;

    setHighlights((previous) => {
      const exists = previous.some(
        (entry) => entry.chunkId === chunkId && normalizeText(entry.text) === normalizeText(selectedText)
      );
      if (exists) return previous;

      return [
        {
          id: `highlight-${Date.now()}`,
          chunkId,
          text: selectedText,
          createdAt: new Date().toISOString(),
        },
        ...previous,
      ];
    });

    selection?.removeAllRanges?.();
    setHighlightMode(false);
    setSupportStatus('Highlight saved to your lesson notes.');
    trackEvent('lesson_highlight_added', {
      lesson_id: lessonId,
      chunk_id: chunkId,
    });
  };

  const handleHighlightToggle = () => {
    if (!user) {
      openAuthPrompt('login');
      return;
    }

    const turningOn = !highlightMode;
    setHighlightMode(turningOn);
    setSupportStatus(
      turningOn
        ? 'Highlight mode on. Select text inside the lesson chunk to save it.'
        : 'Highlight mode turned off.'
    );

    if (turningOn) {
      setIsMobileRailOpen(false);
      setShareSubmenuOpen(false);
    }
  };

  const openDiscussionBoard = (type) => {
    setShareSubmenuOpen(false);
    setDiscussionModal(type);
    if (type === 'discussion') {
      setDiscussionComposerType('comment');
    }
    setDiscussionDraft('');
    setActiveReplyTarget('');
  };

  const handleToggleReplyTarget = (entryId, boardType = discussionModal) => {
    const targetKey = `${boardType}:${entryId}`;
    setActiveReplyTarget((previous) => (previous === targetKey ? '' : targetKey));
  };

  const handleOpenLeaderboard = () => {
    setShowLeaderboardModal(true);
    trackEvent('lesson_leaderboard_opened', {
      lesson_id: lessonId,
    });
  };

  const handleSaveToPls = async () => {
    if (isVirtualLesson) {
      setSupportStatus('This prelim guide cannot be saved to PLS yet.');
      return;
    }
    if (!lesson?.id || saveToPlsState.pending || saveToPlsState.saved) return;
    if (!user) {
      openAuthPrompt('login');
      return;
    }

    setSaveToPlsState((previous) => ({ ...previous, pending: true }));
    try {
      const response = await addToPLS(lesson.id, 'lesson');
      if (response?.success) {
        setSaveToPlsState({ saved: true, pending: false });
        setSupportStatus('Lesson saved to your PLS.');
        trackEvent('lesson_saved_to_pls', {
          lesson_id: lesson.id,
        });
        return;
      }

      throw new Error(response?.error || 'save_failed');
    } catch (error) {
      setSaveToPlsState((previous) => ({ ...previous, pending: false }));
      setSupportStatus('Could not save this lesson to your PLS right now.');
    }
  };

  const handleShareLesson = async () => {
    if (isVirtualLesson) {
      const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
      try {
        if (navigator.share) {
          await navigator.share({
            title: lesson?.title || 'Sharether lesson',
            text: `${lesson?.title || 'Lesson'} on Sharether`,
            url: shareUrl,
          });
          setSupportStatus('Prelim guide shared.');
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          setSupportStatus('Prelim guide link copied.');
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setSupportStatus('Could not share this prelim guide right now.');
        }
      }
      return;
    }
    if (!lesson?.id || sharePending) return;

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const sharePayload = {
      title: lesson?.title || 'Sharether lesson',
      text: `${lesson?.title || 'Lesson'} on Sharether`,
      url: shareUrl,
    };

    setSharePending(true);
    try {
      await contentService.shareContent(lesson.id);

      if (navigator.share) {
        await navigator.share(sharePayload);
        setSupportStatus('Lesson shared.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setSupportStatus('Lesson link copied. Share it anywhere.');
      } else {
        setSupportStatus('Lesson share recorded.');
      }

      trackEvent('lesson_shared', {
        lesson_id: lesson.id,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        setSupportStatus('Share cancelled.');
      } else {
        setSupportStatus('Could not share this lesson right now.');
      }
    } finally {
      setSharePending(false);
    }
  };

  const handleShareToCommunity = () => {
    if (!user) {
      openAuthPrompt('login');
      return;
    }
    setCommunityShareOpen(true);
  };

  const handleShareToStudyGroup = () => {
    if (!user) {
      openAuthPrompt('login');
      return;
    }
    setStudyGroupShareOpen(true);
  };

  const handleDiscussionSubmit = (event) => {
    event.preventDefault();

    if (!discussionModal || !currentChunk?.id || !safeText(discussionDraft)) return;
    if (!user) {
      openAuthPrompt('login');
      return;
    }

    const targetBoardType = discussionModal === 'discussion' ? discussionComposerType : discussionModal;
    const boardEntry = {
      id: `${currentChunk.id}-${targetBoardType}-${Date.now()}`,
      body: safeText(discussionDraft),
      authorKey: getUserKey(user),
      authorName: user?.full_name || user?.name || 'Sharether Student',
      authorAvatar: user?.avatar_url || null,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      replies: [],
    };

    setDiscussionBoards((previous) => ({
      ...previous,
      [currentChunk.id]: {
        ...normalizeDiscussionBucket(previous[currentChunk.id]),
        [targetBoardType]: [...(normalizeDiscussionBucket(previous[currentChunk.id])[targetBoardType] || []), boardEntry],
      },
    }));
    setDiscussionDraft('');
    setSupportStatus(`${DISCUSSION_CONFIG[targetBoardType].shortLabel} shared.`);
    trackEvent('lesson_discussion_posted', {
      lesson_id: lessonId,
      chunk_id: currentChunk.id,
      board_type: targetBoardType,
    });
  };

  const handleReplyDraftChange = (entryId, value) => {
    setReplyDrafts((previous) => ({
      ...previous,
      [entryId]: value,
    }));
  };

  const handleReplySubmit = (entryId, boardType = discussionModal) => {
    if (!boardType || !currentChunk?.id || !safeText(replyDrafts[entryId])) return;
    if (!user) {
      openAuthPrompt('login');
      return;
    }

    const reply = {
      id: `${entryId}-reply-${Date.now()}`,
      body: safeText(replyDrafts[entryId]),
      authorKey: getUserKey(user),
      authorName: user?.full_name || user?.name || 'Sharether Student',
      authorAvatar: user?.avatar_url || null,
      createdAt: new Date().toISOString(),
    };

    setDiscussionBoards((previous) => ({
      ...previous,
      [currentChunk.id]: {
        ...normalizeDiscussionBucket(previous[currentChunk.id]),
        [boardType]: (normalizeDiscussionBucket(previous[currentChunk.id])[boardType] || []).map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                replies: [...(entry.replies || []), reply],
              }
            : entry
        ),
      },
    }));
    setReplyDrafts((previous) => ({
      ...previous,
      [entryId]: '',
    }));
    setActiveReplyTarget('');
    setSupportStatus('Reply added to the thread.');
  };

  const handleDiscussionLikeToggle = (entryId, boardType = discussionModal) => {
    if (!boardType || !currentChunk?.id) return;
    if (!user) {
      openAuthPrompt('login');
      return;
    }

    const likerKey = getUserKey(user);

    setDiscussionBoards((previous) => ({
      ...previous,
      [currentChunk.id]: {
        ...normalizeDiscussionBucket(previous[currentChunk.id]),
        [boardType]: (normalizeDiscussionBucket(previous[currentChunk.id])[boardType] || []).map((entry) => {
          if (entry.id !== entryId) return entry;

          const likedBy = Array.isArray(entry.likedBy) ? entry.likedBy : [];
          const alreadyLiked = likedBy.includes(likerKey);
          const nextLikedBy = alreadyLiked
            ? likedBy.filter((item) => item !== likerKey)
            : [...likedBy, likerKey];

          return {
            ...entry,
            likedBy: nextLikedBy,
            likes: nextLikedBy.length,
          };
        }),
      },
    }));
  };

  const handleEditDiscussionEntry = (entryId, nextBody, boardType = discussionModal) => {
    if (!boardType || !currentChunk?.id || !safeText(nextBody)) return;

    setDiscussionBoards((previous) => ({
      ...previous,
      [currentChunk.id]: {
        ...normalizeDiscussionBucket(previous[currentChunk.id]),
        [boardType]: (normalizeDiscussionBucket(previous[currentChunk.id])[boardType] || []).map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                body: safeText(nextBody),
                updatedAt: new Date().toISOString(),
              }
            : entry
        ),
      },
    }));
    setSupportStatus(`${DISCUSSION_CONFIG[boardType].shortLabel} updated.`);
  };

  const handleEditDiscussionReply = (entryId, replyId, nextBody, boardType = discussionModal) => {
    if (!boardType || !currentChunk?.id || !safeText(nextBody)) return;

    setDiscussionBoards((previous) => ({
      ...previous,
      [currentChunk.id]: {
        ...normalizeDiscussionBucket(previous[currentChunk.id]),
        [boardType]: (normalizeDiscussionBucket(previous[currentChunk.id])[boardType] || []).map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                replies: (entry.replies || []).map((reply) =>
                  reply.id === replyId
                    ? {
                        ...reply,
                        body: safeText(nextBody),
                        updatedAt: new Date().toISOString(),
                      }
                    : reply
                ),
              }
            : entry
        ),
      },
    }));
    setSupportStatus('Reply updated.');
  };

  const handleExerciseResponseChange = (chunkId, value, opts = {}) => {
    if (opts.fromOptionSelect) {
      playUiSound('quizOptionSelect');
    }
    setChunkResponses((previous) => ({
      ...previous,
      [chunkId]: value,
    }));
  };

  const handleOrderingMove = (chunkId, orderIds, fromIndex, direction) => {
    if (currentFeedback?.checked) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= orderIds.length) return;
    const next = [...orderIds];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    playUiSound('quizOptionSelect');
    setChunkResponses((previous) => ({ ...previous, [chunkId]: next }));
  };

  const handleAssessmentResponseChange = (questionId, value, opts = {}) => {
    if (opts.fromOptionSelect) {
      playUiSound('quizOptionSelect');
    }
    setAssessmentResponses((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  };

  const handleRetakeAssessment = useCallback(() => {
    const resetAssessmentSnapshot = {
      assessmentResponses: {},
      assessmentResult: null,
      assessmentAttempts: latestLessonSnapshotRef.current?.assessmentAttempts || [],
      assessmentElapsedSeconds: 0,
      assessmentStartedAtMs: Date.now(),
    };

    setAssessmentResponses({});
    setAssessmentResult(null);
    setAssessmentElapsedSeconds(0);
    assessmentStartedAtRef.current = null;
    if (assessmentTimerRef.current) {
      window.clearInterval(assessmentTimerRef.current);
      assessmentTimerRef.current = null;
    }
    setSupportStatus('Final test reset. Try it again.');
    void saveProgress(latestProgressRef.current, latestTimeSpentRef.current, resetAssessmentSnapshot, { force: true });
  }, [saveProgress]);

  const handleSubmitAssessment = useCallback(() => {
    const assessmentStage = stages.find((stage) => stage.kind === 'assessment');
    const questions = assessmentStage?.questions || [];
    if (!questions.length) {
      setSupportStatus('The final lesson test is not ready yet.');
      return;
    }

    const summary = evaluateAssessmentSubmission({
      questions,
      responses: assessmentResponses,
      elapsedSeconds: assessmentElapsedSeconds,
      startedAt: assessmentStartedAtRef.current,
    });

    if (!summary.isReady) {
      setSupportStatus('Answer every test item before you submit the final lesson test.');
      return;
    }

    if (assessmentTimerRef.current) {
      window.clearInterval(assessmentTimerRef.current);
      assessmentTimerRef.current = null;
    }

    const { correctCount, totalQuestions, percentScore, passed, durationSeconds, evaluations } = summary;
    const attemptSummary = {
      key: Date.now(),
      passed,
      correctCount,
      totalQuestions,
      percentScore,
      durationSeconds,
      submittedAt: new Date().toISOString(),
    };
    const nextAssessmentAttempts = [
      ...(latestLessonSnapshotRef.current?.assessmentAttempts || []),
      attemptSummary,
    ].slice(-MAX_PERSISTED_ASSESSMENT_ATTEMPTS);
    const nextAssessmentResult = {
      key: attemptSummary.key,
      passed,
      correctCount,
      totalQuestions,
      percentScore,
      durationSeconds,
      evaluations,
    };

    setAssessmentElapsedSeconds(durationSeconds);
    setAssessmentAttempts(nextAssessmentAttempts);
    setAssessmentResult(nextAssessmentResult);
    if (passed) setAssessmentCelebration(true);
    triggerFeedbackBurst(passed ? 'correct' : 'wrong');
    playFeedbackTone(passed ? 'correct' : 'wrong');
    setSupportStatus(
      passed
        ? `Final test passed with ${percentScore}%.`
        : `Final test score: ${percentScore}%. You need ${SHARED_FINAL_ASSESSMENT_PASS_PERCENT}% to complete the lesson.`
    );
    trackEvent('lesson_final_assessment_submitted', {
      lesson_id: lessonId,
      attempt_number: nextAssessmentAttempts.length,
      total_questions: totalQuestions,
      correct_answers: correctCount,
      percent_score: percentScore,
      duration_seconds: durationSeconds,
      passed,
    });
    void saveProgress(
      Math.max(progressPercent, passed ? 100 : progressPercent),
      latestTimeSpentRef.current,
      {
        assessmentResponses,
        assessmentResult: nextAssessmentResult,
        assessmentAttempts: nextAssessmentAttempts,
        assessmentElapsedSeconds: durationSeconds,
        assessmentStartedAtMs: null,
      },
      { force: true }
    );
  }, [
    assessmentElapsedSeconds,
    assessmentResponses,
    lessonId,
    playFeedbackTone,
    progressPercent,
    saveProgress,
    stages,
    trackEvent,
    triggerFeedbackBurst,
  ]);

  const finalizeLessonCompletion = useCallback(async (assessmentSummary = null) => {
    if (!lesson) return;

    const completionBonus = calculateXpFromActivity('content_complete', {
      is_premium: lesson?.is_premium,
      difficulty: lesson?.depth_level,
    });
    const totalLessonXp = lessonXpEarned + completionBonus;
    const rankBeforeCompletion = await fetchUserWeeklyRank();
    const completionSummary = {
      key: Date.now(),
      headline: nextLessonInSequence ? 'Well done' : 'Good job',
      body: isPrelimLesson
        ? nextLessonInSequence
          ? `You wrapped up this outline. Take a breather or continue to Prelim ${nextLessonInSequence.lessonNumber}.`
          : 'You wrapped up this outline. Take a breather or head back to your course.'
        : nextLessonInSequence
          ? `You wrapped up this lesson. Take a breather or continue to Lesson ${nextLessonInSequence.lessonNumber}.`
          : 'You wrapped up this lesson. Take a breather or head back to your course.',
      xpEarned: totalLessonXp,
      rankBefore: rankBeforeCompletion,
      rankAfter: rankBeforeCompletion,
      nextLesson: nextLessonInSequence,
      assessmentPercent: assessmentSummary?.percentScore ?? null,
      assessmentDurationSeconds: assessmentSummary?.durationSeconds ?? null,
    };

    setLessonXpEarned(totalLessonXp);
    setIsLessonComplete(true);
    setLessonCelebrationMode(!nextLessonInSequence && !isPrelimLesson ? 'fireworks' : 'burst');
    setShowCompletionFlash(true);
    setTimeout(() => setShowCompletionFlash(false), 1400);
    setIsLessonCompletionModalOpen(true);
    setLessonCompletionSummary(completionSummary);
    triggerFeedbackBurst('correct');
    if (!nextLessonInSequence && !isPrelimLesson) {
      playUiSound('courseComplete');
    } else {
      playUiSound('lessonComplete');
    }

    if (!user) {
      return;
    }

    if (completionAwardedRef.current) {
      setSupportStatus('Lesson already completed. Your progress is up to date.');
      return;
    }

    completionAwardedRef.current = true;

    if (isVirtualLesson) {
      persistCompletedPrelim();
      setSupportStatus('Prelim completed.');
      return;
    }

    try {
      const completionPayload = buildPersistedEngagementPayload({
        progressPercent: 100,
        timeSpentSeconds,
        completed: true,
        snapshot: {
          isLessonComplete: true,
          lessonXpEarned: totalLessonXp,
          lessonCompletionSummary: completionSummary,
          assessmentResult: assessmentSummary || latestLessonSnapshotRef.current?.assessmentResult || null,
          assessmentAttempts: latestLessonSnapshotRef.current?.assessmentAttempts || [],
          assessmentElapsedSeconds:
            assessmentSummary?.durationSeconds ??
            latestLessonSnapshotRef.current?.assessmentElapsedSeconds ??
            0,
        },
      });

      await trackEngagement(lessonId, 'complete', completionPayload);
      lastSavedLessonStateRef.current = JSON.stringify({
        action: 'complete',
        progress_percentage: completionPayload.progress_percentage,
        duration_seconds: completionPayload.duration_seconds,
        metadata: completionPayload.metadata,
      });
      await addXp(totalLessonXp, `lesson:${lessonId}`);
      await refreshProgress();
      await refreshLeaderboard('global', 'weekly');
      const rankAfterCompletion = await fetchUserWeeklyRank();
      setLessonCompletionSummary((previous) => ({
        ...previous,
        rankAfter: rankAfterCompletion,
      }));
      notifyLearningProgressUpdated({
        progressPercentage: 100,
        completed: true,
      });
      setSupportStatus(`Lesson completed. ${totalLessonXp} XP synced to your PLS.`);
      trackEvent('lesson_completed', {
        lesson_id: lessonId,
        xp_awarded: totalLessonXp,
        duration_seconds: timeSpentSeconds,
        assessment_percent: assessmentSummary?.percentScore ?? null,
        assessment_duration_seconds: assessmentSummary?.durationSeconds ?? null,
      });
    } catch (error) {
      console.error('Error finalizing lesson completion:', error);
    }
  }, [
    addXp,
    buildPersistedEngagementPayload,
    calculateXpFromActivity,
    isPrelimLesson,
    isVirtualLesson,
    lesson,
    lessonId,
    lessonXpEarned,
    fetchUserWeeklyRank,
    nextLessonInSequence,
    openAuthPrompt,
    persistCompletedPrelim,
    refreshProgress,
    refreshLeaderboard,
    timeSpentSeconds,
    notifyLearningProgressUpdated,
    trackEngagement,
    trackEvent,
    triggerFeedbackBurst,
    user,
  ]);

  const handleAdvance = async () => {
    if (!currentStage) return;

    if (currentStage.kind === 'content') {
      if (currentStageIndex >= stages.length - 1) {
        await finalizeLessonCompletion();
        return;
      }
      playUiSound('lessonSwipeForward');
      await saveProgress(progressPercent);
      setCurrentStageIndex((previous) => clamp(previous + 1, 0, stages.length - 1));
      setChunkAnimKey((k) => k + 1);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (currentStage.kind === 'assessment') {
      if (!assessmentResult?.passed) return;
      await finalizeLessonCompletion(assessmentResult);
      return;
    }

    if (!currentFeedback?.checked) return;

    if (currentStageIndex >= stages.length - 1) {
      await finalizeLessonCompletion();
      return;
    }

    playUiSound('lessonSwipeForward');
    await saveProgress(progressPercent);
    setCurrentStageIndex((previous) => clamp(previous + 1, 0, stages.length - 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousChunk = () => {
    const currentContentPosition = contentStageIndexes.findIndex(
      (stageIndex) => stages[stageIndex]?.chunk?.id === currentChunk?.id
    );
    if (currentContentPosition <= 0) return;
    playUiSound('lessonSwipeBack');
    setCurrentStageIndex(contentStageIndexes[currentContentPosition - 1]);
  };

  const handlePeekLesson = () => {
    if (!currentChunk?.id) return;

    const contentStageIndex = stages.findIndex(
      (stage) => stage.kind === 'content' && String(stage?.chunk?.id || '') === String(currentChunk.id)
    );
    if (contentStageIndex < 0) return;

    setCurrentStageIndex(contentStageIndex);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Shared by the single-question flow and the last question of an
  // 'objective_set' — records the final checked/correct state for the whole
  // exercise slot, awards XP, and persists progress.
  const commitCheckedFeedback = (exercise, response, evaluation) => {
    const points = evaluation.correct ? 18 : 8;
    const nextChunkFeedback = {
      ...(latestLessonSnapshotRef.current?.chunkFeedback || {}),
      [currentChunk.id]: {
        checked: true,
        correct: evaluation.correct,
        explanation: evaluation.explanation,
        expectedAnswer: evaluation.expectedAnswer,
        response,
        points,
      },
    };
    const nextLessonXpEarned = Math.max(0, Number(latestLessonSnapshotRef.current?.lessonXpEarned || 0) + points);

    setChunkFeedback((previous) => ({
      ...previous,
      [currentChunk.id]: {
        checked: true,
        correct: evaluation.correct,
        explanation: evaluation.explanation,
        expectedAnswer: evaluation.expectedAnswer,
        response,
        points,
      },
    }));
    setIsFeedbackExpanded(false);

    setLessonXpEarned((previous) => previous + points);
    triggerFeedbackBurst(evaluation.correct ? 'correct' : 'wrong');
    playFeedbackTone(evaluation.correct ? 'correct' : 'wrong');
    setSupportStatus(
      evaluation.correct
        ? 'Correct.'
        : 'Not quite yet.'
    );

    trackEvent('lesson_answer_checked', {
      lesson_id: lessonId,
      chunk_id: currentChunk.id,
      exercise_type: exercise.type,
      correct: evaluation.correct,
      points,
    });
    void saveProgress(latestProgressRef.current, latestTimeSpentRef.current, {
      chunkFeedback: nextChunkFeedback,
      lessonXpEarned: nextLessonXpEarned,
    }, { force: true });
  };

  const handleCheckAnswer = () => {
    if (!currentChunk || !currentStage?.exercise || currentFeedback?.checked) return;

    const response = chunkResponses[currentChunk.id];
    const evaluation = evaluateSharedExercise(currentStage.exercise, response);
    if (!evaluation.isReady) {
      setSupportStatus(evaluation.explanation);
      return;
    }

    commitCheckedFeedback(currentStage.exercise, response, evaluation);
  };

  // Checks the currently-shown question of an 'objective_set' in isolation —
  // shows right/wrong + explanation for just that question, without touching
  // the exercise-wide chunkFeedback (that only happens once every question in
  // the set has been answered, via handleObjectiveSetAdvance below).
  const handleObjectiveSetCheck = () => {
    if (!currentChunk || currentExercise?.type !== 'objective_set' || currentFeedback?.checked) return;
    if (!activeSetChoice) return;

    const questions = currentExercise.questions || [];
    const activeIndex = (chunkResponses[currentChunk.id] || []).length;
    const question = questions[activeIndex];
    if (!question) return;

    const evaluation = evaluateObjectiveSetQuestion(question, activeSetChoice);
    setActiveSetFeedback(evaluation);
    triggerFeedbackBurst(evaluation.correct ? 'correct' : 'wrong');
    playFeedbackTone(evaluation.correct ? 'correct' : 'wrong');
  };

  const handleObjectiveSetSelect = (value) => {
    if (activeSetFeedback) return;
    playUiSound('quizOptionSelect');
    setActiveSetChoice(value);
  };

  // Commits the just-checked question's answer and advances to the next one.
  // On the final question, this also evaluates and commits the whole set's
  // aggregate result (via commitCheckedFeedback) so the standard
  // checked/feedback/next-chunk flow takes over from there.
  const handleObjectiveSetAdvance = () => {
    if (!currentChunk || currentExercise?.type !== 'objective_set' || !activeSetFeedback) return;

    const questions = currentExercise.questions || [];
    const priorAnswers = chunkResponses[currentChunk.id] || [];
    const nextAnswers = [...priorAnswers, activeSetChoice];

    setChunkResponses((previous) => ({ ...previous, [currentChunk.id]: nextAnswers }));
    setActiveSetChoice(null);
    setActiveSetFeedback(null);

    if (nextAnswers.length >= questions.length) {
      const evaluation = evaluateSharedExercise(currentExercise, nextAnswers);
      commitCheckedFeedback(currentExercise, nextAnswers, evaluation);
    }
  };

  useEffect(() => {
    setIsFeedbackExpanded(false);
  }, [currentChunk?.id, currentStage?.kind]);

  useEffect(() => {
    setActiveSetChoice(null);
    setActiveSetFeedback(null);
  }, [currentChunk?.id]);

  useLayoutEffect(() => {
    if (!exercisePanelRef.current) return;
    getKatexAutoRender().then((renderMathInElement) => {
      if (renderMathInElement && exercisePanelRef.current) {
        try {
          renderMathInElement(exercisePanelRef.current, {
            delimiters: MATH_DELIMITERS,
            throwOnError: false,
            output: 'htmlAndMathml',
          });
        } catch {
          // KaTeX render failed silently
        }
      }
    });
  }, [currentChunk?.id, currentExercise?.type, activeSetChoice, activeSetFeedback, currentFeedback?.checked]);

  useLayoutEffect(() => {
    if (!assessmentListRef.current) return;
    getKatexAutoRender().then((renderMathInElement) => {
      if (renderMathInElement && assessmentListRef.current) {
        try {
          renderMathInElement(assessmentListRef.current, {
            delimiters: MATH_DELIMITERS,
            throwOnError: false,
            output: 'htmlAndMathml',
          });
        } catch {
          // KaTeX render failed silently
        }
      }
    });
  }, [currentStage?.kind, currentStage?.questions, assessmentResponses, assessmentResult]);

  const handleFeatureLockUpgrade = () => {
    closeFeatureLockModal();
    window.dispatchEvent(new CustomEvent('openUpgradeModal', {
      detail: {
        planKey: featureLockModal.planKey || 'serious',
        requiredPlan: featureLockModal.requiredPlan || 'Serious Student',
        source: 'lesson_feature_lock',
      }
    }));
  };

  const showLessonCompletionModal =
    isLessonComplete &&
    isLessonCompletionModalOpen &&
    (currentStage?.kind === 'assessment' || currentStageIndex >= stages.length - 1);

  useEffect(() => {
    if (!showLessonCompletionModal || typeof window === 'undefined') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      completionBreakButtonRef.current?.focus();
    }, 30);

    return () => window.clearTimeout(timeoutId);
  }, [showLessonCompletionModal]);

  const loadingLessonTitle = safeText(
    previewLessonFromState?.title ||
      location.state?.lesson?.title ||
      'Opening lesson'
  );

  if (loading) {
    return (
      <div className={`lesson-shell lesson-shell-state theme-${lessonTheme}`}>
        <div className="lesson-state-card">
          <div className="lesson-state-top">
            <span className="lesson-state-chip">Lesson</span>
            <span className="lesson-state-chip is-muted">Getting ready</span>
          </div>
          <div className="lesson-state-spinner" />
          <h2>{loadingLessonTitle}</h2>
          <p>Setting up the reading flow and your lesson space.</p>
          <div className="lesson-state-progress-preview" aria-hidden="true">
            <span className="is-active" />
            <span />
            <span />
            <span />
          </div>
          <div className="lesson-state-preview" aria-hidden="true">
            <div className="lesson-state-preview-card">
              <span className="lesson-state-preview-kicker" />
              <span className="lesson-state-preview-line is-long" />
              <span className="lesson-state-preview-line" />
              <span className="lesson-state-preview-line is-short" />
            </div>
            <div className="lesson-state-preview-panel">
              <span className="lesson-state-preview-media" />
              <span className="lesson-state-preview-caption" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (guestAccessBlocked) {
    return (
      <div className={`lesson-shell lesson-shell-state theme-${lessonTheme}`}>
        <div className="lesson-state-card">
          <h2>{guestAccessBlocked.title}</h2>
          <p>{guestAccessBlocked.message}</p>
          <div className="lesson-state-actions">
            <button type="button" className="lesson-state-primary" onClick={() => openAuthPrompt('register')}>
              Sign up for more
            </button>
            <Link to={lessonFallbackLink.to} state={lessonFallbackLink.state} className="lesson-state-secondary">
              {lessonFallbackLink.label}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className={`lesson-shell lesson-shell-state theme-${lessonTheme}`}>
        <div className="lesson-state-card">
          <h2>Lesson not found</h2>
          <p>The lesson you are looking for does not exist or has been removed.</p>
          <Link to={lessonFallbackLink.to} state={lessonFallbackLink.state} className="lesson-state-primary">
            {lessonFallbackLink.label}
          </Link>
        </div>
      </div>
    );
  }

  const currentDiscussionBoardSet = currentChunk?.id
    ? normalizeDiscussionBucket(discussionBoards[currentChunk.id])
    : createEmptyDiscussionBoards();
  const currentDiscussionEntries = discussionModal === 'discussion'
    ? [
        ...(currentDiscussionBoardSet.question || []).map((entry) => ({ ...entry, discussionType: 'question' })),
        ...(currentDiscussionBoardSet.comment || []).map((entry) => ({ ...entry, discussionType: 'comment' })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : discussionModal
      ? currentDiscussionBoardSet[discussionModal] || []
      : [];
  const highlightCount = highlights.length;
  const currentResponseDefault =
    currentExercise?.type === 'ordering' || currentExercise?.type === 'objective_set' ? [] : '';
  const currentResponse = currentChunk ? chunkResponses[currentChunk.id] ?? currentResponseDefault : currentResponseDefault;
  // The bottom action button reads differently while stepping through an
  // 'objective_set' one question at a time versus every other exercise type
  // (and versus the set's own final question, once the whole set is checked
  // and the standard checked/next-chunk flow below takes back over).
  const isObjectiveSetInProgress = currentExercise?.type === 'objective_set' && !currentFeedback?.checked;
  const objectiveSetIsLastQuestion =
    isObjectiveSetInProgress &&
    (Array.isArray(currentResponse) ? currentResponse.length : 0) >= (currentExercise?.questions?.length || 1) - 1;
  const objectiveSetPrimaryAction = isObjectiveSetInProgress
    ? {
        label: activeSetFeedback ? (objectiveSetIsLastQuestion ? 'Finish Set' : 'Next Question') : 'Check Answer',
        handler: activeSetFeedback ? handleObjectiveSetAdvance : handleObjectiveSetCheck,
        disabled: activeSetFeedback ? false : !activeSetChoice,
      }
    : {
        label: currentFeedback?.checked ? 'Answer Checked' : 'Check Answer',
        handler: handleCheckAnswer,
        disabled: Boolean(currentFeedback?.checked),
      };
  const currentAssessmentQuestions = currentStage?.kind === 'assessment' ? currentStage.questions || [] : [];
  const currentUserRank = liveUserRank;
  const headerXpLabel = animatedHeaderXp.toLocaleString();
  const headerRankLabel = formatOrdinal(animatedHeaderRank ?? currentUserRank);
  const currentChunkOrder =
    currentStage?.kind === 'assessment'
      ? Math.max(lessonBlocks.length, 1)
      : Number(currentChunk?.order || 1);
  const currentLessonNumber = resolvedLessonNumber;
  const currentUserDiscussionKey = getUserKey(user);
  const currentStageLabel =
    currentStage?.kind === 'assessment'
      ? 'Final Test'
      : currentStage?.kind === 'exercise'
        ? 'Exercise'
        : 'Chunk';
  const currentStageProgressLabel =
    currentStage?.kind === 'assessment'
      ? `Lesson ${currentLessonNumber} | Final Test`
      : `Lesson ${currentLessonNumber} | ${currentStageLabel} ${currentChunkOrder}`;
  // Mobile header space is tight (kicker badge shares a grid row with the
  // back button and header actions) — "Exercise" is abbreviated to "Ex" there.
  const currentStageProgressLabelShort =
    currentStage?.kind === 'assessment'
      ? `Lesson ${currentLessonNumber} | Final Test`
      : `Lesson ${currentLessonNumber} | ${currentStageLabel === 'Exercise' ? 'Ex' : currentStageLabel} ${currentChunkOrder}`;
  const currentStageTopic = currentStage?.title || currentChunk?.title || lesson.title;
  const isLastStage = currentStageIndex >= stages.length - 1;
  const currentChunkElapsedSeconds = currentChunk?.id ? Number(contentChunkElapsed[currentChunk.id] || 0) : 0;
  const currentChunkCompleteDelaySeconds = CHUNK_COMPLETE_DELAY_SECONDS;
  const isChunkCompletionReady =
    currentStage?.kind === 'content' && currentChunkElapsedSeconds >= currentChunkCompleteDelaySeconds;
  const shouldRenderCompletedProgress =
    isLessonComplete && (lessonCompletionSummary.key > 0 || currentStage?.kind === 'assessment');
  const currentChunkProgress = shouldRenderCompletedProgress
    ? 1
    : currentStage?.kind === 'content'
      ? 0.45
      : currentStage?.kind === 'assessment'
        ? assessmentResult?.passed
          ? 1
          : 0.82
      : currentFeedback?.checked
        ? 1
        : 0.76;
  const showPreviousChunkButton = currentChunkOrder > 1;
  const showFooterPrimaryAction = currentStage?.kind === 'exercise';
  const showFooter = currentStage?.kind === 'content' && showPreviousChunkButton;
  const activeLessonCompletionSummary = lessonCompletionSummary.key
    ? lessonCompletionSummary
    : {
        ...EMPTY_COMPLETION_SUMMARY,
        headline: nextLessonInSequence ? 'Well done' : 'Good job',
        body: isPrelimLesson
          ? nextLessonInSequence
            ? `You wrapped up this outline. Take a breather or continue to Prelim ${nextLessonInSequence.lessonNumber}.`
            : 'You wrapped up this outline. Take a breather or head back to your course.'
          : nextLessonInSequence
            ? `You wrapped up this lesson. Take a breather or continue to Lesson ${nextLessonInSequence.lessonNumber}.`
            : 'You wrapped up this lesson. Take a breather or head back to your course.',
        xpEarned: lessonXpEarned,
        rankBefore: null,
        rankAfter: currentUserRank,
        nextLesson: nextLessonInSequence,
      };
  const completionRankImprovement =
    Number.isFinite(Number(activeLessonCompletionSummary.rankBefore)) &&
    Number.isFinite(Number(activeLessonCompletionSummary.rankAfter))
      ? Math.max(0, Number(activeLessonCompletionSummary.rankBefore) - Number(activeLessonCompletionSummary.rankAfter))
      : 0;
  const completionRankLabel =
    Number.isFinite(Number(animatedCompletionRank)) && Number(animatedCompletionRank) > 0
      ? `#${animatedCompletionRank}`
      : Number.isFinite(Number(activeLessonCompletionSummary.rankAfter)) && Number(activeLessonCompletionSummary.rankAfter) > 0
        ? `#${activeLessonCompletionSummary.rankAfter}`
        : '—';
  const completionContinueLabel = activeLessonCompletionSummary.nextLesson?.lessonNumber
    ? `${isPrelimLesson ? 'Continue to Prelim' : 'Continue to Lesson'} ${activeLessonCompletionSummary.nextLesson.lessonNumber}`
    : 'Back to Course';
  const completionKicker = isPrelimLesson ? 'Done with outline' : 'Lesson completed';
  const showGuestCompletionPrompt = !user;
  const postExerciseAdvanceLabel =
    assessmentStageIndex >= 0 && currentStageIndex === assessmentStageIndex - 1
      ? 'Continue to Final Test'
      : 'Continue';
  const assessmentSummaryLabel = assessmentResult
    ? `${assessmentResult.correctCount}/${assessmentResult.totalQuestions} correct`
    : '';
  const assessmentDurationLabel = assessmentResult
    ? formatSharedDurationLabel(assessmentResult.durationSeconds)
    : formatSharedDurationLabel(assessmentElapsedSeconds);
  const contentPrimaryLabel = isPrelimLesson
    ? isLastStage
      ? 'Finish Prelim'
      : 'Next Chunk'
    : currentChunk?.exercise
      ? 'Continue with Exercise'
      : isLastStage
        ? 'Finish Lesson'
        : 'Next Chunk';
  const lessonSidebarItems = [
    {
      key: 'lesson-highlight',
      name: highlightMode ? 'Highlight Mode' : 'Highlight',
      icon: <FiEdit3 />,
      badge: highlightCount,
      active: highlightMode,
      onClick: handleHighlightToggle,
    },
    {
      key: 'lesson-like',
      name: 'Like',
      icon: <FiHeart />,
      badge: likeState.count,
      active: likeState.liked,
      disabled: likeState.pending,
      onClick: handleToggleLike,
    },
    {
      key: 'lesson-discussion',
      name: 'Discussion',
      icon: <FiMessageSquare />,
      badge: (currentDiscussionBoardSet.question?.length ?? 0) + (currentDiscussionBoardSet.comment?.length ?? 0),
      active: discussionModal === 'discussion',
      onClick: () => openDiscussionBoard('discussion'),
    },
    {
      key: 'lesson-error',
      name: 'Report Error',
      icon: <FiAlertTriangle />,
      badge: currentDiscussionBoardSet.error?.length || null,
      active: discussionModal === 'error',
      onClick: () => openDiscussionBoard('error'),
    },
    {
      key: 'lesson-save',
      name: saveToPlsState.saved ? 'Saved To PLS' : 'Save To PLS',
      icon: <FiBookmark />,
      active: saveToPlsState.saved,
      disabled: saveToPlsState.pending,
      onClick: handleSaveToPls,
    },
    {
      key: 'lesson-share',
      name: 'Share Lesson',
      icon: <FiShare2 />,
      active: shareSubmenuOpen,
      disabled: sharePending,
      keepRailOpen: true,
      onClick: () => setShareSubmenuOpen((current) => !current),
      children: [
        FEATURE_FLAGS.studyGroups && {
          key: 'lesson-share-study-groups',
          name: 'Study Groups',
          icon: <FiUsers />,
          onClick: handleShareToStudyGroup,
        },
        FEATURE_FLAGS.community && {
          key: 'lesson-share-community',
          name: 'Community',
          icon: <FiUsers />,
          onClick: handleShareToCommunity,
        },
        {
          key: 'lesson-share-social',
          name: 'Social Media',
          icon: <FiShare2 />,
          disabled: sharePending,
          onClick: handleShareLesson,
        },
      ].filter(Boolean),
    },
  ];

  return (
    <>
      {showCompletionFlash && (
        <div className="lesson-complete-flash" aria-hidden="true">
          <span className="lesson-complete-flash__icon">✅</span>
          <span className="lesson-complete-flash__label">Lesson Complete!</span>
        </div>
      )}
      <div className={`lesson-shell theme-${lessonTheme} ${highlightMode ? 'is-highlight-mode' : ''} ${isMobileRailOpen ? 'is-rail-open' : ''}`}>
        {!canAccess && (
          <div className="lesson-upgrade-strip">
            <UpgradePrompt
              requiredPlan="Serious Student"
              feature="premium lessons"
              onUpgrade={() => window.dispatchEvent(new CustomEvent('openUpgradeModal'))}
            />
          </div>
        )}

        <button
          type="button"
          className="lesson-rail-overlay"
          onClick={() => {
            setIsMobileRailOpen(false);
            setShareSubmenuOpen(false);
          }}
          aria-label="Close lesson tools"
        />

        <div className="lesson-shell-body">
          <div className="lesson-action-dock" aria-hidden="true" />

          <main className="lesson-stage-layout">
            <section className="lesson-main-panel">
              <div className="lesson-stage-header">
                <div className="lesson-stage-toolbar">
                  <button
                    type="button"
                    className="lesson-back-button lesson-stage-back"
                    onClick={handleBackToCourse}
                    aria-label="Back to course"
                  >
                    <FiArrowLeft />
                  </button>

                  <span className="lesson-stage-kicker lesson-stage-toolbar-kicker">
                    <span className="lesson-stage-kicker-full">{currentStageProgressLabel}</span>
                    <span className="lesson-stage-kicker-short">{currentStageProgressLabelShort}</span>
                  </span>

                  <div className="lesson-stage-toolbar-actions">
                    <button
                      type="button"
                      className="lesson-theme-toggle"
                      onClick={handleThemeToggle}
                      aria-label={lessonTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                      {lessonTheme === 'dark' ? <FiSun /> : <FiMoon />}
                    </button>

                    <div className="lesson-header-stat xp">
                      <span>XP</span>
                      <div>
                        <strong>{headerXpLabel}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="lesson-header-stat lesson-header-action rank"
                      onClick={handleOpenLeaderboard}
                      aria-label={currentUserRank ? `Open leaderboard. Current position ${headerRankLabel}` : 'Open leaderboard'}
                    >
                      <FiTrendingUp />
                      <div>
                        <strong>{headerRankLabel}</strong>
                      </div>
                    </button>

                    <div className="lesson-rail-dropdown-wrap">
                      <button
                        type="button"
                        className={`lesson-rail-header-trigger ${isMobileRailOpen ? 'is-open' : ''}`}
                        onClick={() => {
                          playUiSound('click');
                          setIsMobileRailOpen((current) => {
                            const next = !current;
                            if (!next) setShareSubmenuOpen(false);
                            return next;
                          });
                        }}
                        aria-label={isMobileRailOpen ? 'Hide lesson tools' : 'Show lesson tools'}
                        aria-expanded={isMobileRailOpen}
                      >
                        {isMobileRailOpen ? (
                          <FiX />
                        ) : (
                          <>
                            <FiMoreHorizontal className="lesson-rail-header-icon-desktop" />
                            <FiMoreVertical className="lesson-rail-header-icon-mobile" />
                          </>
                        )}
                      </button>
                      <aside
                        className="lesson-action-rail"
                        aria-label="Lesson tools"
                        onMouseLeave={() => setShareSubmenuOpen(false)}
                      >
                        {lessonSidebarItems.map((item) => (
                          <div key={item.key} className={`lesson-rail-item ${item.children?.length ? 'has-children' : ''}`}>
                            <button
                              type="button"
                              className={`lesson-rail-button ${item.active ? 'is-active' : ''}`}
                              onClick={() => {
                                item.onClick?.();
                                if (!item.keepRailOpen) {
                                  setIsMobileRailOpen(false);
                                }
                              }}
                              disabled={item.disabled}
                              aria-label={item.name}
                              aria-pressed={item.active ? 'true' : undefined}
                            >
                              <span className="lesson-rail-button-icon">{item.icon}</span>
                              <span className="lesson-rail-button-label">{item.name}</span>
                              {typeof item.badge !== 'undefined' && item.badge !== null ? <small>{item.badge}</small> : null}
                            </button>
                            {item.children?.length && item.active ? (
                              <div className="lesson-rail-submenu">
                                {item.children.map((child) => (
                                  <button
                                    key={child.key}
                                    type="button"
                                    className="lesson-rail-submenu-button"
                                    disabled={child.disabled}
                                    onClick={() => {
                                      child.onClick?.();
                                      setShareSubmenuOpen(false);
                                      setIsMobileRailOpen(false);
                                    }}
                                  >
                                    <span className="lesson-rail-submenu-icon">{child.icon}</span>
                                    <span>{child.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </aside>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`lesson-stage-topic-button lesson-stage-toolbar-topic ${isStageTopicExpanded ? 'is-expanded' : ''}`}
                    onClick={handleExpandStageTopic}
                    aria-label={`Show full ${currentStageLabel.toLowerCase()} topic: ${currentStageTopic}`}
                    aria-expanded={isStageTopicExpanded}
                  >
                    <span className="lesson-stage-topic-text">{currentStageTopic}</span>
                  </button>
                </div>
                <div className="lesson-stage-progress-line" aria-label={`Lesson progress: chunk ${currentChunkOrder} of ${lessonBlocks.length}`}>
                  {lessonBlocks.map((chunk, index) => {
                    const chunkOrder = index + 1;
                    const segmentProgress = shouldRenderCompletedProgress
                      ? 1
                      : chunkOrder < currentChunkOrder
                        ? 1
                        : chunkOrder === currentChunkOrder
                          ? currentChunkProgress
                          : 0;

                    return (
                      <span
                        key={chunk.id}
                        className={`lesson-progress-segment ${chunkOrder < currentChunkOrder || (chunkOrder === currentChunkOrder && segmentProgress >= 1) ? 'is-complete' : ''} ${chunkOrder === currentChunkOrder ? 'is-current' : ''}`}
                        style={{ '--segment-progress': `${Math.round(segmentProgress * 100)}%` }}
                        aria-hidden="true"
                      >
                        <i />
                      </span>
                    );
                  })}
                </div>
              </div>

              <div key={chunkAnimKey} className={`lesson-stage-card lesson-chunk-enter ${currentStage?.kind === 'assessment' ? 'is-assessment-stage-card' : ''}`.trim()}>
                {feedbackBurst.key > 0 && (
                  <div className={`lesson-burst lesson-burst-${feedbackBurst.tone}`}>
                    {feedbackParticles.map((particle, index) => (
                      <span
                        key={`${feedbackBurst.key}-${index}`}
                        className={`lesson-burst-particle ${particle.glitter ? 'is-glitter' : ''}`}
                        style={{
                          '--particle-x': `${particle.x}%`,
                          '--particle-y': `${particle.y}%`,
                          '--particle-dx': `${particle.dx}px`,
                          '--particle-dy': `${particle.dy}px`,
                          '--particle-delay': `${particle.delay}ms`,
                          '--particle-scale': particle.scale,
                        }}
                      />
                    ))}
                  </div>
                )}

                {currentStage?.kind === 'content' ? (
                  <div className="lesson-content-stage">
                    {highlightMode && (
                      <div className="lesson-mode-banner">
                        Highlight mode on. Select text to save it.
                      </div>
                    )}

                    {currentChunk?.type === 'text' && (
                      <div
                        className={`lesson-reading-layout ${currentChunk?.illustration ? 'has-illustration' : ''} ${
                          currentChunk?.illustration?.desktopAlign === 'left' ? 'is-illustration-left' : 'is-illustration-right'
                        }`}
                      >
                        <div
                          className="lesson-reading-surface"
                          data-highlight-chunk={currentChunk.id}
                          onMouseUp={handleSelectionHighlight}
                        >
                          {currentChunk?.sections?.length > 0
                            ? currentChunk.sections.map((section) => (
                                <div className="lesson-reading-subsection" key={`${currentChunk.id}-${section.id}`}>
                                  <h4 className="lesson-reading-subsection-title">{section.title}</h4>
                                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                                    <LessonParagraph
                                      key={`${currentChunk.id}-${section.id}-paragraph-${paragraphIndex}`}
                                      html={paragraph}
                                      highlights={highlights}
                                      chunkId={currentChunk.id}
                                    />
                                  ))}
                                </div>
                              ))
                            : currentChunk.paragraphs.map((paragraph, index) => (
                            <Fragment key={`${currentChunk.id}-paragraph-${index}`}>
                              {currentChunk?.illustration &&
                                shouldRenderIllustrationBeforeParagraph(
                                  currentChunk.illustration.mobilePosition,
                                  index
                                ) && (
                                  <div className="lesson-inline-illustration lesson-inline-illustration-mobile">
                                    <div className="lesson-inline-illustration-frame">
                                      <LessonIllustration
                                        src={currentChunk.illustration.src}
                                        alt={currentChunk.illustration.alt}
                                        fallbackSrc={buildFallbackImage(currentChunk.title, currentChunk.order)}
                                      />
                                    </div>
                                    <p>{currentChunk.illustration.caption}</p>
                                  </div>
                                )}
                              <LessonParagraph
                                html={paragraph}
                                highlights={highlights}
                                chunkId={currentChunk.id}
                              />
                              {currentChunk?.illustration &&
                                shouldRenderIllustrationAfterParagraph(
                                  currentChunk.illustration.mobilePosition,
                                  index,
                                  currentChunk.paragraphs.length
                                ) && (
                                <div className="lesson-inline-illustration lesson-inline-illustration-mobile">
                                  <div className="lesson-inline-illustration-frame">
                                    <LessonIllustration
                                      src={currentChunk.illustration.src}
                                      alt={currentChunk.illustration.alt}
                                      fallbackSrc={buildFallbackImage(currentChunk.title, currentChunk.order)}
                                    />
                                  </div>
                                  <p>{currentChunk.illustration.caption}</p>
                                </div>
                              )}
                            </Fragment>
                          ))}
                        </div>

                        {currentChunk?.illustration && (
                          <aside className="lesson-inline-illustration lesson-inline-illustration-desktop">
                            <div className="lesson-inline-illustration-frame">
                              <LessonIllustration
                                src={currentChunk.illustration.src}
                                alt={currentChunk.illustration.alt}
                                fallbackSrc={buildFallbackImage(currentChunk.title, currentChunk.order)}
                              />
                            </div>
                            <p>{currentChunk.illustration.caption}</p>
                          </aside>
                        )}
                      </div>
                    )}

                    {currentChunk?.type === 'image' && (
                      <div className="lesson-illustration-card">
                        <div className="lesson-illustration-frame">
                          <LessonIllustration
                            src={currentChunk.src}
                            alt={currentChunk.alt}
                            fallbackSrc={buildFallbackImage(currentChunk.title, currentChunk.order)}
                          />
                        </div>
                        <div className="lesson-illustration-copy">
                          <h3>{currentChunk.title}</h3>
                          <p>{currentChunk.caption}</p>
                        </div>
                      </div>
                    )}

                    {currentChunk?.type === 'video' && (
                      <div className="lesson-video-card">
                        <div className="lesson-video-frame">
                          <video src={currentChunk.src} controls className="lesson-video-player" />
                        </div>
                        <div className="lesson-illustration-copy">
                          <h3>{currentChunk.title}</h3>
                          <p>{currentChunk.caption}</p>
                        </div>
                      </div>
                    )}

                    {isChunkCompletionReady && (
                      <div className="lesson-unlock-panel">
                        <div className="lesson-unlock-copy">
                          <span>Done with chunk?</span>
                        </div>

                        <div className="lesson-unlock-actions">
                          <button
                            type="button"
                            className="lesson-next-chunk-btn secondary"
                            onClick={handleReviewCurrentChunk}
                          >
                            Review this Chunk
                          </button>

                          <button
                            type="button"
                            className="lesson-next-chunk-btn"
                            onClick={handleAdvance}
                          >
                            {contentPrimaryLabel}
                            <FiChevronRight />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : currentStage?.kind === 'exercise' ? (
                  <div className={`lesson-exercise-stage ${currentFeedback?.checked ? '' : 'is-solo'}`.trim()}>
                    <div ref={exercisePanelRef} className={`lesson-exercise-panel type-${currentExercise?.type || 'default'}`}>
                      <span className="lesson-exercise-type">
                        {currentExercise?.type === 'multiple_choice'
                          ? 'Multiple Choice'
                          : currentExercise?.type === 'true_false'
                            ? 'True Or False'
                            : currentExercise?.type === 'objective_set'
                              ? 'Quick Check'
                              : currentExercise?.type === 'ordering'
                                ? 'Put In Order'
                                : currentExercise?.type === 'fill_in'
                                  ? 'Fill In'
                                  : 'Theory'}
                      </span>
                      <div className="lesson-exercise-header">
                        <div className="lesson-exercise-heading">
                          <div className="lesson-exercise-title-row">
                            <h3>{currentExercise?.prompt}</h3>
                          </div>
                        </div>
                      </div>

                      {(currentExercise?.type === 'multiple_choice' || currentExercise?.type === 'true_false') && (
                        <div className="lesson-choice-grid">
                          {currentExercise?.options?.map((option, optionIndex) => {
                            const isSelected = normalizeText(currentResponse) === normalizeText(option);
                            const optionLabel = String.fromCharCode(65 + optionIndex);

                            return (
                              <label
                                key={option}
                                className={`lesson-choice-card ${isSelected ? 'is-selected' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={currentChunk?.id}
                                  value={option}
                                  checked={isSelected}
                                  onChange={() =>
                                    handleExerciseResponseChange(currentChunk.id, option, { fromOptionSelect: true })
                                  }
                                />
                                <span className="lesson-choice-marker">{optionLabel}</span>
                                <span className="lesson-choice-copy">{option}</span>
                                <span className="lesson-choice-state" aria-hidden="true" />
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {currentExercise?.type === 'objective_set' && (() => {
                        const questions = currentExercise.questions || [];
                        const answeredCount = Array.isArray(currentResponse) ? currentResponse.length : 0;
                        const activeIndex = Math.min(answeredCount, Math.max(0, questions.length - 1));
                        const activeQuestion = questions[activeIndex];
                        if (!activeQuestion) return null;
                        const isSetChecked = Boolean(currentFeedback?.checked);
                        const displayedFeedback = isSetChecked ? null : activeSetFeedback;

                        return (
                          <div className="lesson-objective-set">
                            <div className="lesson-objective-set-progress">
                              Question {activeIndex + 1} of {questions.length}
                            </div>
                            <p className="lesson-objective-set-question">{activeQuestion.prompt}</p>
                            <div className="lesson-choice-grid">
                              {activeQuestion.options.map((option, optionIndex) => {
                                const isSelected = normalizeText(activeSetChoice) === normalizeText(option);
                                const optionLabel = String.fromCharCode(65 + optionIndex);

                                return (
                                  <label
                                    key={option}
                                    className={`lesson-choice-card ${isSelected ? 'is-selected' : ''}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`${currentChunk?.id}-set-${activeIndex}`}
                                      value={option}
                                      checked={isSelected}
                                      onChange={() =>
                                        !isSetChecked && !displayedFeedback && handleObjectiveSetSelect(option)
                                      }
                                      disabled={isSetChecked || Boolean(displayedFeedback)}
                                    />
                                    <span className="lesson-choice-marker">{optionLabel}</span>
                                    <span className="lesson-choice-copy">{option}</span>
                                    <span className="lesson-choice-state" aria-hidden="true" />
                                  </label>
                                );
                              })}
                            </div>
                            {displayedFeedback && (
                              <div
                                className={`lesson-objective-set-feedback ${displayedFeedback.correct ? 'is-correct' : 'is-wrong'}`}
                              >
                                {displayedFeedback.correct
                                  ? 'Correct.'
                                  : `Not quite. Correct answer: ${displayedFeedback.expectedAnswer}`}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {currentExercise?.type === 'ordering' && (() => {
                        const orderIds = Array.isArray(currentResponse) && currentResponse.length === shuffledOrderingItems.length
                          ? currentResponse
                          : shuffledOrderingItems.map((item) => item.id);
                        const itemById = new Map(shuffledOrderingItems.map((item) => [item.id, item]));
                        return (
                          <div className="lesson-ordering-list">
                            {orderIds.map((itemId, index) => (
                              <div className="lesson-ordering-row" key={itemId}>
                                <span className="lesson-ordering-index">{index + 1}</span>
                                <span className="lesson-ordering-text">{itemById.get(itemId)?.text}</span>
                                <span className="lesson-ordering-controls">
                                  <button
                                    type="button"
                                    aria-label="Move up"
                                    onClick={() => handleOrderingMove(currentChunk.id, orderIds, index, -1)}
                                    disabled={index === 0 || Boolean(currentFeedback?.checked)}
                                  >
                                    <FiChevronUp />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Move down"
                                    onClick={() => handleOrderingMove(currentChunk.id, orderIds, index, 1)}
                                    disabled={index === orderIds.length - 1 || Boolean(currentFeedback?.checked)}
                                  >
                                    <FiChevronDown />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {(currentExercise?.type === 'fill_in' || currentExercise?.type === 'theory') && (
                        <div className="lesson-free-response">
                          <div className="lesson-free-response-head">
                            <strong>Your response</strong>
                            <span>{currentExercise?.type === 'theory' ? 'Short written answer' : 'One precise answer'}</span>
                          </div>
                          <textarea
                            value={currentResponse}
                            onChange={(event) => handleExerciseResponseChange(currentChunk.id, event.target.value)}
                            rows={currentExercise?.type === 'theory' ? 6 : 4}
                            placeholder={currentExercise?.placeholder || 'Type your answer'}
                          />
                        </div>
                      )}

                      <div className="lesson-exercise-actions">
                        <button
                          type="button"
                          className="lesson-next-chunk-btn secondary"
                          onClick={handlePeekLesson}
                        >
                          <FiArrowLeft />
                          Peek Lesson
                        </button>

                        <button
                          type="button"
                          className="lesson-check-answer"
                          onClick={objectiveSetPrimaryAction.handler}
                          disabled={objectiveSetPrimaryAction.disabled}
                        >
                          {objectiveSetPrimaryAction.label}
                        </button>
                      </div>
                    </div>

                    {currentFeedback?.checked && (
                      <div
                        ref={feedbackPanelRef}
                        className={`lesson-feedback-panel ${currentFeedback.correct ? 'is-correct' : 'is-wrong'}`}
                      >
                        <div className="lesson-feedback-header">
                          <div className="lesson-feedback-heading">
                            {currentFeedback.correct ? (
                              <>
                                <FiCheckCircle />
                                <div>
                                  <strong>Correct</strong>
                                  <span>You matched the core idea of this chunk.</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <FiXCircle />
                                <div>
                                  <strong>Not quite yet</strong>
                                  <span>Take the explanation below and lock the concept in.</span>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="lesson-feedback-points">
                            <span>XP Earned</span>
                            <strong>+{animatedFeedbackPoints}</strong>
                          </div>
                        </div>

                        <div className="lesson-feedback-body">
                          <button
                            type="button"
                            className={`lesson-feedback-disclosure ${isFeedbackExpanded ? 'is-open' : ''}`}
                            onClick={() => setIsFeedbackExpanded((previous) => !previous)}
                            aria-expanded={isFeedbackExpanded}
                          >
                            <span>{currentFeedback.correct ? 'Why this works' : 'Explanation'}</span>
                            <FiChevronDown />
                          </button>

                          {isFeedbackExpanded && (
                            <>
                              {!currentFeedback.correct && expectedFeedbackAnswer && (
                                <div className="lesson-feedback-answer">
                                  <span>Expected answer</span>
                                  <strong>{expectedFeedbackAnswer}</strong>
                                </div>
                              )}

                              {hasFeedbackExplanation && (
                                <div className="lesson-feedback-explanation">
                                  <p>{feedbackExplanationText}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="lesson-feedback-actions">
                          <button type="button" className="lesson-continue-btn" onClick={handleAdvance}>
                            {postExerciseAdvanceLabel}
                            <FiChevronRight />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`lesson-assessment-stage ${assessmentResult ? 'has-result' : ''}`.trim()}>
                    <div className="lesson-assessment-panel">
                      <div className="lesson-assessment-head">
                        <div className="lesson-assessment-copy">
                          <span>Final lesson test</span>
                          <h3>Bring the whole lesson together before you complete it.</h3>
                          <p>
                            This assessment combines all the chunk exercises for this lesson. Pass it before the lesson is marked complete.
                          </p>
                        </div>
                        <div className="lesson-assessment-meta">
                          <strong>{currentAssessmentQuestions.length} questions</strong>
                          <small>{assessmentDurationLabel}</small>
                        </div>
                      </div>

                      <div ref={assessmentListRef} className="lesson-assessment-list">
                        {currentAssessmentQuestions.map((question, questionIndex) => {
                          const questionExercise = question.exercise;
                          const response = assessmentResponses[question.id] || '';

                          return (
                            <section key={question.id} className="lesson-assessment-question">
                              <div className="lesson-assessment-question-head">
                                <span>{`Question ${questionIndex + 1}`}</span>
                                <small>
                                  {question.chunkId ? `Chunk ${question.chunkOrder}: ${question.chunkTitle}` : 'Lesson Review'}
                                </small>
                              </div>
                              <h4>{questionExercise?.prompt}</h4>

                              {(questionExercise?.type === 'multiple_choice' || questionExercise?.type === 'true_false') && (
                                <div className="lesson-assessment-choice-list">
                                  {questionExercise?.options?.map((option, optionIndex) => {
                                    const isSelected = normalizeText(response) === normalizeText(option);
                                    const optionLabel = String.fromCharCode(65 + optionIndex);

                                    return (
                                      <label
                                        key={`${question.id}-${option}`}
                                        className={`lesson-choice-card ${isSelected ? 'is-selected' : ''}`}
                                      >
                                        <input
                                          type="radio"
                                          name={question.id}
                                          value={option}
                                          checked={isSelected}
                                          onChange={() =>
                                            handleAssessmentResponseChange(question.id, option, {
                                              fromOptionSelect: true,
                                            })
                                          }
                                        />
                                        <span className="lesson-choice-marker">{optionLabel}</span>
                                        <span className="lesson-choice-copy">{option}</span>
                                        <span className="lesson-choice-state" aria-hidden="true" />
                                      </label>
                                    );
                                  })}
                                </div>
                              )}

                              {(questionExercise?.type === 'fill_in' || questionExercise?.type === 'theory') && (
                                <div className="lesson-free-response lesson-assessment-response">
                                  <textarea
                                    value={response}
                                    onChange={(event) => handleAssessmentResponseChange(question.id, event.target.value)}
                                    rows={questionExercise?.type === 'theory' ? 5 : 3}
                                    placeholder={questionExercise?.placeholder || 'Type your answer'}
                                  />
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </div>

                      {!assessmentResult ? (
                        <div className="lesson-assessment-actions">
                          <button type="button" className="lesson-check-answer" onClick={handleSubmitAssessment}>
                            Submit Final Test
                          </button>
                        </div>
                      ) : (
                        <div
                          ref={assessmentResultRef}
                          className={`lesson-assessment-result ${assessmentResult.passed ? 'is-pass' : 'is-fail'}`}
                        >
                          <div className="lesson-assessment-result-head">
                            <div className="lesson-assessment-result-copy">
                              <strong>{assessmentResult.passed ? 'Final test passed' : 'Final test not passed yet'}</strong>
                              <p>
                                {assessmentResult.passed
                                  ? 'Learning has landed. You can complete the lesson now.'
                                  : `You need ${SHARED_FINAL_ASSESSMENT_PASS_PERCENT}% to complete this lesson or jump ahead.`}
                              </p>
                            </div>
                            <div className="lesson-assessment-result-stats">
                              <strong>{assessmentResult.percentScore}%</strong>
                              <small>{`${assessmentSummaryLabel} • ${formatSharedDurationLabel(assessmentResult.durationSeconds)}`}</small>
                            </div>
                          </div>

                          <div className="lesson-assessment-result-actions">
                            <button type="button" className="lesson-next-chunk-btn secondary" onClick={handleRetakeAssessment}>
                              Take test again
                            </button>
                            <button
                              type="button"
                              className="lesson-next-chunk-btn"
                              onClick={handleAdvance}
                              disabled={!assessmentResult.passed}
                            >
                              Complete Lesson
                              <FiChevronRight />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </section>

              {showFooter && (
                <footer className={`lesson-shell-footer ${currentStage?.kind === 'content' ? 'is-content-stage' : ''}`}>
                  <div className="lesson-footer-actions">
                    {showPreviousChunkButton && (
                      <button type="button" className="lesson-footer-btn secondary" onClick={handlePreviousChunk}>
                        <FiChevronLeft />
                        <span>Previous</span>
                      </button>
                    )}
                    {showFooterPrimaryAction && (
                      <button
                        type="button"
                        className="lesson-footer-btn primary"
                        onClick={handleAdvance}
                        disabled={!currentFeedback?.checked}
                      >
                        <span>{postExerciseAdvanceLabel}</span>
                        <FiChevronRight />
                      </button>
                    )}
                  </div>
                </footer>
              )}
          </main>
        </div>

        {showLessonCompletionModal && (
          <div className="lesson-discussion-overlay lesson-completion-overlay" role="presentation">
            <section
              className="lesson-complete-banner lesson-discussion-modal lesson-completion-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lesson-completion-title"
            >
              {activeLessonCompletionSummary.key > 0 && (
                <div className="lesson-complete-confetti" aria-hidden="true">
                  {LESSON_COMPLETE_PARTICLES.map((particle, index) => (
                    <span
                      key={`${activeLessonCompletionSummary.key}-${particle.x}-${index}`}
                      className={`lesson-complete-confetti-piece is-${particle.hue}`}
                      style={{
                        '--lesson-glitter-x': particle.x,
                        '--lesson-glitter-drift': particle.drift,
                        '--lesson-glitter-delay': particle.delay,
                        '--lesson-glitter-duration': particle.duration,
                      }}
                    >
                      <span className="lesson-complete-confetti-shape" />
                    </span>
                  ))}
                </div>
              )}

              <div className="lesson-complete-head">
                <div className="lesson-complete-copy">
                  <span className="lesson-complete-kicker">{completionKicker}</span>
                  <div className="lesson-complete-title-row">
                    <span className="lesson-complete-title-mark" aria-hidden="true">🎉</span>
                    <h3 id="lesson-completion-title">{activeLessonCompletionSummary.headline}</h3>
                  </div>
                  <p>{activeLessonCompletionSummary.body}</p>
                  {showGuestCompletionPrompt && (
                    <p className="lesson-complete-guest-note">
                      This progress will not be saved because you are not in a user account.
                      {' '}
                      <button
                        type="button"
                        className="lesson-complete-inline-link"
                        onClick={() => openAuthPrompt('login')}
                      >
                        Login
                      </button>
                      {' '}
                      or
                      {' '}
                      <button
                        type="button"
                        className="lesson-complete-inline-link"
                        onClick={() => openAuthPrompt('register')}
                      >
                        register
                      </button>
                      {' '}
                      to save.
                    </p>
                  )}
                </div>
              </div>

              <div className="lesson-complete-stats">
                <article className="lesson-complete-stat">
                  <span>Points earned</span>
                  <strong>+{animatedCompletionXp}</strong>
                  <small>Lesson total</small>
                </article>

                <article className="lesson-complete-stat">
                  <span>Leaderboard</span>
                  <strong>{completionRankLabel}</strong>
                  <small>
                    {completionRankImprovement > 0
                      ? `Up ${completionRankImprovement} ${completionRankImprovement === 1 ? 'place' : 'places'}`
                      : activeLessonCompletionSummary.rankAfter
                        ? 'Weekly rank updated'
                        : 'Rank appears after sync'}
                  </small>
                </article>
              </div>

              <div className="lesson-complete-actions">
                <button
                  ref={completionBreakButtonRef}
                  type="button"
                  className="lesson-complete-btn secondary"
                  onClick={showGuestCompletionPrompt ? handleCompletionBreak : handleBackToCourse}
                >
                  <FiCoffee />
                  <span>Take a break</span>
                </button>
                <button
                  type="button"
                  className="lesson-complete-btn primary"
                  onClick={showGuestCompletionPrompt ? handleCompletionContinue : handleContinueToNextLesson}
                >
                  <span>{completionContinueLabel}</span>
                  <FiChevronRight />
                </button>
              </div>
            </section>
          </div>
        )}

        {supportStatus && <div className="lesson-support-toast">{supportStatus}</div>}
      </div>

      <LessonDiscussionModal
        type={discussionModal}
        entries={currentDiscussionEntries}
        draft={discussionDraft}
        composerType={discussionComposerType}
        replyDrafts={replyDrafts}
        activeReplyTarget={activeReplyTarget}
        theme={lessonTheme}
        currentUserKey={currentUserDiscussionKey}
        onClose={() => setDiscussionModal('')}
        onDraftChange={setDiscussionDraft}
        onComposerTypeChange={setDiscussionComposerType}
        onReplyDraftChange={handleReplyDraftChange}
        onSubmit={handleDiscussionSubmit}
        onReply={handleReplySubmit}
        onOpenReply={handleToggleReplyTarget}
        onCloseReply={() => setActiveReplyTarget('')}
        onToggleLike={handleDiscussionLikeToggle}
        onEditEntry={handleEditDiscussionEntry}
        onEditReply={handleEditDiscussionReply}
      />

      {showLeaderboardModal && (
        <div
          className="lesson-discussion-overlay lesson-thread-overlay"
          role="presentation"
          onClick={() => setShowLeaderboardModal(false)}
        >
          <div
            className="lesson-discussion-modal lesson-thread-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Leaderboard"
            onClick={(e) => e.stopPropagation()}
          >
            <ProgressLeaderboardDrawer
              open={showLeaderboardModal}
              onClose={() => setShowLeaderboardModal(false)}
              leaderboard={Array.isArray(leaderboard) ? leaderboard : []}
              leaderboardRank={currentUserRank}
              userId={user?.id}
              loadingInitial={gamificationLoading && (!Array.isArray(leaderboard) || leaderboard.length === 0)}
              refreshLeaderboard={refreshLeaderboard}
            />
          </div>
        </div>
      )}

      <UpgradeModalHost />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setAuthOnboardingStep(null);
        }}
        initialMode={authMode}
        forceOnboardingStep={authOnboardingStep}
      />

      <FeatureLockModal
        isOpen={featureLockModal.isOpen}
        featureLabel={featureLockModal.featureLabel}
        requiredPlan={featureLockModal.requiredPlan}
        message={featureLockModal.message}
        onUpgrade={handleFeatureLockUpgrade}
        onClose={closeFeatureLockModal}
      />

      <ShareToStudyGroupModal
        open={studyGroupShareOpen}
        onClose={() => setStudyGroupShareOpen(false)}
        sharePayload={studyGroupSharePayload}
      />

      <ShareToCommunityModal
        open={communityShareOpen}
        onClose={() => setCommunityShareOpen(false)}
        sharePayload={studyGroupSharePayload}
      />

      <ConfettiOverlay
        active={lessonCelebrationMode !== null}
        mode={lessonCelebrationMode || 'burst'}
        onDone={() => setLessonCelebrationMode(null)}
      />

      <ConfettiOverlay
        active={assessmentCelebration}
        mode="burst"
        onDone={() => setAssessmentCelebration(false)}
      />
    </>
  );
}
