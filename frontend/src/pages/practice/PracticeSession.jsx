import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScoreRing from './ScoreRing';
import {
  safeText, getOrCreateAudioContext, playPracticeCompletionTone,
  firstText, normalizeText, getUserRankFromEntries,
  getPracticePillLabel, getPracticeActionLabel,
  getBackTarget, getQuestionState, buildPersistencePayload,
  PRACTICE_DISCUSSION_PREFIX,
} from './practiceSessionHelpers';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiFlag,
  FiHeart,
  FiMessageSquare,
  FiMoon,
  FiRefreshCw,
  FiShare2,
  FiSun,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import DiscussionPanel, { getUserKey, saveStoredJson, createEmptyDiscussionBoards, normalizeDiscussionBucket } from '../../components/discussion/DiscussionPanel';
import ShareToCommunityModal from '../../components/community/ShareToCommunityModal';
import ProgressLeaderboardDrawer from '../ProgressLeaderboardDrawer';
import { useContent } from '../../hooks/useContent';
import { formatOrdinalRank } from '../../utils/formatOrdinalRank';
import usePageTitle from '../../hooks/usePageTitle';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useGamification } from '../../hooks/useGamification';
import CoursePageSkeleton from '../../components/common/CoursePageSkeleton';
import UpgradePrompt from '../../components/subscription/UpgradePrompt';
import ConfettiOverlay from '../../components/gamification/ConfettiOverlay';
import ShareToStudyGroupModal from '../../components/studyGroups/ShareToStudyGroupModal';
import contentService from '../../services/contentService';
import { evaluateExercise, formatDurationLabel } from '../../utils/lessonAssessment';
import {
  getStoredThemePreference,
  resolveThemePreference,
  saveThemePreference,
  subscribeToSystemThemeChange,
} from '../../utils/theme';
import { playUiSound } from '../../utils/uiSounds';
import {
  PRACTICE_PASS_PERCENT,
  buildPracticeQuestions,
  evaluatePracticeSubmission,
  getPracticeTimerSeconds,
} from '../../utils/practiceSession';
import { stripPracticeCourseTitleSuffix } from '../../utils/practiceCourseTitle';
import { findSamplePracticeById } from '../../utils/samplePracticePapers';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import '../learn/LessonViewer.css';
import './PracticeSession.css';


export default function PracticeSession() {
  const { practiceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasFeature } = useSubscription();
  const { trackEvent } = useAnalytics();
  const {
    xp,
    leaderboard,
    leaderboardRank,
    loading: gamificationLoading,
    refreshLeaderboard,
    getUserRank,
  } = useGamification();
  const { likeContent } = useContent();

  const seededPractice = location.state?.practiceItem || null;
  const matchedSamplePractice = useMemo(() => findSamplePracticeById(practiceId), [practiceId]);
  const [practice, setPractice] = useState(seededPractice);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [submissionError, setSubmissionError] = useState('');
  const [attemptSummary, setAttemptSummary] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const [practiceTheme, setPracticeTheme] = useState(() => resolveThemePreference(getStoredThemePreference()));
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [studyGroupShareOpen, setStudyGroupShareOpen] = useState(false);
  const [communityShareOpen, setCommunityShareOpen] = useState(false);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [shareSubmenuOpen, setShareSubmenuOpen] = useState(false);
  const [celebrationMode, setCelebrationMode] = useState(null);
  const [likeState, setLikeState] = useState({ liked: false, count: 0, pending: false });
  const [discussionModal, setDiscussionModal] = useState('');
  const [practiceDiscussionBoard, setPracticeDiscussionBoard] = useState(createEmptyDiscussionBoards);
  const [discussionDraft, setDiscussionDraft] = useState('');
  const [discussionComposerType, setDiscussionComposerType] = useState('comment');
  const [discussionReplyDrafts, setDiscussionReplyDrafts] = useState({});
  const [discussionActiveReply, setDiscussionActiveReply] = useState('');
  const [questionEvals, setQuestionEvals] = useState({});

  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const submittingRef = useRef(false);
  const audioContextRef = useRef(null);
  const questionNavRef = useRef(null);

  usePageTitle(practice?.title || 'Practice Session');

  const practiceQuestions = useMemo(() => buildPracticeQuestions(practice || {}), [practice]);
  const timerDurationSeconds = useMemo(
    () => getPracticeTimerSeconds(practice || {}, practiceQuestions),
    [practice, practiceQuestions]
  );
  const evaluationMap = useMemo(() => {
    const entries = attemptSummary?.evaluations || [];
    return entries.reduce((accumulator, entry) => {
      accumulator[entry.id] = entry;
      return accumulator;
    }, {});
  }, [attemptSummary]);
  const practicePillLabel = useMemo(() => getPracticePillLabel(practice), [practice]);
  const practiceActionLabel = useMemo(() => getPracticeActionLabel(practice), [practice]);
  const courseName = stripPracticeCourseTitleSuffix(
    firstText(
      location.state?.course?.title,
      practice?.course?.title,
      practice?.course_title,
      practice?.course,
      practice?.metadata?.course_title,
      practice?.metadata?.source_title,
    ) || 'Practice Session',
  );
  const studyGroupSharePayload = useMemo(() => {
    if (!practice) return null;
    const path =
      typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
    return {
      kind: 'practice',
      title: practice?.title || 'Practice session',
      subtitle: courseName,
      url: path || `/practice/session/${practiceId}`,
    };
  }, [practice, practiceId, courseName]);

  const communitySharePayload = useMemo(() => {
    if (!practice) return null;
    const path =
      typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
    return {
      kind: 'practice',
      title: practice?.title || 'Practice session',
      subtitle: courseName,
      url: path || `/practice/session/${practiceId}`,
    };
  }, [practice, practiceId, courseName]);
  const canAccess = !practice?.is_premium || hasFeature('premium_content');
  const backTarget = useMemo(() => getBackTarget(location.state || {}), [location.state]);
  const isTimerCritical = phase === 'active' && remainingSeconds <= 60;
  const currentQuestion = practiceQuestions[currentQuestionIndex] || null;
  const currentEvaluation = currentQuestion ? evaluationMap[currentQuestion.id] || null : null;
  const canReviewAnswers = Boolean(attemptSummary?.evaluations?.length);
  const currentUserRank = useMemo(
    () =>
      (Number.isFinite(Number(leaderboardRank)) && Number(leaderboardRank) > 0
        ? Number(leaderboardRank)
        : null) ??
      getUserRankFromEntries(leaderboard, user?.id) ??
      getUserRank(),
    [getUserRank, leaderboard, leaderboardRank, user?.id]
  );
  const answeredQuestionCount = useMemo(
    () => practiceQuestions.filter((question) => safeText(responses[question.id])).length,
    [practiceQuestions, responses]
  );
  const isCurrentChecked = phase === 'active' && currentQuestion ? Boolean(questionEvals[currentQuestion.id]) : false;
  const currentImmediateEval = phase === 'active' && currentQuestion ? (questionEvals[currentQuestion.id] || null) : null;
  const hasCurrentResponse = phase === 'active' && currentQuestion ? Boolean(safeText(responses[currentQuestion.id])) : false;
  const allQuestionsChecked = phase === 'active' && practiceQuestions.length > 0 && practiceQuestions.every((q) => Boolean(questionEvals[q.id]));
  const timerDisplay = formatDurationLabel(phase === 'active' ? remainingSeconds : timerDurationSeconds);
  const practiceYear = (() => {
    const sources = [
      practice?.metadata?.sitting_date,
      practice?.metadata?.time_window,
      practice?.metadata?.session_label,
      practice?.metadata?.source_label,
      practice?.title,
    ];
    for (const src of sources) {
      const m = String(src || '').match(/\b(19|20)\d{2}\b/);
      if (m) return m[0];
    }
    return '';
  })();
  const headerKicker = `${practicePillLabel}${practiceYear ? ` | ${practiceYear}` : ''}`;
  const headerTopic = courseName;
  const progressSegments = useMemo(
    () =>
      practiceQuestions.map((question, index) => {
        if (phase === 'submitted') {
          return {
            id: question.id,
            progress: 1,
            complete: true,
            current: false,
          };
        }

        if (phase === 'review') {
          const evaluation = evaluationMap[question.id];
          return {
            id: question.id,
            progress: index === currentQuestionIndex ? 1 : evaluation ? 1 : 0,
            complete: Boolean(evaluation),
            current: index === currentQuestionIndex,
          };
        }

        if (phase === 'active') {
          const hasResponse = Boolean(safeText(responses[question.id]));
          return {
            id: question.id,
            progress: index < currentQuestionIndex ? 1 : index === currentQuestionIndex ? (hasResponse ? 0.82 : 0.46) : 0,
            complete: index < currentQuestionIndex || hasResponse,
            current: index === currentQuestionIndex,
          };
        }

        return {
          id: question.id,
          progress: index === 0 ? 0.28 : 0,
          complete: false,
          current: index === 0,
        };
      }),
    [currentQuestionIndex, evaluationMap, phase, practiceQuestions, responses]
  );

  const practiceDiscussionStorageKey = useMemo(
    () => (practiceId ? `${PRACTICE_DISCUSSION_PREFIX}:${practiceId}` : ''),
    [practiceId]
  );

  const currentDiscussionEntries = useMemo(() => {
    if (discussionModal === 'discussion') {
      return [
        ...(practiceDiscussionBoard.question || []).map((e) => ({ ...e, discussionType: 'question' })),
        ...(practiceDiscussionBoard.comment || []).map((e) => ({ ...e, discussionType: 'comment' })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return discussionModal ? practiceDiscussionBoard[discussionModal] || [] : [];
  }, [discussionModal, practiceDiscussionBoard]);

  useEffect(() => {
    if (!practice) return;
    setLikeState((prev) => ({
      ...prev,
      liked: Boolean(practice.is_liked),
      count: Number(practice.like_count ?? practice.likes ?? prev.count),
    }));
  }, [practice]);

  useEffect(() => {
    if (!practiceDiscussionStorageKey) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(practiceDiscussionStorageKey) || 'null');
      if (stored && typeof stored === 'object') setPracticeDiscussionBoard(normalizeDiscussionBucket(stored));
    } catch {
      // Ignore malformed or unavailable cached discussion state.
    }
  }, [practiceDiscussionStorageKey]);

  useEffect(() => {
    if (!practiceDiscussionStorageKey) return;
    saveStoredJson(practiceDiscussionStorageKey, practiceDiscussionBoard);
  }, [practiceDiscussionBoard, practiceDiscussionStorageKey]);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.scrollbarGutter;
    root.style.scrollbarGutter = 'stable';
    return () => { root.style.scrollbarGutter = prev; };
  }, []);

  useEffect(() => {
    const nav = questionNavRef.current;
    if (!nav) return;
    const chip = nav.querySelector(`[data-chip-index="${currentQuestionIndex}"]`);
    if (!chip) return;
    chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentQuestionIndex]);

  useEffect(() => {
    const resolved = resolveThemePreference(themePreference);
    setPracticeTheme((previous) => (previous === resolved ? previous : resolved));
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== 'auto') {
      return undefined;
    }

    return subscribeToSystemThemeChange(() => {
      const resolved = resolveThemePreference('auto');
      setPracticeTheme((previous) => (previous === resolved ? previous : resolved));
    });
  }, [themePreference]);

  useEffect(() => {
    if (!showLeaderboardModal || !user) return undefined;
    void refreshLeaderboard('global', 'weekly');
    return undefined;
  }, [refreshLeaderboard, showLeaderboardModal, user]);

  useEffect(() => {
    let isMounted = true;

    const loadPractice = async () => {
      if (seededPractice && String(seededPractice?.id || '') === String(practiceId || '')) {
        setPractice(seededPractice);
        setError('');
        setLoading(false);
        return;
      }

      if (matchedSamplePractice) {
        setPractice(matchedSamplePractice);
        setError('');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await contentService.getContentById(practiceId);
        if (!isMounted) return;
        if (!response?.success || !response.content) {
          throw new Error(response?.error || 'Practice item not found.');
        }
        setPractice(response.content);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError?.message || 'Failed to load this practice item.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPractice();

    return () => {
      isMounted = false;
    };
  }, [matchedSamplePractice, practiceId, seededPractice]);

  useEffect(() => {
    setRemainingSeconds(timerDurationSeconds);
  }, [timerDurationSeconds]);

  useEffect(() => () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const persistCompletion = useCallback(async (summary, evaluations) => {
    if (!user?.id) return;

    const metadata = buildPersistencePayload({
      summary,
      timerDurationSeconds,
      evaluations,
      practiceType: practice?.type || 'quiz',
    });

    await contentService.completeContent(practiceId, {
      duration_seconds: summary.durationSeconds,
      metadata,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('learnda:learning-progress-updated', {
          detail: {
            practiceId,
            courseId: location.state?.course?.id || practice?.course?.id || null,
            completed: true,
            percentScore: summary.percentScore,
          },
        })
      );
    }
  }, [location.state?.course?.id, practice?.course?.id, practice?.type, practiceId, timerDurationSeconds, user?.id]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleBack = useCallback(() => {
    navigate(backTarget.to, { state: backTarget.state });
  }, [backTarget.state, backTarget.to, navigate]);

  const handleAnswerChange = useCallback((questionId, value, opts = {}) => {
    if (opts.fromOptionSelect) {
      playUiSound('quizOptionSelect');
    }
    setResponses((current) => ({
      ...current,
      [questionId]: value,
    }));
    setSubmissionError('');
  }, []);

  const handleSubmitPractice = useCallback(async ({ timedOut = false, allowIncomplete = false } = {}) => {
    if (submittingRef.current || !practiceQuestions.length) return;

    const evaluation = evaluatePracticeSubmission({
      questions: practiceQuestions,
      responses,
      startedAt: startedAtRef.current,
      allowIncomplete,
    });

    if (!evaluation.isReady) {
      const unfinishedIndex = practiceQuestions.findIndex((question) => question.id === evaluation.unfinishedQuestion?.id);
      if (unfinishedIndex >= 0) {
        setCurrentQuestionIndex(unfinishedIndex);
      }
      setSubmissionError('Answer every question before you submit the practice.');
      return;
    }

    submittingRef.current = true;
    stopTimer();

    const nextSummary = {
      ...evaluation,
      timedOut,
      submittedAt: new Date().toISOString(),
    };

    setSubmissionError('');
    setAttemptSummary(nextSummary);
    setRemainingSeconds(Math.max(0, timerDurationSeconds - nextSummary.durationSeconds));
    setCurrentQuestionIndex(0);
    setPhase('submitted');
    setCelebrationMode(nextSummary.passed ? (nextSummary.percentScore >= 80 ? 'fireworks' : 'burst') : null);
    playPracticeCompletionTone(audioContextRef, nextSummary.passed);

    try {
      await persistCompletion(nextSummary, evaluation.evaluations);
    } catch (_persistError) {
      // Keep the local result visible even if persistence fails.
    } finally {
      submittingRef.current = false;
    }

    trackEvent('practice_session_submitted', {
      practice_id: practiceId,
      practice_type: practice?.type || 'quiz',
      score_percent: nextSummary.percentScore,
      correct_count: nextSummary.correctCount,
      total_questions: nextSummary.totalQuestions,
      unanswered_count: nextSummary.unansweredCount,
      timed_out: timedOut,
      duration_seconds: nextSummary.durationSeconds,
    });
  }, [persistCompletion, practice?.type, practiceId, practiceQuestions, responses, stopTimer, timerDurationSeconds, trackEvent]);

  useEffect(() => {
    if (phase !== 'active') {
      stopTimer();
      return undefined;
    }

    const tick = () => {
      if (!startedAtRef.current) return;
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
      const nextRemaining = Math.max(0, timerDurationSeconds - elapsedSeconds);
      setRemainingSeconds(nextRemaining);

      if (nextRemaining <= 0) {
        handleSubmitPractice({ timedOut: true, allowIncomplete: true });
      }
    };

    tick();
    timerRef.current = window.setInterval(tick, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [handleSubmitPractice, phase, stopTimer, timerDurationSeconds]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentQuestion || isCurrentChecked) return;
    const response = safeText(responses[currentQuestion.id] || '');
    const result = evaluateExercise(currentQuestion.exercise, response);
    setQuestionEvals((prev) => ({ ...prev, [currentQuestion.id]: { response, result } }));
  }, [currentQuestion, isCurrentChecked, responses]);

  const handleFinishChecking = useCallback(async () => {
    if (submittingRef.current || !practiceQuestions.length) return;
    submittingRef.current = true;
    stopTimer();

    const durationSeconds = startedAtRef.current
      ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 0;

    const evaluations = practiceQuestions.map((q) => {
      const checked = questionEvals[q.id];
      return {
        ...q,
        response: checked?.response ?? '',
        result: checked?.result ?? { correct: false, isReady: false, missing: true, expectedAnswer: '', explanation: '' },
      };
    });

    const correctCount = evaluations.filter((e) => e.result.correct).length;
    const unansweredCount = evaluations.filter((e) => e.result.missing).length;
    const percentScore = Math.round((correctCount / evaluations.length) * 100);
    const passed = percentScore >= PRACTICE_PASS_PERCENT;

    const nextSummary = {
      isReady: true,
      evaluations,
      correctCount,
      totalQuestions: evaluations.length,
      unansweredCount,
      percentScore,
      durationSeconds,
      passed,
      timedOut: false,
      submittedAt: new Date().toISOString(),
    };

    setSubmissionError('');
    setAttemptSummary(nextSummary);
    setRemainingSeconds(Math.max(0, timerDurationSeconds - durationSeconds));
    setCurrentQuestionIndex(0);
    setPhase('submitted');
    setCelebrationMode(nextSummary.passed ? (nextSummary.percentScore >= 80 ? 'fireworks' : 'burst') : null);
    playPracticeCompletionTone(audioContextRef, nextSummary.passed);

    try {
      await persistCompletion(nextSummary, evaluations);
    } catch (_persistError) {
      // Keep the local result visible even if persistence fails.
    } finally {
      submittingRef.current = false;
    }

    trackEvent('practice_session_submitted', {
      practice_id: practiceId,
      practice_type: practice?.type || 'quiz',
      score_percent: nextSummary.percentScore,
      correct_count: nextSummary.correctCount,
      total_questions: nextSummary.totalQuestions,
      unanswered_count: nextSummary.unansweredCount,
      timed_out: false,
      duration_seconds: nextSummary.durationSeconds,
    });
  }, [persistCompletion, practice?.type, practiceId, practiceQuestions, questionEvals, stopTimer, timerDurationSeconds, trackEvent]);

  const handleStartPractice = useCallback(async () => {
    if (!canAccess || !practiceQuestions.length) return;

    setResponses({});
    setQuestionEvals({});
    setAttemptSummary(null);
    setSubmissionError('');
    setCurrentQuestionIndex(0);
    setRemainingSeconds(timerDurationSeconds);
    setPhase('active');
    startedAtRef.current = Date.now();
    submittingRef.current = false;

    contentService
      .trackContentView(practiceId, {
        duration_seconds: 0,
        progress_percentage: 5,
        metadata: {
          practice_started_at: new Date().toISOString(),
          practice_type: practice?.type || 'quiz',
        },
      })
      .catch(() => {});

    trackEvent('practice_session_started', {
      practice_id: practiceId,
      practice_type: practice?.type || 'quiz',
      timer_duration_seconds: timerDurationSeconds,
      total_questions: practiceQuestions.length,
    });
  }, [canAccess, practice?.type, practiceId, practiceQuestions.length, timerDurationSeconds, trackEvent]);

  const handleRetakePractice = useCallback(() => {
    stopTimer();
    setPhase('intro');
    setAttemptSummary(null);
    setResponses({});
    setQuestionEvals({});
    setSubmissionError('');
    setCurrentQuestionIndex(0);
    setRemainingSeconds(timerDurationSeconds);
    startedAtRef.current = null;
    submittingRef.current = false;

    trackEvent('practice_session_restarted', {
      practice_id: practiceId,
      practice_type: practice?.type || 'quiz',
    });
  }, [practice?.type, practiceId, stopTimer, timerDurationSeconds, trackEvent]);

  const handleOpenReview = useCallback(() => {
    if (!canReviewAnswers) return;
    setPhase('review');
    setCurrentQuestionIndex(0);
    trackEvent('practice_session_review_opened', {
      practice_id: practiceId,
      practice_type: practice?.type || 'quiz',
    });
  }, [canReviewAnswers, practice?.type, practiceId, trackEvent]);

  const handleThemeToggle = useCallback(() => {
    const nextPreference = practiceTheme === 'dark' ? 'light' : 'dark';
    const next = saveThemePreference(nextPreference);
    setThemePreference(next.preference);
    setPracticeTheme(next.resolved);
  }, [practiceTheme]);

  const handleOpenLeaderboard = useCallback(() => {
    setShowLeaderboardModal(true);
    trackEvent('practice_leaderboard_opened', {
      practice_id: practiceId,
      practice_type: practice?.type || 'quiz',
    });
  }, [practice?.type, practiceId, trackEvent]);

  const handleReadInstructions = useCallback(() => {
    navigate(`${backTarget.to}#practice-prelims`, { state: backTarget.state });
    trackEvent('practice_session_read_instructions', {
      practice_id: practiceId,
      practice_type: practice?.type || 'quiz',
    });
  }, [backTarget.state, backTarget.to, navigate, practice?.type, practiceId, trackEvent]);

  const handleShareToCommunity = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setShareSubmenuOpen(false);
    setIsMobileRailOpen(false);
    setCommunityShareOpen(true);
  }, [navigate, location.pathname, user]);

  const handleShareToStudyGroupRail = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setShareSubmenuOpen(false);
    setIsMobileRailOpen(false);
    setStudyGroupShareOpen(true);
  }, [navigate, location.pathname, user]);

  const handleToggleLike = useCallback(async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (likeState.pending || !practiceId) return;
    setLikeState((prev) => ({ ...prev, pending: true }));
    try {
      await likeContent(practiceId);
      setLikeState((prev) => ({ liked: !prev.liked, count: prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1, pending: false }));
    } catch (_) {
      setLikeState((prev) => ({ ...prev, pending: false }));
    }
    setIsMobileRailOpen(false);
  }, [likeContent, likeState.pending, location.pathname, navigate, practiceId, user]);

  const handleOpenDiscussion = useCallback(() => {
    setIsMobileRailOpen(false);
    setShareSubmenuOpen(false);
    setDiscussionModal('discussion');
    setDiscussionComposerType('comment');
    setDiscussionDraft('');
    setDiscussionActiveReply('');
  }, []);

  const handleReportError = useCallback(() => {
    setIsMobileRailOpen(false);
    setShareSubmenuOpen(false);
    setDiscussionModal('error');
    setDiscussionDraft('');
    setDiscussionActiveReply('');
  }, []);

  const handleDiscussionSubmit = useCallback((event) => {
    event.preventDefault();
    if (!discussionModal || !safeText(discussionDraft)) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    const targetType = discussionModal === 'discussion' ? discussionComposerType : discussionModal;
    const entry = {
      id: `${practiceId}-${targetType}-${Date.now()}`,
      body: safeText(discussionDraft),
      authorKey: getUserKey(user),
      authorName: user?.full_name || user?.name || 'Learnda Student',
      authorAvatar: user?.avatar_url || null,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      replies: [],
    };
    setPracticeDiscussionBoard((prev) => ({
      ...prev,
      [targetType]: [...(prev[targetType] || []), entry],
    }));
    setDiscussionDraft('');
  }, [discussionComposerType, discussionDraft, discussionModal, location.pathname, navigate, practiceId, user]);

  const handleDiscussionReply = useCallback((entryId, boardType) => {
    if (!boardType || !safeText(discussionReplyDrafts[entryId])) return;
    if (!user) return;
    const reply = {
      id: `${entryId}-reply-${Date.now()}`,
      body: safeText(discussionReplyDrafts[entryId]),
      authorKey: getUserKey(user),
      authorName: user?.full_name || user?.name || 'Learnda Student',
      authorAvatar: user?.avatar_url || null,
      createdAt: new Date().toISOString(),
    };
    setPracticeDiscussionBoard((prev) => ({
      ...prev,
      [boardType]: (prev[boardType] || []).map((e) =>
        e.id === entryId ? { ...e, replies: [...(e.replies || []), reply] } : e
      ),
    }));
    setDiscussionReplyDrafts((prev) => ({ ...prev, [entryId]: '' }));
    setDiscussionActiveReply('');
  }, [discussionReplyDrafts, user]);

  const handleDiscussionLike = useCallback((entryId, boardType) => {
    if (!boardType || !user) return;
    const likerKey = getUserKey(user);
    setPracticeDiscussionBoard((prev) => ({
      ...prev,
      [boardType]: (prev[boardType] || []).map((e) => {
        if (e.id !== entryId) return e;
        const likedBy = Array.isArray(e.likedBy) ? e.likedBy : [];
        const already = likedBy.includes(likerKey);
        const next = already ? likedBy.filter((k) => k !== likerKey) : [...likedBy, likerKey];
        return { ...e, likedBy: next, likes: next.length };
      }),
    }));
  }, [user]);

  const handleEditDiscussionEntry = useCallback((entryId, nextBody, boardType) => {
    if (!boardType || !safeText(nextBody)) return;
    setPracticeDiscussionBoard((prev) => ({
      ...prev,
      [boardType]: (prev[boardType] || []).map((e) =>
        e.id === entryId ? { ...e, body: safeText(nextBody) } : e
      ),
    }));
  }, []);

  const handleEditDiscussionReply = useCallback((entryId, replyId, nextBody, boardType) => {
    if (!boardType || !safeText(nextBody)) return;
    setPracticeDiscussionBoard((prev) => ({
      ...prev,
      [boardType]: (prev[boardType] || []).map((e) =>
        e.id === entryId
          ? { ...e, replies: (e.replies || []).map((r) => (r.id === replyId ? { ...r, body: safeText(nextBody) } : r)) }
          : e
      ),
    }));
  }, []);

  const handleShareSocial = useCallback(() => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareTitle = practice?.title || courseName || 'Practice session';
    if (navigator.share) {
      navigator.share({ title: shareTitle, url: shareUrl }).catch(() => undefined);
    } else {
      try {
        navigator.clipboard.writeText(shareUrl);
      } catch {
        // Clipboard access is not available in every browser context.
      }
    }
    setShareSubmenuOpen(false);
    setIsMobileRailOpen(false);
  }, [courseName, practice?.title]);

  const practiceRailItems = [
    {
      key: 'practice-like',
      name: likeState.liked ? 'Liked' : 'Like',
      icon: <FiHeart />,
      active: likeState.liked,
      onClick: handleToggleLike,
    },
    {
      key: 'practice-discussion',
      name: 'Discussion',
      icon: <FiMessageSquare />,
      badge: ((practiceDiscussionBoard.question?.length ?? 0) + (practiceDiscussionBoard.comment?.length ?? 0)) || null,
      active: discussionModal === 'discussion',
      onClick: handleOpenDiscussion,
    },
    {
      key: 'practice-report',
      name: 'Report Error',
      icon: <FiAlertTriangle />,
      badge: practiceDiscussionBoard.error?.length || null,
      active: discussionModal === 'error',
      onClick: handleReportError,
    },
    {
      key: 'practice-share',
      name: 'Share',
      icon: <FiShare2 />,
      active: shareSubmenuOpen,
      keepRailOpen: true,
      onClick: () => setShareSubmenuOpen((v) => !v),
      children: [
        FEATURE_FLAGS.studyGroups && {
          key: 'practice-share-groups',
          name: 'Study Groups',
          icon: <FiUsers />,
          onClick: handleShareToStudyGroupRail,
        },
        FEATURE_FLAGS.community && {
          key: 'practice-share-community',
          name: 'Community',
          icon: <FiShare2 />,
          onClick: handleShareToCommunity,
        },
        {
          key: 'practice-share-social',
          name: 'Social Media',
          icon: <FiShare2 />,
          onClick: handleShareSocial,
        },
      ].filter(Boolean),
    },
    {
      key: 'practice-leaderboard',
      name: 'Leaderboard',
      icon: <FiTrendingUp />,
      onClick: handleOpenLeaderboard,
    },
  ];

  if (loading) {
    return <CoursePageSkeleton />;
  }

  if (error) {
    return (
      <div className="practice-session-shell">
        <div className="practice-session-panel practice-session-empty">
          <button type="button" className="practice-session-back" onClick={handleBack}>
            <FiArrowLeft />
            <span>Back</span>
          </button>
          <h1>Practice item unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!practiceQuestions.length) {
    return (
      <div className="practice-session-shell">
        <div className="practice-session-panel practice-session-empty">
          <button type="button" className="practice-session-back" onClick={handleBack}>
            <FiArrowLeft />
            <span>Back</span>
          </button>
          <h1>No practice questions yet</h1>
          <p>This practice item is live, but the question set has not been added yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`lesson-shell practice-lesson-shell theme-${practiceTheme} ${isTimerCritical ? 'is-practice-timer-critical' : ''} ${isMobileRailOpen ? 'is-rail-open' : ''}`.trim()}>
      {!canAccess && (
        <div className="lesson-upgrade-strip">
          <UpgradePrompt
            requiredPlan="Serious Student"
            feature="premium practice sessions"
            onUpgrade={() => window.dispatchEvent(new CustomEvent('openUpgradeModal'))}
          />
        </div>
      )}

      <div className="lesson-shell-body practice-lesson-shell-body">

        <div
          className={`lesson-action-dock ${isMobileRailOpen ? 'is-mobile-open' : ''}`}
          onMouseLeave={() => setShareSubmenuOpen(false)}
        >
          <div className="lesson-rail-edge-trigger" aria-hidden="true" />
          <button
            type="button"
            className="lesson-rail-mobile-handle"
            onClick={() => {
              setIsMobileRailOpen((v) => {
                if (v) setShareSubmenuOpen(false);
                return !v;
              });
            }}
            aria-label={isMobileRailOpen ? 'Hide practice tools' : 'Show practice tools'}
            aria-expanded={isMobileRailOpen}
          >
            {isMobileRailOpen ? <FiChevronLeft /> : <FiChevronRight />}
          </button>
          <aside className="lesson-action-rail" aria-label="Practice tools">
            {practiceRailItems.map((item) => (
              <div key={item.key} className={`lesson-rail-item ${item.children?.length ? 'has-children' : ''}`}>
                <button
                  type="button"
                  className={`lesson-rail-button ${item.active ? 'is-active' : ''}`}
                  data-label={item.name}
                  onClick={() => {
                    item.onClick?.();
                    if (!item.keepRailOpen) setIsMobileRailOpen(false);
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
          <button
            type="button"
            className="lesson-rail-overlay"
            onClick={() => {
              setIsMobileRailOpen(false);
              setShareSubmenuOpen(false);
            }}
            aria-label="Close practice tools"
          />
        </div>

        <main className="lesson-stage-layout practice-lesson-stage-layout">
          <section className="lesson-main-panel">
            <div className="lesson-stage-header">
              <div className="lesson-stage-toolbar">
                <button
                  type="button"
                  className="lesson-back-button lesson-stage-back"
                  onClick={handleBack}
                  aria-label="Back to practice"
                >
                  <FiArrowLeft />
                </button>

                <span className="lesson-stage-kicker lesson-stage-toolbar-kicker">
                  {headerKicker}
                </span>

                <div className="lesson-stage-toolbar-actions">
                  <button
                    type="button"
                    className="lesson-theme-toggle"
                    onClick={handleThemeToggle}
                    aria-label={practiceTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {practiceTheme === 'dark' ? <FiSun /> : <FiMoon />}
                  </button>

                  <div className="lesson-header-stat xp practice-lesson-xp-stat">
                    <span>XP</span>
                    <div>
                      <strong>{Math.max(0, Math.round(Number(xp || 0))).toLocaleString()}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="lesson-header-stat lesson-header-action rank practice-lesson-rank-stat"
                    onClick={handleOpenLeaderboard}
                    aria-label={currentUserRank ? `Open leaderboard. Current position ${formatOrdinalRank(currentUserRank)}` : 'Open leaderboard'}
                  >
                    <FiTrendingUp />
                    <div>
                      <strong>{currentUserRank ? formatOrdinalRank(currentUserRank) : 'Unranked'}</strong>
                    </div>
                  </button>
                </div>

                <div className="lesson-stage-topic-button lesson-stage-toolbar-topic practice-lesson-topic" role="presentation">
                  <span className="lesson-stage-topic-text">{headerTopic}</span>
                  <span className={`practice-lesson-topic-timer ${isTimerCritical ? 'is-critical' : ''}`.trim()}>
                    {timerDisplay}
                  </span>
                </div>
              </div>

              <div
                className="lesson-stage-progress-line"
                aria-label={`${Math.round((phase === 'submitted' ? 1 : practiceQuestions.length ? ((currentQuestionIndex + 1) / practiceQuestions.length) : 0) * 100)} percent practice progress`}
              >
                {progressSegments.map((segment) => (
                  <span
                    key={segment.id}
                    className={`lesson-progress-segment ${segment.complete ? 'is-complete' : ''} ${segment.current ? 'is-current' : ''}`.trim()}
                    style={{ '--segment-progress': `${Math.round(segment.progress * 100)}%` }}
                    aria-hidden="true"
                  >
                    <i />
                  </span>
                ))}
              </div>
            </div>

            <div className="lesson-stage-card is-assessment-stage-card practice-lesson-stage-card">
      {phase === 'intro' && (
        <section className="practice-session-grid practice-lesson-grid">
          <article className="practice-session-panel practice-session-hero-card practice-session-intro-card practice-lesson-panel">
            <span className="practice-session-kicker">Quiz snapshot</span>
            <h2>{courseName}</h2>
            <div className="practice-session-meta-grid">
              <div className="practice-session-meta-card">
                <strong>{practiceQuestions.length}</strong>
                <span>Total questions</span>
              </div>
              <div className="practice-session-meta-card">
                <strong>{formatDurationLabel(timerDurationSeconds)}</strong>
                <span>Session timer</span>
              </div>
              <div className="practice-session-meta-card">
                <strong>{PRACTICE_PASS_PERCENT}%</strong>
                <span>Target score</span>
              </div>
            </div>
          </article>
        </section>
      )}

      {phase === 'active' && currentQuestion && (
        <section className="practice-session-grid practice-session-grid-active practice-lesson-grid">
          <div className="practice-session-question-col">
          <article className="practice-session-panel practice-session-question-shell practice-lesson-panel">
            <div className="practice-session-question-nav" ref={questionNavRef}>
              {practiceQuestions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  data-chip-index={index}
                  className={`practice-session-question-chip ${getQuestionState({
                    index,
                    currentIndex: currentQuestionIndex,
                    activePhase: phase,
                    response: responses[question.id],
                    evaluation: evaluationMap[question.id],
                    questionEval: questionEvals[question.id],
                  })}`.trim()}
                  onClick={() => setCurrentQuestionIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="lesson-assessment-panel practice-session-question-card">
              <div className="lesson-assessment-head practice-session-assessment-head">
                <div className="lesson-assessment-copy">
                  <span>{`Question ${currentQuestionIndex + 1} of ${practiceQuestions.length}`}</span>
                  <h3>{currentQuestion.exercise?.prompt}</h3>
                </div>
              </div>

              <section className="lesson-assessment-question practice-session-assessment-question">
                {(currentQuestion.exercise?.type === 'multiple_choice' || currentQuestion.exercise?.type === 'true_false') && (
                  <div className="lesson-assessment-choice-list practice-session-choice-list">
                    {(currentQuestion.exercise?.options || []).map((option, optionIndex) => {
                      const isSelected = normalizeText(responses[currentQuestion.id]) === normalizeText(option);
                      const isCorrectOption = isCurrentChecked && normalizeText(currentQuestion.exercise?.correctAnswer) === normalizeText(option);
                      const isWrongAnswer = isCurrentChecked && isSelected && !isCorrectOption;
                      const optionLabel = String.fromCharCode(65 + optionIndex);
                      return (
                        <label
                          key={`${currentQuestion.id}-${option}`}
                          className={[
                            'lesson-choice-card',
                            'practice-session-choice',
                            isSelected && 'is-selected',
                            isCurrentChecked && 'is-revealed',
                            isCorrectOption && 'is-correct-answer',
                            isWrongAnswer && 'is-wrong-answer',
                          ].filter(Boolean).join(' ')}
                        >
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            value={option}
                            checked={isSelected}
                            onChange={() =>
                              handleAnswerChange(currentQuestion.id, option, { fromOptionSelect: true })
                            }
                            disabled={isCurrentChecked}
                          />
                          <span className="practice-session-choice-marker">{optionLabel}</span>
                          <span className="practice-session-choice-copy">{option}</span>
                          <span className="lesson-choice-state" aria-hidden="true" />
                        </label>
                      );
                    })}
                  </div>
                )}

                {(currentQuestion.exercise?.type === 'fill_in' || currentQuestion.exercise?.type === 'theory') && (
                  <div className="lesson-free-response lesson-assessment-response practice-session-response">
                    <div className="lesson-free-response-head">
                      <strong>Your response</strong>
                      <span>{currentQuestion.exercise?.type === 'theory' ? 'Short written answer' : 'One precise answer'}</span>
                    </div>
                    <textarea
                      value={responses[currentQuestion.id] || ''}
                      onChange={(event) => handleAnswerChange(currentQuestion.id, event.target.value)}
                      rows={currentQuestion.exercise?.type === 'theory' ? 6 : 4}
                      placeholder={currentQuestion.exercise?.placeholder || 'Type your answer'}
                      readOnly={isCurrentChecked}
                    />
                  </div>
                )}

                {isCurrentChecked && currentImmediateEval && (
                  <div className={`practice-feedback-block ${currentImmediateEval.result.correct ? 'is-correct' : 'is-wrong'}`}>
                    <div className="practice-feedback-status">
                      {currentImmediateEval.result.correct
                        ? <FiCheckCircle className="practice-feedback-icon" />
                        : <FiXCircle className="practice-feedback-icon" />}
                      <strong>{currentImmediateEval.result.correct ? 'Correct!' : 'Not quite.'}</strong>
                    </div>
                    {!currentImmediateEval.result.correct && currentImmediateEval.result.expectedAnswer && (
                      <div className="practice-feedback-expected">
                        <span>Expected answer</span>
                        <p>{currentImmediateEval.result.expectedAnswer}</p>
                      </div>
                    )}
                    {currentImmediateEval.result.explanation && (
                      <div className="practice-feedback-explanation">
                        <span>Explanation</span>
                        <p>{currentImmediateEval.result.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {submissionError ? <p className="practice-session-feedback error">{submissionError}</p> : null}
          </article>

            <div className="practice-session-actions">
              <button
                type="button"
                className="lesson-next-chunk-btn secondary"
                onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                disabled={currentQuestionIndex <= 0}
              >
                <FiChevronLeft />
                Previous
              </button>

              {!isCurrentChecked ? (
                <button
                  type="button"
                  className="lesson-check-answer"
                  onClick={handleCheckAnswer}
                  disabled={!hasCurrentResponse}
                >
                  Check answer
                  <FiCheckCircle />
                </button>
              ) : allQuestionsChecked ? (
                <button type="button" className="lesson-check-answer" onClick={handleFinishChecking}>
                  See results
                  <FiFlag />
                </button>
              ) : (
                <button
                  type="button"
                  className="lesson-next-chunk-btn"
                  onClick={() => {
                    const afterCurrent = practiceQuestions.findIndex((q, i) => i > currentQuestionIndex && !questionEvals[q.id]);
                    const target = afterCurrent >= 0
                      ? afterCurrent
                      : practiceQuestions.findIndex((q) => !questionEvals[q.id]);
                    if (target >= 0) setCurrentQuestionIndex(target);
                  }}
                >
                  Next question
                  <FiChevronRight />
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {phase === 'submitted' && attemptSummary && (
        <>
          <ConfettiOverlay
            active={Boolean(celebrationMode)}
            mode={celebrationMode || 'burst'}
            onDone={() => setCelebrationMode(null)}
          />
        <section className="practice-session-grid practice-lesson-grid">
          <article className={`practice-session-panel practice-session-result-card practice-lesson-panel ${attemptSummary.passed ? 'is-result-pass' : 'is-result-fail'}`.trim()}>
            <div className="practice-session-result-head">
              <div>
                <span>{attemptSummary.passed ? 'Practice cleared 🎉' : 'Practice finished'}</span>
                <h2>{attemptSummary.passed ? 'Strong run under pressure.' : 'Your weak spots are visible now.'}</h2>
                <p>
                  {attemptSummary.timedOut
                    ? 'The timer closed the session. Review the missed items, then go again.'
                    : attemptSummary.passed
                      ? 'You hit the score target. Review the answers or run it again for a faster finish.'
                      : `You need ${PRACTICE_PASS_PERCENT}% to clear this session cleanly.`}
                </p>
              </div>
              <ScoreRing percent={attemptSummary.percentScore} passed={attemptSummary.passed} />
            </div>

            <div className="practice-session-attempt-stats">
              <div>
                <span>Correct</span>
                <strong>{`${attemptSummary.correctCount}/${attemptSummary.totalQuestions}`}</strong>
              </div>
              <div>
                <span>Unanswered</span>
                <strong>{attemptSummary.unansweredCount}</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>{formatDurationLabel(attemptSummary.durationSeconds)}</strong>
              </div>
            </div>

            <div className="practice-session-result-actions">
              {canReviewAnswers ? (
                <button type="button" className="lesson-next-chunk-btn secondary" onClick={handleOpenReview}>
                  Review answers
                </button>
              ) : null}
              <button type="button" className="lesson-next-chunk-btn secondary" onClick={handleRetakePractice}>
                <FiRefreshCw />
                Retake
              </button>
              <button type="button" className="lesson-next-chunk-btn" onClick={handleBack}>
                Back to practice
              </button>
            </div>
          </article>
        </section>
        </>
      )}

      {phase === 'review' && currentQuestion && attemptSummary && (
        <section className="practice-session-grid practice-session-grid-active practice-lesson-grid">
          <div className="practice-session-question-col">
          <article className="practice-session-panel practice-session-question-shell practice-lesson-panel">
            <div className="practice-session-progress">
              <div className="practice-session-progress-copy">
                <span>{`Review ${currentQuestionIndex + 1} of ${practiceQuestions.length}`}</span>
                <strong>{currentQuestion.chunkTitle || `Question ${currentQuestionIndex + 1}`}</strong>
              </div>
              <div className="practice-session-progress-bar" aria-hidden="true">
                <span style={{ width: `${Math.round(((currentQuestionIndex + 1) / practiceQuestions.length) * 100)}%` }} />
              </div>
            </div>

            <div className="practice-session-question-nav" ref={questionNavRef}>
              {practiceQuestions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  data-chip-index={index}
                  className={`practice-session-question-chip ${getQuestionState({
                    index,
                    currentIndex: currentQuestionIndex,
                    activePhase: phase,
                    response: responses[question.id],
                    evaluation: evaluationMap[question.id],
                  })}`.trim()}
                  onClick={() => setCurrentQuestionIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className={`lesson-assessment-panel practice-session-question-card review ${currentEvaluation?.result?.correct ? 'is-correct' : 'is-wrong'}`.trim()}>
              <div className="lesson-assessment-head practice-session-assessment-head">
                <div className="lesson-assessment-copy">
                  <span>{currentEvaluation?.result?.correct ? 'Correct' : currentEvaluation?.result?.missing ? 'Unanswered' : 'Incorrect'}</span>
                  <h3>{currentQuestion.exercise?.prompt}</h3>
                  <p>Use the expected answer and explanation to spot the exact gap before you retake the session.</p>
                </div>
                <div className="lesson-assessment-meta">
                  <strong>{`Review ${currentQuestionIndex + 1}`}</strong>
                  <small>{currentQuestion.exercise?.type?.replace(/_/g, ' ') || 'question'}</small>
                </div>
              </div>

              {(currentQuestion.exercise?.type === 'multiple_choice' || currentQuestion.exercise?.type === 'true_false') && (
                <div className="lesson-assessment-choice-list practice-session-choice-list">
                  {(currentQuestion.exercise?.options || []).map((option, optionIndex) => {
                    const isSelected = normalizeText(currentEvaluation?.response) === normalizeText(option);
                    const isCorrect = normalizeText(currentQuestion.exercise?.correctAnswer) === normalizeText(option);
                    const optionLabel = String.fromCharCode(65 + optionIndex);
                    return (
                      <div
                        key={`${currentQuestion.id}-${option}`}
                          className={`lesson-choice-card practice-session-choice review ${isSelected ? 'is-selected' : ''} ${isCorrect ? 'is-correct' : ''}`.trim()}
                        >
                          <span className="practice-session-choice-marker">{optionLabel}</span>
                          <span className="practice-session-choice-copy">{option}</span>
                          <span className="lesson-choice-state" aria-hidden="true" />
                        </div>
                      );
                    })}
                  </div>
              )}

              {(currentQuestion.exercise?.type === 'fill_in' || currentQuestion.exercise?.type === 'theory') && (
                <div className="practice-session-review-block">
                  <div>
                    <span>Your answer</span>
                    <p>{safeText(currentEvaluation?.response) || 'No answer submitted.'}</p>
                  </div>
                  <div>
                    <span>Expected answer</span>
                    <p>{currentEvaluation?.result?.expectedAnswer || 'No answer supplied.'}</p>
                  </div>
                </div>
              )}

              <div className="practice-session-review-block">
                <div>
                  <span>Expected answer</span>
                  <p>{currentEvaluation?.result?.expectedAnswer || 'Review guidance unavailable.'}</p>
                </div>
                <div>
                  <span>Explanation</span>
                  <p>{currentEvaluation?.result?.explanation || 'No explanation was attached to this item.'}</p>
                </div>
              </div>
            </div>

          </article>

            <div className="practice-session-actions">
              <button
                type="button"
                className="lesson-next-chunk-btn secondary"
                onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                disabled={currentQuestionIndex <= 0}
              >
                <FiChevronLeft />
                Previous
              </button>
              {currentQuestionIndex < practiceQuestions.length - 1 ? (
                <button
                  type="button"
                  className="lesson-next-chunk-btn"
                  onClick={() => setCurrentQuestionIndex((current) => Math.min(practiceQuestions.length - 1, current + 1))}
                >
                  Next review
                  <FiChevronRight />
                </button>
              ) : (
                <button type="button" className="lesson-next-chunk-btn" onClick={() => setPhase('submitted')}>
                  Back to summary
                </button>
              )}
            </div>
          </div>
        </section>
      )}
            </div>
          </section>
        </main>
      </div>

      {phase === 'intro' ? (
        <div className="lesson-discussion-overlay practice-ready-overlay" role="presentation">
          <div
            className="lesson-discussion-modal practice-ready-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-ready-title"
          >
            <div className="practice-ready-copy">
              <span className="practice-session-kicker">Ready?</span>
              <h3 id="practice-ready-title">Get your brain ready.</h3>
              <p>
                {`Start the ${practiceActionLabel} when you are settled. If you want the paper guidance first, open the prelim instructions before you begin.`}
              </p>
            </div>

            <div className="practice-ready-actions">
              <button type="button" className="lesson-footer-btn secondary" onClick={handleReadInstructions}>
                Read instructions
              </button>
              <button
                type="button"
                className="lesson-next-chunk-btn"
                onClick={handleStartPractice}
                disabled={!canAccess}
              >
                {`Start ${practiceActionLabel}`}
                <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {discussionModal && (
        <DiscussionPanel
          type={discussionModal}
          entries={currentDiscussionEntries}
          draft={discussionDraft}
          composerType={discussionComposerType}
          replyDrafts={discussionReplyDrafts}
          activeReplyTarget={discussionActiveReply}
          theme={practiceTheme}
          currentUserKey={getUserKey(user)}
          onClose={() => setDiscussionModal('')}
          onDraftChange={setDiscussionDraft}
          onComposerTypeChange={setDiscussionComposerType}
          onReplyDraftChange={(id, val) => setDiscussionReplyDrafts((prev) => ({ ...prev, [id]: val }))}
          onSubmit={handleDiscussionSubmit}
          onReply={handleDiscussionReply}
          onOpenReply={(id, type) => setDiscussionActiveReply((prev) => { const k = `${type}:${id}`; return prev === k ? '' : k; })}
          onCloseReply={() => setDiscussionActiveReply('')}
          onToggleLike={handleDiscussionLike}
          onEditEntry={handleEditDiscussionEntry}
          onEditReply={handleEditDiscussionReply}
        />
      )}

      <ShareToStudyGroupModal
        open={studyGroupShareOpen}
        onClose={() => setStudyGroupShareOpen(false)}
        sharePayload={studyGroupSharePayload}
      />

      <ShareToCommunityModal
        open={communityShareOpen}
        onClose={() => setCommunityShareOpen(false)}
        sharePayload={communitySharePayload}
      />
    </div>
  );
}
