export const safeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const schedulePracticeTone = (audioContext, destination, frequency, startAt, duration, volume, type = 'sine') => {
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

export const getOrCreateAudioContext = (audioContextRef) => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
  const ctx = audioContextRef.current;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

export const playPracticeCompletionTone = (audioContextRef, passed) => {
  try {
    const ctx = getOrCreateAudioContext(audioContextRef);
    if (!ctx) return;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const t = ctx.currentTime + 0.005;
    if (passed) {
      schedulePracticeTone(ctx, master, 523.25, t, 0.07, 0.03, 'triangle');
      schedulePracticeTone(ctx, master, 659.25, t + 0.06, 0.09, 0.038, 'sine');
      schedulePracticeTone(ctx, master, 783.99, t + 0.13, 0.1, 0.042, 'sine');
      schedulePracticeTone(ctx, master, 1046.5, t + 0.21, 0.14, 0.05, 'triangle');
    } else {
      schedulePracticeTone(ctx, master, 392, t, 0.1, 0.03, 'triangle');
      schedulePracticeTone(ctx, master, 349.23, t + 0.1, 0.12, 0.035, 'sine');
    }
  } catch {
    // Audio APIs can fail when the browser blocks playback.
  }
};

export const firstText = (...values) => values.map((value) => safeText(value)).find(Boolean) || '';
export const normalizeText = (value) => safeText(value).toLowerCase();

export const getUserRankFromEntries = (entries = [], userId) => {
  if (!Array.isArray(entries) || !entries.length) return null;
  const directEntry = entries.find((entry) => {
    if (entry?.is_current_user) return true;
    if (!userId) return false;
    const entryUserId = entry?.user_id || entry?.id || entry?.uuid;
    return String(entryUserId || '') === String(userId);
  });
  const rank = Number(directEntry?.rank || 0);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
};

export const getPracticePillLabel = (practice = {}) =>
  normalizeText(practice?.type) === 'past_question' ? 'Exam' : 'Quiz';

export const getPracticeActionLabel = (practice = {}) =>
  normalizeText(practice?.type) === 'past_question' ? 'exam' : 'quiz';

export const getBackTarget = (locationState = {}) => {
  const coursePath = safeText(locationState?.coursePath || locationState?.fromCoursePath);
  const activeTab = safeText(locationState?.activeTab);
  if (coursePath) {
    return { to: coursePath, state: activeTab ? { activeTab } : undefined };
  }
  return { to: '/practice', state: undefined };
};

export const getQuestionState = ({ index, currentIndex, activePhase, response, evaluation, questionEval }) => {
  const states = [];
  if (index === currentIndex) states.push('is-current');
  if (activePhase === 'review' || activePhase === 'submitted') {
    if (evaluation?.result?.correct) states.push('is-correct');
    else if (evaluation?.result?.missing) states.push('is-empty');
    else if (evaluation) states.push('is-wrong');
  }
  if (activePhase === 'active' && questionEval) {
    if (questionEval.result?.correct) states.push('is-correct');
    else if (questionEval.result?.missing) states.push('is-empty');
    else states.push('is-wrong');
  }
  if (safeText(response)) states.push('is-answered');
  return states.join(' ');
};

export const buildPersistencePayload = ({ summary, timerDurationSeconds, evaluations, practiceType }) => ({
  practice_summary: {
    correct_count: summary.correctCount,
    total_questions: summary.totalQuestions,
    unanswered_count: summary.unansweredCount,
    percent_score: summary.percentScore,
    duration_seconds: summary.durationSeconds,
    passed: summary.passed,
    timed_out: summary.timedOut,
    submitted_at: summary.submittedAt,
    timer_duration_seconds: timerDurationSeconds,
  },
  practice_type: practiceType,
  practice_review: evaluations.map((evaluation) => ({
    id: evaluation.id,
    response: evaluation.response,
    correct: evaluation.result.correct,
    missing: Boolean(evaluation.result.missing),
  })),
});

export const PRACTICE_DISCUSSION_PREFIX = 'sharether:practice-discussion';
