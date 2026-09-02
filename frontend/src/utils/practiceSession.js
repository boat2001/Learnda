import { normalizeLessonSchema } from './lessonSchema';
import {
  FINAL_ASSESSMENT_PASS_PERCENT as PRACTICE_PASS_PERCENT,
  buildFinalAssessmentQuestions,
  evaluateExercise,
} from './lessonAssessment';
import { repairJoinedWords } from './textCleanup';

const DEFAULT_MINIMUM_TIMER_SECONDS = 180;
const MAXIMUM_TIMER_SECONDS = 7200;

const safeText = (value) => repairJoinedWords(String(value ?? '').replace(/\s+/g, ' ').trim());

const firstText = (...values) => {
  for (const value of values) {
    const text = safeText(value);
    if (text) return text;
  }
  return '';
};

const toFiniteNumber = (value, fallback = 0) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => safeText(entry)).filter(Boolean);
  }

  const text = safeText(value);
  if (!text) return [];

  return text
    .split(/[,\n]/)
    .map((entry) => safeText(entry))
    .filter(Boolean);
};

const normalizeText = (value) => safeText(value).toLowerCase();

const dedupeList = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeExerciseType = (value) => {
  const type = normalizeText(value);

  if (['multiple_choice', 'multiple-choice', 'multiplechoice', 'mcq', 'objective'].includes(type)) {
    return 'multiple_choice';
  }

  if (['true_false', 'true-false', 'boolean', 'truefalse'].includes(type)) {
    return 'true_false';
  }

  if (['fill_in', 'fill-in', 'short_answer', 'short-answer', 'input'].includes(type)) {
    return 'fill_in';
  }

  if (['essay', 'theory', 'open', 'free_response', 'free-response'].includes(type)) {
    return 'theory';
  }

  return 'multiple_choice';
};

const normalizeOptions = (value) =>
  dedupeList(
    (Array.isArray(value) ? value : [])
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        return firstText(entry?.label, entry?.value, entry?.text);
      })
      .filter(Boolean)
  );

const buildExplicitPracticeQuestion = (question = {}, index = 0) => {
  const exercise = question?.exercise || {};
  const type = normalizeExerciseType(
    question?.type ||
      exercise?.type ||
      question?.question_type ||
      question?.mode
  );
  const prompt = firstText(
    question?.prompt,
    question?.question,
    question?.text,
    question?.body,
    exercise?.prompt
  );
  if (!prompt) return null;

  const defaultTrueFalseOptions = ['True', 'False'];
  const rawOptions = normalizeOptions(
    question?.options ||
      question?.choices ||
      question?.answers ||
      exercise?.options ||
      exercise?.choices ||
      exercise?.answers
  );
  const options = type === 'true_false'
    ? (rawOptions.length >= 2 ? rawOptions : defaultTrueFalseOptions)
    : rawOptions;
  const correctAnswer = firstText(
    question?.correctAnswer,
    question?.correct_answer,
    question?.answer,
    question?.solution,
    question?.expected,
    exercise?.correctAnswer,
    exercise?.correct_answer,
    exercise?.answer,
    exercise?.solution,
    exercise?.expected
  );
  const acceptedAnswers = dedupeList([
    correctAnswer,
    ...normalizeList(
      question?.acceptedAnswers ||
      question?.accepted_answers ||
      exercise?.acceptedAnswers ||
      exercise?.accepted_answers
    ),
  ]);
  const keywords = dedupeList(
    normalizeList(
      question?.keywords ||
      question?.marking_guide ||
      question?.rubric ||
      exercise?.keywords ||
      exercise?.marking_guide ||
      exercise?.rubric
    )
  );

  return {
    id: firstText(question?.id, `practice-question-${index + 1}`) || `practice-question-${index + 1}`,
    order: toFiniteNumber(question?.order || index + 1, index + 1),
    chunkId: firstText(question?.chunkId, question?.sectionId, `practice-question-${index + 1}`) || `practice-question-${index + 1}`,
    chunkOrder: toFiniteNumber(question?.chunkOrder || question?.sectionOrder || question?.order || index + 1, index + 1),
    chunkTitle: firstText(
      question?.chunkTitle,
      question?.sectionTitle,
      question?.topic,
      question?.category,
      `Question ${index + 1}`
    ) || `Question ${index + 1}`,
    exercise: {
      type,
      prompt,
      options,
      correctAnswer,
      acceptedAnswers,
      keywords,
      explanation: firstText(
        question?.explanation,
        question?.solution_explanation,
        question?.feedback,
        exercise?.explanation,
        exercise?.solution_explanation,
        exercise?.feedback
      ),
      placeholder: firstText(
        question?.placeholder,
        question?.input_placeholder,
        exercise?.placeholder,
        exercise?.input_placeholder
      ),
    },
  };
};

const extractExplicitQuestions = (practice = {}) => {
  const questionGroups = [
    practice?.questions,
    practice?.metadata?.questions,
    practice?.metadata?.quiz_questions,
    practice?.metadata?.practice_questions,
    practice?.metadata?.quiz?.questions,
    practice?.metadata?.mock_exam?.questions,
  ];

  for (const group of questionGroups) {
    if (!Array.isArray(group) || group.length === 0) continue;
    const questions = group
      .map((entry, index) => buildExplicitPracticeQuestion(entry, index))
      .filter(Boolean);
    if (questions.length > 0) {
      return questions;
    }
  }

  return [];
};

const parseDurationTextToSeconds = (value) => {
  const text = normalizeText(value);
  if (!text) return 0;

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h(?:ou)?r/);
  const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/);
  const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*s(?:ec)?/);

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const seconds = secondMatch ? Number(secondMatch[1]) : 0;
  const totalSeconds = Math.round(hours * 3600 + minutes * 60 + seconds);

  if (totalSeconds > 0) return totalSeconds;

  const bareMinutes = Number(text);
  return Number.isFinite(bareMinutes) && bareMinutes > 0 ? Math.round(bareMinutes * 60) : 0;
};

export const buildPracticeSessionPath = (practiceId) => `/practice/session/${practiceId}`;

export const buildPracticeQuestions = (practice = {}) => {
  const explicitQuestions = extractExplicitQuestions(practice);
  if (explicitQuestions.length > 0) {
    return explicitQuestions;
  }

  return buildFinalAssessmentQuestions(practice, normalizeLessonSchema(practice));
};

export const getPracticeTimerSeconds = (practice = {}, questions = []) => {
  const metadata = practice?.metadata || {};
  const explicitSeconds = [
    metadata.time_limit_seconds,
    metadata.timer_seconds,
    metadata.duration_seconds,
    practice?.time_limit_seconds,
    practice?.timer_seconds,
    practice?.duration_seconds,
  ]
    .map((value) => toFiniteNumber(value, 0))
    .find((value) => value > 0);

  if (explicitSeconds) {
    return clamp(Math.round(explicitSeconds), 60, MAXIMUM_TIMER_SECONDS);
  }

  const explicitMinutes = [
    metadata.time_limit_minutes,
    metadata.timer_minutes,
    metadata.duration_minutes,
    practice?.time_limit_minutes,
    practice?.timer_minutes,
    practice?.duration_minutes,
    practice?.reading_time,
    practice?.read_time,
  ]
    .map((value) => toFiniteNumber(value, 0))
    .find((value) => value > 0);

  if (explicitMinutes) {
    return clamp(Math.round(explicitMinutes * 60), 60, MAXIMUM_TIMER_SECONDS);
  }

  const parsedDurationSeconds = parseDurationTextToSeconds(
    practice?.duration ||
      metadata.duration ||
      metadata.time_limit
  );
  if (parsedDurationSeconds > 0) {
    return clamp(parsedDurationSeconds, 60, MAXIMUM_TIMER_SECONDS);
  }

  const isExamStyle = normalizeText(practice?.type) === 'past_question';
  const perQuestionSeconds = isExamStyle ? 75 : 45;
  const minimumSeconds = isExamStyle ? 420 : DEFAULT_MINIMUM_TIMER_SECONDS;
  const computedSeconds = Math.round(Math.max(minimumSeconds, (questions.length || 1) * perQuestionSeconds));

  return clamp(computedSeconds, DEFAULT_MINIMUM_TIMER_SECONDS, MAXIMUM_TIMER_SECONDS);
};

export const evaluatePracticeSubmission = ({
  questions = [],
  responses = {},
  elapsedSeconds = 0,
  startedAt = null,
  allowIncomplete = false,
}) => {
  const evaluations = questions.map((question) => {
    const response = typeof responses?.[question.id] === 'string'
      ? responses[question.id]
      : String(responses?.[question.id] ?? '');
    const hasResponse = safeText(response).length > 0;
    const fallbackResult = evaluateExercise(question.exercise, '');
    const result = hasResponse
      ? evaluateExercise(question.exercise, response)
      : {
          ...fallbackResult,
          correct: false,
          isReady: false,
          missing: true,
          explanation: 'No answer was submitted for this question.',
        };

    return {
      ...question,
      response,
      result,
    };
  });

  const unfinishedQuestion = evaluations.find((question) => !question.result.isReady) || null;
  if (unfinishedQuestion && !allowIncomplete) {
    return {
      isReady: false,
      evaluations,
      unfinishedQuestion,
    };
  }

  const correctCount = evaluations.filter((question) => question.result.correct).length;
  const totalQuestions = evaluations.length;
  const unansweredCount = evaluations.filter((question) => !question.result.isReady).length;
  const percentScore = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
  const durationSeconds = Math.max(
    0,
    Math.max(
      toFiniteNumber(elapsedSeconds, 0),
      startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0
    )
  );

  return {
    isReady: true,
    evaluations,
    correctCount,
    totalQuestions,
    unansweredCount,
    percentScore,
    durationSeconds,
    passed: percentScore >= PRACTICE_PASS_PERCENT,
  };
};

export { PRACTICE_PASS_PERCENT };
