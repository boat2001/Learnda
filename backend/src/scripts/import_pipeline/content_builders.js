'use strict';

const { repairJoinedWords } = require('./text_cleanup');

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return safeText(String(value || '').replace(/<[^>]+>/g, ' '));
}

function wordCountFromText(value) {
  return safeText(value).split(/\s+/).filter(Boolean).length;
}

function toSlug(...parts) {
  const base = parts
    .map(safeText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90);
  return base || `sharether-import-${Date.now()}`;
}

function validateLessonOutput(generated) {
  const errors = [];
  if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
    return ['Generated lesson must be a JSON object.'];
  }

  if (!safeText(generated.title)) errors.push('Missing title.');
  if (!safeText(generated.description)) errors.push('Missing description.');
  if (!Array.isArray(generated.objectives) || generated.objectives.length < 3) {
    errors.push('Objectives must contain at least 3 items.');
  }
  if (!Array.isArray(generated.chunks) || generated.chunks.length < 3 || generated.chunks.length > 5) {
    errors.push('Chunks must contain 3 to 5 items.');
  }
  if (!Array.isArray(generated.exercises) || generated.exercises.length < 4 || generated.exercises.length > 6) {
    errors.push('Exercises must contain 4 to 6 items.');
  }

  (generated.chunks || []).forEach((chunk, index) => {
    if (!safeText(chunk?.heading)) errors.push(`Chunk ${index + 1} is missing a heading.`);
    if (!Array.isArray(chunk?.paragraphs) || chunk.paragraphs.length < 1) {
      errors.push(`Chunk ${index + 1} must include paragraphs.`);
    }
  });

  (generated.exercises || []).forEach((exercise, index) => {
    const label = `Exercise ${index + 1}`;
    const type = safeText(exercise?.type);
    if (!['multiple_choice', 'true_false', 'short_answer'].includes(type)) {
      errors.push(`${label} has unsupported type "${type}".`);
    }
    if (!safeText(exercise?.prompt)) errors.push(`${label} is missing prompt.`);
    if (!safeText(exercise?.answer)) errors.push(`${label} is missing answer.`);
    if (type === 'multiple_choice') {
      if (!Array.isArray(exercise.options) || exercise.options.length !== 4) {
        errors.push(`${label} multiple_choice must have exactly 4 options.`);
      }
      if (Array.isArray(exercise.options) && !exercise.options.map(safeText).includes(safeText(exercise.answer))) {
        errors.push(`${label} answer must match one option.`);
      }
    }
    if (type === 'true_false') {
      const options = Array.isArray(exercise.options) ? exercise.options.map(safeText) : [];
      if (options.length !== 2 || options[0] !== 'True' || options[1] !== 'False') {
        errors.push(`${label} true_false options must be exactly ["True", "False"].`);
      }
    }
  });

  return errors;
}

function normalizeLessonExercises(exercises = []) {
  return exercises.map((exercise, index) => ({
    id: safeText(exercise.id) || `exercise-${index + 1}`,
    type: safeText(exercise.type) || 'multiple_choice',
    prompt: safeText(exercise.prompt),
    options: Array.isArray(exercise.options) ? exercise.options.map(safeText).filter(Boolean) : [],
    answer: safeText(exercise.answer),
    correctAnswer: safeText(exercise.answer),
    explanation: safeText(exercise.explanation),
  }));
}

// Normalise a chunk illustration so the lesson viewer can render it.
// Accepts the flexible draft shape (image_url | src, alt, caption, credit,
// desktop_align | align, mobile_position | placement). Returns null when no
// image is provided so chunks without art stay clean.
function normalizeIllustration(value) {
  if (!value || typeof value !== 'object') return null;
  const imageUrl = safeText(value.image_url || value.imageUrl || value.src || value.url);
  if (!imageUrl) return null;
  const desktopAlign = safeText(value.desktop_align || value.desktopAlign || value.align).toLowerCase() === 'left'
    ? 'left'
    : 'right';
  return {
    image_url: imageUrl,
    alt: safeText(value.alt || value.caption),
    caption: safeText(value.caption),
    credit: safeText(value.credit),
    type: safeText(value.type) || 'diagram',
    desktop_align: desktopAlign,
    mobile_position: safeText(value.mobile_position || value.mobilePosition || value.placement) || 'between_paragraph_0_1',
  };
}

function buildLessonDocument(generated, lessonNumber) {
  return {
    schema_version: 'lesson_document.v2',
    source: 'ai_generated_from_notes',
    lesson_number: lessonNumber,
    main_topic: safeText(generated.title),
    lesson_details: { main_topic: safeText(generated.title) },
    chunks: (generated.chunks || []).map((chunk, chunkIndex) => {
      const paragraphs = (chunk.paragraphs || []).map((html, paragraphIndex) => ({
        id: `par_${paragraphIndex}`,
        body_html: String(html || '').trim(),
      }));
      return {
        id: `chunk_${chunkIndex}`,
        heading: safeText(chunk.heading),
        chunk_head: safeText(chunk.heading),
        illustration: normalizeIllustration(chunk.illustration),
        paragraphs,
        chunk_content: Object.fromEntries(paragraphs.map((paragraph) => [paragraph.id, paragraph])),
      };
    }),
  };
}

function countLessonWords(lessonDocument) {
  return (lessonDocument.chunks || [])
    .flatMap((chunk) => (chunk.paragraphs || []).map((paragraph) => stripHtml(paragraph.body_html)))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function firstLessonExcerpt(lessonDocument) {
  for (const chunk of lessonDocument.chunks || []) {
    for (const paragraph of chunk.paragraphs || []) {
      const text = stripHtml(paragraph.body_html);
      if (text) return text.slice(0, 240);
    }
  }
  return '';
}

function normalizePracticeType(value) {
  const type = safeText(value).toLowerCase();
  if (['essay', 'theory', 'open', 'free_response', 'short_answer'].includes(type)) return 'theory';
  if (['true_false', 'true-false', 'boolean'].includes(type)) return 'true_false';
  if (['multiple_choice', 'multiple-choice', 'mcq', 'objective'].includes(type)) return 'multiple_choice';
  return type || 'multiple_choice';
}

function normalizePracticeQuestion(question, index, fallbackSection = '') {
  const type = normalizePracticeType(question?.type || question?.question_type);
  const prompt = repairJoinedWords(question?.prompt || question?.question || question?.text);
  const options = Array.isArray(question?.options)
    ? question.options.map(repairJoinedWords).filter(Boolean)
    : [];
  const answer = repairJoinedWords(question?.answer || question?.correctAnswer || question?.correct_answer || question?.solution);
  const keywords = Array.isArray(question?.keywords)
    ? question.keywords.map(safeText).filter(Boolean)
    : [];
  const needsReview = Boolean(question?.needs_review) ||
    (type === 'multiple_choice' && (!answer || options.length !== 4)) ||
    (type === 'true_false' && !answer) ||
    (type === 'theory' && keywords.length === 0 && !answer);

  return {
    id: safeText(question?.id) || `practice-question-${index + 1}`,
    order: Number(question?.order || index + 1),
    type,
    prompt,
    options: type === 'true_false' && options.length === 0 ? ['True', 'False'] : options,
    answer,
    correctAnswer: answer,
    acceptedAnswers: answer ? [answer] : [],
    keywords,
    explanation: safeText(question?.explanation || question?.solution_explanation),
    section: safeText(question?.section || fallbackSection),
    topic: safeText(question?.topic || question?.chunkTitle || question?.category),
    needs_review: needsReview,
  };
}

function validatePracticeOutput(generated, expectedSubtype) {
  const errors = [];
  if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
    return ['Generated practice item must be a JSON object.'];
  }
  if (!safeText(generated.title)) errors.push('Missing title.');
  if (!safeText(generated.description)) errors.push('Missing description.');
  if (!Array.isArray(generated.questions) || generated.questions.length === 0) {
    errors.push('Questions must contain at least 1 item.');
  }

  (generated.questions || []).forEach((question, index) => {
    const label = `Question ${index + 1}`;
    const type = normalizePracticeType(question?.type);
    if (!['multiple_choice', 'true_false', 'theory'].includes(type)) {
      errors.push(`${label} has unsupported type "${type}".`);
    }
    if (!safeText(question?.prompt || question?.question || question?.text)) {
      errors.push(`${label} is missing prompt.`);
    }
    if (type === 'multiple_choice' && Array.isArray(question?.options) && question.options.length > 0 && question.options.length !== 4) {
      errors.push(`${label} multiple_choice must have 4 options when options are provided.`);
    }
  });

  return errors;
}

function normalizePracticeOutput(generated) {
  const sections = generated.sections && typeof generated.sections === 'object' && !Array.isArray(generated.sections)
    ? generated.sections
    : {};
  const questions = (generated.questions || []).map((question, index) =>
    normalizePracticeQuestion(question, index, safeText(question?.section))
  );
  return {
    title: safeText(generated.title),
    description: safeText(generated.description),
    questions,
    sections,
    tags: Array.isArray(generated.tags) ? generated.tags.map(safeText).filter(Boolean) : [],
    metadata: generated.metadata && typeof generated.metadata === 'object' ? generated.metadata : {},
  };
}

module.exports = {
  safeText,
  stripHtml,
  wordCountFromText,
  toSlug,
  validateLessonOutput,
  normalizeLessonExercises,
  buildLessonDocument,
  countLessonWords,
  firstLessonExcerpt,
  validatePracticeOutput,
  normalizePracticeOutput,
};
