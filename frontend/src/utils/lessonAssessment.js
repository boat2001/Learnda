import { normalizeLessonSchema } from './lessonSchema';
import { getChunkIllustration } from '../data/lessonIllustrations';

const READING_WORDS_PER_MINUTE = 190;
const MAX_TEXT_CHUNK_WORDS = 170;
const MAX_TEXT_CHUNK_PARAGRAPHS = 2;
const EXERCISE_TYPES = ['multiple_choice', 'true_false', 'fill_in', 'theory'];
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being',
  'between', 'both', 'during', 'each', 'from', 'have', 'into', 'lesson', 'main', 'more',
  'most', 'much', 'must', 'only', 'other', 'over', 'same', 'some', 'such', 'than', 'that',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'using', 'very', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your',
]);
const GROWTH_ILLUSTRATION = {
  lessonTitle: 'The Concept of Growth and Development',
  chunkTitle: 'The Meaning of Growth',
  src: '/lesson-illustrations/growth.jpg',
  alt: 'Illustration showing human growth from infancy through old age',
  caption: 'Growth can be observed as visible physical change across the lifespan.',
  mobilePosition: 'between_paragraph_0_1',
  desktopAlign: 'right',
};

export const FINAL_ASSESSMENT_PASS_PERCENT = 70;
// How many per-chunk objective questions to fold into the final test alongside
// the lesson's reserved final-only (typed/theory) bank, for a fuller review.
const FINAL_TEST_CHUNK_REVIEW_COUNT = 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const safeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const normalizeText = (value) => safeText(value).toLowerCase();

const hashText = (value = '') => {
  let hash = 0;
  const input = String(value);

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 2147483647;
  }

  return Math.abs(hash);
};

const estimateTextSeconds = (value) => {
  const wordCount = safeText(value).split(' ').filter(Boolean).length;
  const readSeconds = Math.round((wordCount / READING_WORDS_PER_MINUTE) * 60);
  return clamp(readSeconds || 0, 24, 95);
};

const estimateImageSeconds = (value) => clamp(12 + estimateTextSeconds(value) * 0.45, 16, 46);

const normalizeImageUrl = (value) => {
  const text = safeText(value);
  if (!text) return '';
  if (/^(https?:)?\/\//i.test(text) || text.startsWith('data:')) return text;
  if (text.startsWith('/')) return text;
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${text}`;
};

const normalizeMobileIllustrationPosition = (value) => {
  const position = normalizeText(value);
  if (['before_paragraph_0', 'before_first_paragraph', 'before_first'].includes(position)) {
    return 'before_paragraph_0';
  }
  if (['after_last_paragraph', 'after_last', 'after'].includes(position)) {
    return 'after_last_paragraph';
  }
  return 'between_paragraph_0_1';
};

const normalizeDesktopIllustrationAlign = (value) => (
  normalizeText(value) === 'left' ? 'left' : 'right'
);

const normalizeChunkIllustration = (value = {}, fallbackTitle = '', fallbackIndex = 0) => {
  const src = normalizeImageUrl(value?.src || value?.imageUrl || value?.image_url || value?.url);
  if (!src) return null;

  const caption = safeText(value?.caption || value?.alt || `${fallbackTitle} illustration`);

  return {
    src,
    alt: safeText(value?.alt || caption || fallbackTitle),
    caption,
    mobilePosition: normalizeMobileIllustrationPosition(
      value?.mobilePosition || value?.mobile_position || value?.placement_mobile || value?.mobile_placement
    ),
    desktopAlign: normalizeDesktopIllustrationAlign(
      value?.desktopAlign || value?.desktop_align || value?.align || value?.desktop_side
    ),
    fallbackIndex,
  };
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

const getLessonBodyHtml = (lesson) => {
  if (safeText(lesson?.content)) return lesson.content;

  if (Array.isArray(lesson?.metadata?.paragraphs) && lesson.metadata.paragraphs.length > 0) {
    return lesson.metadata.paragraphs
      .map((paragraph) => `<p>${safeText(paragraph)}</p>`)
      .join('');
  }

  const fallback = safeText(lesson?.description || `This lesson introduces ${lesson?.title || 'the current topic'}.`);
  return fallback ? `<p>${fallback}</p>` : '';
};

const getVideoUrl = (lesson) =>
  normalizeImageUrl(lesson?.file_url || lesson?.video_url || lesson?.metadata?.video_url || lesson?.metadata?.file_url);

const extractKeywords = (value) => {
  const words = safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

  return [...new Set(words)].slice(0, 6);
};

const dedupeOptions = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const buildExerciseFromBlock = (block, index, lesson) => {
  const concept = safeText(block?.title || `Concept ${index + 1}`);
  const summary = safeText(
    block?.type === 'image'
      ? block?.caption || block?.alt || `This illustration supports ${concept}.`
      : block?.type === 'video'
        ? block?.caption || `This video explains ${concept}.`
        : block?.paragraphs?.[0] || block?.summary || lesson?.description || `This chunk focuses on ${concept}.`
  );
  const keywords = extractKeywords(`${concept} ${summary}`);
  const courseName = getCourseName(lesson);
  const type = EXERCISE_TYPES[index % EXERCISE_TYPES.length];

  if (type === 'multiple_choice') {
    const distractors = dedupeOptions([
      `A full course summary for ${courseName}`,
      keywords[0] ? `${keywords[0]} as a side note` : 'A side note from another topic',
      `A revision checklist unrelated to ${concept}`,
      `A campus update instead of ${concept}`,
    ]).slice(0, 3);
    const insertionIndex = hashText(`${concept}:${summary}`) % 4;
    const options = [...distractors];
    options.splice(insertionIndex, 0, concept);

    return {
      type,
      prompt: 'Which option best matches the main focus of this chunk?',
      options: options.slice(0, 4),
      correctAnswer: concept,
      explanation: `This chunk is centred on ${concept}. ${summary}`,
    };
  }

  if (type === 'true_false') {
    return {
      type,
      prompt: `True or false: ${concept} is one of the key ideas taught in this chunk.`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: `True. ${summary}`,
    };
  }

  if (type === 'fill_in') {
    return {
      type,
      prompt: 'Fill in the blank: This chunk mainly explains ____.',
      placeholder: 'Type the main concept',
      correctAnswer: concept,
      acceptedAnswers: dedupeOptions([concept, ...keywords.slice(0, 2)]),
      explanation: `The expected concept is ${concept}. ${summary}`,
    };
  }

  return {
    type: 'theory',
    prompt: `In one or two sentences, explain ${concept} using this chunk.`,
    placeholder: 'Explain the idea briefly',
    correctAnswer: concept,
    keywords: dedupeOptions([concept, ...keywords]).slice(0, 4),
    explanation: `A strong answer should mention ${dedupeOptions([concept, ...keywords]).slice(0, 4).join(', ')}. ${summary}`,
  };
};

// Shared by per-chunk exercises and the final-only bank: remaps the stored
// 'short_answer' type to the 'theory' the viewer actually renders a textarea
// for, and derives correctAnswer/keywords so evaluateExercise can grade it.
// Ordering/objective_set entries are passed through untouched (their own shape).
const prepareStoredExerciseForRuntime = (ex) => {
  if (!ex) return null;
  if (ex.type === 'ordering' || ex.type === 'objective_set') return ex;
  return {
    ...ex,
    // The viewer renders textareas for 'fill_in' and 'theory' only — remap short_answer.
    type: ex.type === 'short_answer' ? 'theory' : ex.type,
    // evaluateExercise reads correctAnswer, not answer.
    correctAnswer: ex.correctAnswer || ex.answer,
    // Give theory/short_answer questions keyword hints for evaluation.
    keywords:
      (ex.type === 'short_answer' || ex.type === 'theory') && !ex.keywords
        ? (ex.answer || '')
            .split(/\W+/)
            .filter((w) => w.length > 3)
            .slice(0, 5)
        : ex.keywords,
  };
};

export const buildLessonBlocks = (lesson, lessonSchema = null) => {
  const blocks = [];
  const normalizedLesson = lessonSchema?.entity ? lessonSchema : normalizeLessonSchema(lesson);
  const lessonDocument = normalizedLesson?.entity?.content?.lessonDocument || null;
  const lessonTitle = safeText(
    normalizedLesson?.entity?.title ||
      lesson?.title ||
      'Lesson'
  );
  let currentTitle = lessonTitle;
  let currentParagraphs = [];

  if (lessonDocument?.chunks?.length) {
    const courseCode = lesson?.metadata?.course_code || '';
    const lessonNum = lessonDocument?.lessonNumber || lesson?.metadata?.lesson_number;
    lessonDocument.chunks.forEach((chunk, index) => {
      const paragraphs = (chunk?.paragraphs || [])
        .map((paragraph) => safeText(paragraph?.bodyHtml || paragraph?.bodyText || paragraph))
        .filter(Boolean);

      if (!paragraphs.length) return;

      const manifestIllus = getChunkIllustration(courseCode, lessonNum, index);
      const sections = (chunk?.sections || [])
        .map((section) => ({
          id: safeText(section?.id),
          title: safeText(section?.title),
          paragraphs: (section?.paragraphs || [])
            .map((paragraph) => safeText(paragraph?.bodyHtml || paragraph?.bodyText || paragraph))
            .filter(Boolean),
        }))
        .filter((section) => section.title && section.paragraphs.length > 0);

      blocks.push({
        type: 'text',
        title: safeText(chunk?.heading || `Concept ${index + 1}`),
        paragraphs,
        sections: sections.length > 0 ? sections : null,
        summary: safeText(chunk?.summary || paragraphs[0]),
        estimatedSeconds: estimateTextSeconds(paragraphs.join(' ')),
        illustration: normalizeChunkIllustration(
          manifestIllus || chunk?.illustration || {},
          chunk?.heading || lessonTitle,
          index
        ),
      });
    });
  }

  const flushTextBlock = () => {
    const nextParagraphs = currentParagraphs.map((paragraph) => safeText(paragraph)).filter(Boolean);
    if (!nextParagraphs.length) return;

    const paragraphGroups = [];
    let workingGroup = [];
    let workingWordCount = 0;

    nextParagraphs.forEach((paragraph) => {
      const paragraphWordCount = paragraph.split(/\s+/).filter(Boolean).length;
      const shouldSplit =
        workingGroup.length >= MAX_TEXT_CHUNK_PARAGRAPHS ||
        (workingGroup.length > 0 && workingWordCount + paragraphWordCount > MAX_TEXT_CHUNK_WORDS);

      if (shouldSplit) {
        paragraphGroups.push(workingGroup);
        workingGroup = [];
        workingWordCount = 0;
      }

      workingGroup.push(paragraph);
      workingWordCount += paragraphWordCount;
    });

    if (workingGroup.length > 0) {
      paragraphGroups.push(workingGroup);
    }

    paragraphGroups.forEach((group, index) => {
      const needsPartLabel = paragraphGroups.length > 1;
      blocks.push({
        type: 'text',
        title: safeText(
          needsPartLabel
            ? `${currentTitle || lessonTitle || `Concept ${blocks.length + 1}`} Part ${index + 1}`
            : currentTitle || lessonTitle || `Concept ${blocks.length + 1}`
        ),
        paragraphs: group,
        summary: group[0],
        estimatedSeconds: estimateTextSeconds(group.join(' ')),
        illustration: null,
      });
    });

    currentParagraphs = [];
  };

  const pushImageBlock = (input = {}) => {
    const title = safeText(input.title || currentTitle || lessonTitle || `Illustration ${blocks.length + 1}`);
    const caption = safeText(input.caption || input.alt || `${title} illustration`);
    const src = normalizeImageUrl(input.src) || buildFallbackImage(title, blocks.length);

    blocks.push({
      type: 'image',
      title,
      src,
      alt: safeText(input.alt || caption || title),
      caption,
      estimatedSeconds: estimateImageSeconds(caption || title),
    });
  };

  const videoUrl = getVideoUrl(lesson);
  if (videoUrl && String(lesson?.type || '').toLowerCase().includes('video')) {
    blocks.push({
      type: 'video',
      title: lessonTitle,
      src: videoUrl,
      caption: safeText(lesson?.description || `Watch the ${lessonTitle} walkthrough.`),
      estimatedSeconds: clamp(Number(lesson?.duration_minutes || lesson?.reading_time || 3) * 60, 30, 600),
    });
  }

  const html = getLessonBodyHtml(lesson);
  if (blocks.length === 0 && typeof window !== 'undefined' && html) {
    const parser = new window.DOMParser();
    const documentNode = parser.parseFromString(`<article>${html}</article>`, 'text/html');
    const root = documentNode.body.firstElementChild || documentNode.body;

    const processNode = (node) => {
      if (!node) return;

      if (node.nodeType === window.Node.TEXT_NODE) {
        const text = safeText(node.textContent);
        if (text.length > 48) {
          currentParagraphs.push(text);
        }
        return;
      }

      if (node.nodeType !== window.Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') return;

      if (/^h[1-4]$/.test(tag)) {
        flushTextBlock();
        currentTitle = safeText(node.textContent) || currentTitle;
        return;
      }

      if (tag === 'img') {
        flushTextBlock();
        pushImageBlock({
          src: node.getAttribute('src'),
          alt: node.getAttribute('alt'),
          title: currentTitle,
        });
        return;
      }

      if (tag === 'figure') {
        flushTextBlock();
        const image = node.querySelector('img');
        const caption = node.querySelector('figcaption');
        if (image) {
          pushImageBlock({
            src: image.getAttribute('src'),
            alt: image.getAttribute('alt'),
            title: currentTitle,
            caption: caption?.textContent,
          });
          return;
        }
      }

      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li'))
          .map((item) => safeText(item.textContent))
          .filter(Boolean);
        if (items.length > 0) {
          currentParagraphs.push(items.map((item) => `- ${item}`).join('\n'));
        }
        return;
      }

      if (tag === 'p' || tag === 'blockquote' || tag === 'pre') {
        const text = safeText(node.textContent);
        if (text) {
          currentParagraphs.push(text);
        }
        return;
      }

      Array.from(node.childNodes).forEach(processNode);
    };

    Array.from(root.childNodes).forEach(processNode);
    flushTextBlock();
  }

  if (blocks.length === 0) {
    const fallbackText = safeText(lesson?.description || `This lesson introduces ${lessonTitle}.`);
    blocks.push({
      type: 'text',
      title: lessonTitle,
      paragraphs: [fallbackText],
      summary: fallbackText,
      estimatedSeconds: estimateTextSeconds(fallbackText),
    });
  }

  const growthChunkIndex = blocks.findIndex(
    (block) =>
      block.type === 'text' &&
      normalizeText(lessonTitle) === normalizeText(GROWTH_ILLUSTRATION.lessonTitle) &&
      normalizeText(block.title) === normalizeText(GROWTH_ILLUSTRATION.chunkTitle)
  );

  if (growthChunkIndex >= 0 && !blocks[growthChunkIndex]?.illustration) {
    blocks[growthChunkIndex] = {
      ...blocks[growthChunkIndex],
      illustration: {
        src: GROWTH_ILLUSTRATION.src,
        alt: GROWTH_ILLUSTRATION.alt,
        caption: GROWTH_ILLUSTRATION.caption,
        mobilePosition: GROWTH_ILLUSTRATION.mobilePosition,
        desktopAlign: GROWTH_ILLUSTRATION.desktopAlign,
      },
    };
  }

  const featuredImage = normalizeImageUrl(
    normalizedLesson?.entity?.media?.featuredImageUrl ||
      lesson?.featured_image ||
      lesson?.thumbnail_url ||
      lesson?.metadata?.featured_image ||
      lesson?.metadata?.image ||
      lesson?.metadata?.illustration ||
      ''
  );

  if (featuredImage && !blocks.some((block) => block.type === 'image')) {
    blocks.splice(Math.min(1, blocks.length), 0, {
      type: 'image',
      title: `${lessonTitle} visual guide`,
      src: featuredImage,
      alt: `${lessonTitle} illustration`,
      caption: `Visual support for ${lessonTitle}`,
      estimatedSeconds: estimateImageSeconds(lessonTitle),
    });
  }

  // Use real exercises from the lesson schema if available (from the DB exercises column).
  // Fall back to auto-generated per-chunk exercises only when none are stored.
  // A `null` entry is a deliberate "this chunk has no exercise" marker (e.g. an
  // intro/outro chunk with nothing testable) — it must stay at its original
  // index so the position-based chunk<->exercise pairing below stays correct;
  // do NOT filter it out (that would shift every later exercise onto the wrong chunk).
  const rawExercises = normalizedLesson?.entity?.assessment?.exercises || [];
  const realExercises = rawExercises.map(prepareStoredExerciseForRuntime);

  return blocks.map((block, index) => ({
    ...block,
    id: `lesson-chunk-${index + 1}`,
    order: index + 1,
    exercise:
      realExercises.length > 0
        ? realExercises[index % realExercises.length]
        : buildExerciseFromBlock(block, index, lesson),
  }));
};

const getExpectedAnswerLabel = (exercise) => {
  if (!exercise) return '';
  if (exercise.type === 'multiple_choice' || exercise.type === 'true_false') {
    return exercise.correctAnswer;
  }
  if (exercise.type === 'fill_in') {
    return exercise.correctAnswer;
  }
  return exercise.keywords?.join(', ') || exercise.correctAnswer || '';
};

// Ordering responses are a structured, ordered array of item ids rather than
// a single typed/selected string, so they're evaluated separately before the
// generic string-based path below.
const evaluateOrderingExercise = (exercise, response) => {
  const items = Array.isArray(exercise.items) ? exercise.items : [];
  const expectedAnswer = items.map((item) => item.text).join(' → ');
  if (items.length === 0) {
    return { isReady: false, correct: false, explanation: 'This exercise is not available yet.', expectedAnswer: '' };
  }

  const order = Array.isArray(response) ? response : [];
  if (order.length < items.length) {
    return {
      isReady: false,
      correct: false,
      explanation: 'Arrange all the steps before checking.',
      expectedAnswer,
    };
  }

  const correctOrder = items.map((item) => item.id);
  const correct = order.length === correctOrder.length && order.every((id, index) => id === correctOrder[index]);
  return { isReady: true, correct, explanation: exercise.explanation, expectedAnswer };
};

// One sub-question of an 'objective_set' exercise, evaluated in isolation —
// used while stepping through the set one question at a time (before the
// full set is complete and the aggregate evaluateObjectiveSetExercise below
// takes over).
export const evaluateObjectiveSetQuestion = (question, response) => {
  const normalizedResponse = normalizeText(response);
  if (!normalizedResponse) {
    return {
      isReady: false,
      correct: false,
      explanation: 'Choose an answer before checking.',
      expectedAnswer: question?.correctAnswer || '',
    };
  }
  const correct = normalizedResponse === normalizeText(question?.correctAnswer);
  return {
    isReady: true,
    correct,
    explanation: question?.explanation,
    expectedAnswer: question?.correctAnswer,
  };
};

const evaluateObjectiveSetExercise = (exercise, response) => {
  const questions = Array.isArray(exercise.questions) ? exercise.questions : [];
  const expectedAnswer = questions.map((question) => question.correctAnswer).join('; ');
  if (questions.length === 0) {
    return { isReady: false, correct: false, explanation: 'This exercise is not available yet.', expectedAnswer: '' };
  }

  const answers = Array.isArray(response) ? response : [];
  if (answers.length < questions.length) {
    return {
      isReady: false,
      correct: false,
      explanation: 'Answer every question in this set before checking.',
      expectedAnswer,
    };
  }

  const correctCount = questions.filter(
    (question, index) => normalizeText(answers[index]) === normalizeText(question.correctAnswer)
  ).length;

  return {
    isReady: true,
    correct: correctCount === questions.length,
    explanation: `You got ${correctCount} of ${questions.length} right in this set. ${exercise.explanation || ''}`.trim(),
    expectedAnswer,
  };
};

export const evaluateExercise = (exercise, response) => {
  if (!exercise) {
    return {
      isReady: false,
      correct: false,
      explanation: 'This exercise is not available yet.',
      expectedAnswer: '',
    };
  }

  if (exercise.type === 'ordering') return evaluateOrderingExercise(exercise, response);
  if (exercise.type === 'objective_set') return evaluateObjectiveSetExercise(exercise, response);

  const normalizedResponse = normalizeText(response);
  if (!normalizedResponse) {
    return {
      isReady: false,
      correct: false,
      explanation: 'Add your answer before checking it.',
      expectedAnswer: getExpectedAnswerLabel(exercise),
    };
  }

  if (exercise.type === 'multiple_choice' || exercise.type === 'true_false') {
    const correct = normalizedResponse === normalizeText(exercise.correctAnswer);
    return {
      isReady: true,
      correct,
      explanation: exercise.explanation,
      expectedAnswer: exercise.correctAnswer,
    };
  }

  if (exercise.type === 'fill_in') {
    const expected = (exercise.acceptedAnswers || [exercise.correctAnswer]).map((answer) => normalizeText(answer));
    const correct = expected.some(
      (answer) => normalizedResponse === answer || normalizedResponse.includes(answer) || answer.includes(normalizedResponse)
    );
    return {
      isReady: true,
      correct,
      explanation: exercise.explanation,
      expectedAnswer: exercise.correctAnswer,
    };
  }

  const keywords = (exercise.keywords || [exercise.correctAnswer]).map((keyword) => normalizeText(keyword)).filter(Boolean);
  const matchedKeywords = keywords.filter((keyword) => normalizedResponse.includes(keyword));
  const requiredMatches = Math.max(2, Math.ceil(keywords.length * 0.5));
  const correct = matchedKeywords.length >= Math.min(requiredMatches, keywords.length || 1);

  return {
    isReady: true,
    correct,
    explanation: exercise.explanation,
    expectedAnswer: keywords.join(', ') || exercise.correctAnswer,
  };
};

// The final lesson test blends the lesson's reserved "final-only" bank (deeper
// typed/theory questions, never shown per-chunk) with a couple of the chunks'
// own objective questions for a fuller review. Matching/ordering/objective_set
// exercises are per-chunk only — they're excluded here so the final test (and
// CourseDetail's simpler practice-review UI, which reuses this list) never has
// to render those richer interaction types outside the main lesson flow.
export const buildFinalAssessmentQuestions = (lesson, lessonSchema = null) => {
  const normalizedLesson = lessonSchema?.entity ? lessonSchema : normalizeLessonSchema(lesson);

  const finalOnlyQuestions = (normalizedLesson?.entity?.assessment?.finalOnly || [])
    .map(prepareStoredExerciseForRuntime)
    .filter(Boolean)
    .map((exercise, index) => ({
      id: `lesson-final-only-${index + 1}`,
      order: index + 1,
      chunkId: null,
      chunkOrder: null,
      chunkTitle: null,
      exercise,
    }));

  const chunkQuestions = buildLessonBlocks(lesson, normalizedLesson)
    .filter((chunk) =>
      chunk?.exercise &&
      chunk.exercise.type !== 'ordering' &&
      chunk.exercise.type !== 'objective_set'
    )
    .slice(0, FINAL_TEST_CHUNK_REVIEW_COUNT)
    .map((chunk, index) => ({
      id: `${chunk.id}-final-question`,
      order: finalOnlyQuestions.length + index + 1,
      chunkId: chunk.id,
      chunkOrder: chunk.order,
      chunkTitle: chunk.title,
      exercise: chunk.exercise,
    }));

  return [...finalOnlyQuestions, ...chunkQuestions];
};

export const evaluateAssessmentSubmission = ({ questions = [], responses = {}, elapsedSeconds = 0, startedAt = null }) => {
  const evaluations = questions.map((question) => ({
    ...question,
    result: evaluateExercise(question.exercise, responses[question.id]),
    response: responses[question.id] || '',
  }));

  const unfinishedQuestion = evaluations.find((question) => !question.result.isReady) || null;
  if (unfinishedQuestion) {
    return {
      isReady: false,
      evaluations,
      unfinishedQuestion,
    };
  }

  const correctCount = evaluations.filter((question) => question.result.correct).length;
  const totalQuestions = evaluations.length;
  const percentScore = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
  const durationSeconds = Math.max(
    elapsedSeconds,
    startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0
  );

  return {
    isReady: true,
    evaluations,
    correctCount,
    totalQuestions,
    percentScore,
    durationSeconds,
    passed: percentScore >= FINAL_ASSESSMENT_PASS_PERCENT,
  };
};

export const formatDurationLabel = (seconds) => {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
};
