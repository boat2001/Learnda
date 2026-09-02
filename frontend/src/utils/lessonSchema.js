export const LESSON_SCHEMA_VERSION = 'lesson.v1';

const safeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const safeNumber = (...values) => {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return 0;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const firstText = (...values) => {
  for (const value of values) {
    const text = safeText(value);
    if (text) return text;
  }
  return '';
};

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => safeText(item)).filter(Boolean);
  }

  const text = safeText(value);
  if (!text) return [];

  return text
    .split(/[,\n]/)
    .map((item) => safeText(item))
    .filter(Boolean);
};

const normalizeUrl = (value) => {
  const text = safeText(value);
  if (!text) return '';
  if (/^(https?:)?\/\//i.test(text) || text.startsWith('data:') || text.startsWith('/')) return text;
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${text}`;
};

const stripHtml = (value) =>
  safeText(String(value ?? '').replace(/<[^>]+>/g, ' '));

const normalizeParagraphIllustration = (value = {}) => ({
  imageUrl: normalizeUrl(
    value?.imageUrl ||
      value?.image_url ||
      value?.src ||
      value?.url
  ),
  alt: firstText(value?.alt, value?.caption, value?.title),
  caption: firstText(value?.caption),
  credit: firstText(value?.credit),
  placement: firstText(value?.placement, 'after') || 'after',
});

const normalizeIllustrationMobilePosition = (value) => {
  const position = firstText(value).toLowerCase();
  if (['before_paragraph_0', 'before_first_paragraph', 'before_first'].includes(position)) {
    return 'before_paragraph_0';
  }
  if (['between_paragraph_0_1', 'between_paragraphs', 'between', 'middle'].includes(position)) {
    return 'between_paragraph_0_1';
  }
  if (['after_last_paragraph', 'after_last', 'after'].includes(position)) {
    return 'after_last_paragraph';
  }
  return 'between_paragraph_0_1';
};

const normalizeIllustrationDesktopAlign = (value) => {
  const align = firstText(value).toLowerCase();
  if (align === 'left') return 'left';
  return 'right';
};

const normalizeChunkIllustration = (value = {}) => {
  const imageUrl = normalizeUrl(
    value?.imageUrl ||
      value?.image_url ||
      value?.src ||
      value?.url
  );

  if (!imageUrl) return null;

  return {
    imageUrl,
    alt: firstText(value?.alt, value?.caption, value?.title),
    caption: firstText(value?.caption),
    credit: firstText(value?.credit),
    mobilePosition: normalizeIllustrationMobilePosition(
      value?.mobilePosition || value?.mobile_position || value?.placement_mobile || value?.mobile_placement
    ),
    desktopAlign: normalizeIllustrationDesktopAlign(
      value?.desktopAlign || value?.desktop_align || value?.align || value?.desktop_side
    ),
  };
};

const normalizeChunkParagraph = (value, index = 0) => {
  if (typeof value === 'string') {
    const bodyHtml = safeText(value);
    return {
      id: `par_${index}`,
      bodyHtml,
      bodyText: stripHtml(bodyHtml),
      illustration: normalizeParagraphIllustration(),
    };
  }

  const bodyHtml = firstText(value?.bodyHtml, value?.body_html, value?.html, value?.content, value?.text);
  return {
    id: firstText(value?.id, `par_${index}`) || `par_${index}`,
    bodyHtml,
    bodyText: stripHtml(bodyHtml),
    illustration: normalizeParagraphIllustration(value?.illustration || value?.image || {}),
  };
};

const normalizeLessonDocument = (lesson = {}) => {
  const document =
    lesson?.lesson_document ||
    lesson?.metadata?.lesson_document ||
    lesson?.metadata?.lesson_payload ||
    null;

  if (!document || typeof document !== 'object') return null;

  const rawChunks = Array.isArray(document?.chunks)
    ? document.chunks
    : Object.entries(document?.chunks || {})
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([chunkId, chunk]) => ({ id: chunkId, ...(chunk || {}) }));

  const chunks = rawChunks.map((chunk, index) => {
    const rawParagraphs = Array.isArray(chunk?.paragraphs)
      ? chunk.paragraphs
      : Object.entries(chunk?.chunk_content || {})
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([paragraphId, paragraph]) =>
            typeof paragraph === 'string'
              ? { id: paragraphId, body_html: paragraph }
              : { id: paragraphId, ...(paragraph || {}) }
          );

    const paragraphs = rawParagraphs
      .map((paragraph, paragraphIndex) => normalizeChunkParagraph(paragraph, paragraphIndex))
      .filter((paragraph) => paragraph.bodyHtml || paragraph.illustration.imageUrl);

    // Optional sub-headed groups within a single chunk (e.g. the "Wrapping Up"
    // bookend chunk's "Lesson Summary" + "Coming Up Next" split). Additive only
    // — `paragraphs` above stays the flat, complete list for anything that
    // doesn't know about sections (text extraction, highlighting, etc.).
    const sections = Array.isArray(chunk?.sections)
      ? chunk.sections
          .map((section, sectionIndex) => ({
            id: firstText(section?.id, `section_${sectionIndex}`) || `section_${sectionIndex}`,
            title: firstText(section?.title),
            paragraphs: (Array.isArray(section?.paragraphs) ? section.paragraphs : [])
              .map((paragraph, paragraphIndex) => normalizeChunkParagraph(paragraph, paragraphIndex))
              .filter((paragraph) => paragraph.bodyHtml || paragraph.illustration.imageUrl),
          }))
          .filter((section) => section.title && section.paragraphs.length > 0)
      : [];

    return {
      id: firstText(chunk?.id, `chunk_${index}`) || `chunk_${index}`,
      heading: firstText(chunk?.heading, chunk?.chunk_head, chunk?.title, `Chunk ${index + 1}`) || `Chunk ${index + 1}`,
      summary: firstText(chunk?.summary, paragraphs[0]?.bodyText),
      paragraphs,
      sections,
      illustration: normalizeChunkIllustration(chunk?.illustration || chunk?.image || {}),
    };
  }).filter((chunk) => chunk.paragraphs.length > 0);

  return {
    schemaVersion: firstText(document?.schema_version, 'lesson_document.v1') || 'lesson_document.v1',
    source: firstText(document?.source),
    lessonNumber: firstText(document?.lesson_number, lesson?.metadata?.lesson_number),
    mainTopic: firstText(document?.mainTopic, document?.main_topic, document?.lesson_details?.main_topic, lesson?.title),
    lessonDetails: {
      mainTopic: firstText(document?.lesson_details?.main_topic, document?.main_topic, lesson?.title),
    },
    chunks,
  };
};

const normalizeLessonType = (value) => {
  const text = safeText(value).toLowerCase();
  if (!text) return 'text_lesson';
  if (text === 'video' || text === 'video_lesson' || text.includes('video')) return 'video_lesson';
  return 'text_lesson';
};

const inferBodyHtml = (lesson = {}) => {
  const lessonDocument = normalizeLessonDocument(lesson);
  if (lessonDocument?.chunks?.length) {
    return lessonDocument.chunks
      .map((chunk) => {
        const headingHtml = chunk.heading ? `<h2>${chunk.heading}</h2>` : '';
        const paragraphHtml = chunk.paragraphs.map((paragraph) => paragraph.bodyHtml).filter(Boolean).join('');
        return `${headingHtml}${paragraphHtml}`;
      })
      .join('');
  }

  if (safeText(lesson.content)) return lesson.content;

  if (Array.isArray(lesson?.metadata?.sections) && lesson.metadata.sections.length > 0) {
    return lesson.metadata.sections
      .map((section) => {
        const title = safeText(section?.title);
        const body = safeText(section?.body || section?.content || section?.summary);
        const paragraphs = Array.isArray(section?.paragraphs) ? section.paragraphs.map((item) => safeText(item)).filter(Boolean) : [];
        const paragraphHtml = paragraphs.length > 0
          ? paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')
          : body
            ? `<p>${body}</p>`
            : '';

        return `${title ? `<h2>${title}</h2>` : ''}${paragraphHtml}`;
      })
      .join('');
  }

  if (Array.isArray(lesson?.metadata?.paragraphs) && lesson.metadata.paragraphs.length > 0) {
    return lesson.metadata.paragraphs
      .map((paragraph) => `<p>${safeText(paragraph)}</p>`)
      .join('');
  }

  const fallback = firstText(
    lesson.description,
    lesson.summary,
    lesson?.metadata?.excerpt,
    lesson?.metadata?.summary
  );

  return fallback ? `<p>${fallback}</p>` : '';
};

const inferSections = (lesson = {}, bodyHtml = '') => {
  const lessonDocument = normalizeLessonDocument(lesson);
  if (lessonDocument?.chunks?.length) {
    return lessonDocument.chunks.map((chunk, index) => ({
      id: firstText(chunk?.id, `${safeText(lesson.id) || 'lesson'}-section-${index + 1}`) || `section-${index + 1}`,
      title: firstText(chunk?.heading, `Section ${index + 1}`) || `Section ${index + 1}`,
      kind: 'content',
      summary: firstText(chunk?.summary, chunk?.paragraphs?.[0]?.bodyText),
      paragraphs: (chunk?.paragraphs || []).map((paragraph) => firstText(paragraph?.bodyHtml, paragraph?.bodyText)).filter(Boolean),
      paragraphItems: (chunk?.paragraphs || []).map((paragraph) => ({
        id: firstText(paragraph?.id) || null,
        bodyHtml: firstText(paragraph?.bodyHtml),
        bodyText: firstText(paragraph?.bodyText),
        illustration: normalizeParagraphIllustration(paragraph?.illustration || {}),
      })),
      media: {
        imageUrl: '',
        videoUrl: '',
      },
      chunk: chunk,
    }));
  }

  if (Array.isArray(lesson?.metadata?.sections) && lesson.metadata.sections.length > 0) {
    return lesson.metadata.sections.map((section, index) => ({
      id: firstText(section?.id, `${safeText(lesson.id) || 'lesson'}-section-${index + 1}`) || `section-${index + 1}`,
      title: firstText(section?.title, section?.heading, `Section ${index + 1}`) || `Section ${index + 1}`,
      kind: firstText(section?.kind, section?.type, 'content') || 'content',
      summary: firstText(section?.summary, section?.body, section?.content),
      paragraphs: Array.isArray(section?.paragraphs) ? section.paragraphs.map((item) => safeText(item)).filter(Boolean) : [],
      media: {
        imageUrl: normalizeUrl(section?.image || section?.image_url || section?.illustration),
        videoUrl: normalizeUrl(section?.video || section?.video_url),
      },
    }));
  }

  if (Array.isArray(lesson?.metadata?.paragraphs) && lesson.metadata.paragraphs.length > 0) {
    return [
      {
        id: `${safeText(lesson.id) || 'lesson'}-section-1`,
        title: firstText(lesson.title, 'Overview') || 'Overview',
        kind: 'content',
        summary: safeText(lesson.metadata.paragraphs[0]),
        paragraphs: lesson.metadata.paragraphs.map((item) => safeText(item)).filter(Boolean),
        media: {
          imageUrl: '',
          videoUrl: '',
        },
      },
    ];
  }

  const bodyText = stripHtml(bodyHtml);
  if (!bodyText) return [];

  return [
    {
      id: `${safeText(lesson.id) || 'lesson'}-section-1`,
      title: firstText(lesson.title, 'Overview') || 'Overview',
      kind: 'content',
      summary: bodyText,
      paragraphs: [bodyText],
      media: {
        imageUrl: '',
        videoUrl: '',
      },
    },
  ];
};

const normalizeOrderingItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: firstText(item?.id, `step-${index + 1}`) || `step-${index + 1}`,
      text: firstText(item?.text, item?.label, typeof item === 'string' ? item : ''),
    }))
    .filter((item) => item.text);
};

// A set of standalone multiple-choice questions answered one at a time within
// a single exercise slot — the mobile-friendly replacement for 'matching'
// (which required scanning two separately-scrolling lists on a small screen).
const normalizeObjectiveSetQuestions = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((question, index) => ({
      id: firstText(question?.id, `question-${index + 1}`) || `question-${index + 1}`,
      prompt: firstText(question?.prompt, question?.question, `Question ${index + 1}`) || `Question ${index + 1}`,
      options: Array.isArray(question?.options)
        ? question.options.map((item) => safeText(item)).filter(Boolean)
        : [],
      correctAnswer: firstText(question?.correctAnswer, question?.answer, question?.correct_answer),
      explanation: firstText(question?.explanation),
    }))
    .filter((question) => question.options.length > 0 && question.correctAnswer);
};

const normalizeExercises = (value) => {
  if (!Array.isArray(value)) return [];

  // A `null`/falsy entry is an explicit "this chunk has no exercise" marker
  // (e.g. an intro/outro chunk with nothing testable) — preserve it as null
  // rather than manufacturing a placeholder question, and keep its position
  // so index-based chunk<->exercise pairing downstream stays correct.
  return value.map((exercise, index) => {
    if (!exercise) return null;
    const type = firstText(exercise?.type, 'multiple_choice') || 'multiple_choice';
    const base = {
      id: firstText(exercise?.id, `exercise-${index + 1}`) || `exercise-${index + 1}`,
      type,
      prompt: firstText(exercise?.prompt, exercise?.question, `Exercise ${index + 1}`) || `Exercise ${index + 1}`,
      explanation: firstText(exercise?.explanation),
    };
    if (type === 'ordering') {
      return { ...base, items: normalizeOrderingItems(exercise?.items) };
    }
    if (type === 'objective_set') {
      return { ...base, questions: normalizeObjectiveSetQuestions(exercise?.questions) };
    }
    return {
      ...base,
      options: Array.isArray(exercise?.options) ? exercise.options.map((item) => safeText(item)).filter(Boolean) : [],
      answer: firstText(exercise?.answer, exercise?.correctAnswer, exercise?.correct_answer),
    };
  });
};

const normalizeAttachments = (lesson = {}) => {
  const attachmentCandidates = Array.isArray(lesson?.metadata?.attachments)
    ? lesson.metadata.attachments
    : [];

  const normalizedAttachments = attachmentCandidates.map((attachment, index) => ({
    id: firstText(attachment?.id, `attachment-${index + 1}`) || `attachment-${index + 1}`,
    label: firstText(attachment?.label, attachment?.title, `Attachment ${index + 1}`) || `Attachment ${index + 1}`,
    kind: firstText(attachment?.kind, attachment?.type, 'file') || 'file',
    url: normalizeUrl(attachment?.url || attachment?.file_url),
  })).filter((attachment) => attachment.url);

  const fileUrl = normalizeUrl(lesson?.file_url || lesson?.metadata?.file_url);
  if (fileUrl && !normalizedAttachments.some((attachment) => attachment.url === fileUrl)) {
    normalizedAttachments.unshift({
      id: 'primary-file',
      label: firstText(lesson?.title, 'Lesson file') || 'Lesson file',
      kind: firstText(lesson?.file_type, lesson?.metadata?.file_type, 'file') || 'file',
      url: fileUrl,
    });
  }

  return normalizedAttachments;
};

export const createLessonSessionSeed = (lesson = {}) => ({
  currentStageIndex: 0,
  chunkResponses: {},
  chunkFeedback: {},
  highlights: [],
  highlightMode: false,
  discussionBoards: {
    question: [],
    comment: [],
    error: [],
  },
  discussionModal: '',
  discussionDraft: '',
  replyDrafts: {},
  activeReplyTarget: '',
  liked: Boolean(lesson?.user_interactions?.liked),
  saved: Boolean(lesson?.user_interactions?.saved),
  completed: Boolean(lesson?.user_engagement?.completed || lesson?.completed),
  lessonXpEarned: 0,
  supportStatus: '',
  themePreference: 'system',
});

export const normalizeLessonSchema = (rawLesson, options = {}) => {
  const lesson = rawLesson || {};
  const metadata = lesson?.metadata || {};
  const bodyHtml = inferBodyHtml(lesson);
  const bodyText = stripHtml(bodyHtml);
  const lessonDocument = normalizeLessonDocument(lesson);
  const type = normalizeLessonType(lesson?.type || lesson?.content_type || metadata?.type);
  const durationMinutes = Math.max(
    0,
    Math.round(
      safeNumber(
        lesson?.duration_minutes,
        metadata?.duration_minutes,
        lesson?.reading_time,
        metadata?.reading_time,
        lesson?.duration
      )
    )
  );
  const wordCount = Math.max(
    0,
    Math.round(
      safeNumber(
        lesson?.word_count,
        metadata?.word_count,
        bodyText.split(/\s+/).filter(Boolean).length
      )
    )
  );

  const schema = {
    schemaVersion: LESSON_SCHEMA_VERSION,
    entity: {
      id: firstText(lesson?.id, options?.requestedLessonId) || null,
      slug: firstText(lesson?.slug, metadata?.slug) || null,
      title: firstText(lesson?.title, metadata?.title, 'Untitled Lesson') || 'Untitled Lesson',
      description: firstText(lesson?.description, metadata?.summary, metadata?.excerpt),
      type,
      status: firstText(lesson?.status, metadata?.status, 'published') || 'published',
      access: {
        isPremium: Boolean(lesson?.is_premium),
        requiredFeature: lesson?.is_premium ? 'premium_content' : null,
      },
      course: {
        id: firstText(
          metadata?.course_id,
          lesson?.course_id,
          metadata?.courseId,
          options?.courseId
        ) || null,
        title: firstText(
          metadata?.course,
          lesson?.course,
          metadata?.course_title,
          metadata?.course_name,
          options?.courseName,
          'Course'
        ) || 'Course',
        level: firstText(metadata?.level, lesson?.level),
        semester: firstText(metadata?.semester, lesson?.semester),
        programId: firstText(metadata?.program_id, lesson?.program_id) || null,
      },
      taxonomy: {
        topic: firstText(lesson?.topic, metadata?.topic, metadata?.subject),
        tags: normalizeList(lesson?.tags || metadata?.tags),
        depthLevel: firstText(lesson?.depth_level, metadata?.depth_level, 'basic') || 'basic',
        visualType: firstText(lesson?.visual_type, metadata?.visual_type, 'static') || 'static',
        difficulty: firstText(metadata?.difficulty, lesson?.difficulty, 'standard') || 'standard',
      },
      learning: {
        lessonNumber: firstText(
          metadata?.lesson_number,
          metadata?.sequence,
          lesson?.order_index,
          options?.lessonNumber,
          1
        ) || '1',
        sequence: safeNumber(metadata?.sequence, lesson?.order_index, 1),
        objectives: normalizeList(metadata?.objectives || metadata?.learning_objectives || metadata?.goals),
        outcomes: normalizeList(metadata?.outcomes || metadata?.learning_outcomes),
        prerequisites: normalizeList(metadata?.prerequisites),
        estimatedXp: Math.max(0, Math.round(safeNumber(metadata?.estimated_xp, lesson?.xp))),
      },
      media: {
        thumbnailUrl: normalizeUrl(lesson?.thumbnail_url || metadata?.thumbnail_url),
        featuredImageUrl: normalizeUrl(
          lesson?.featured_image ||
            metadata?.featured_image ||
            metadata?.image ||
            metadata?.illustration
        ),
        videoUrl: normalizeUrl(lesson?.video_url || lesson?.file_url || metadata?.video_url || metadata?.file_url),
        fileUrl: normalizeUrl(lesson?.file_url || metadata?.file_url),
        mimeType: firstText(lesson?.file_type, metadata?.file_type),
        durationMinutes,
        readingTimeMinutes: Math.max(0, Math.round(safeNumber(lesson?.reading_time, metadata?.reading_time, durationMinutes))),
        wordCount,
      },
      content: {
        format: type === 'video_lesson' ? 'video' : bodyHtml ? 'html' : 'summary',
        bodyHtml,
        bodyText,
        excerpt: firstText(metadata?.excerpt, lesson?.description, bodyText.slice(0, 180)),
        lessonDocument,
        sections: inferSections(lesson, bodyHtml),
        attachments: normalizeAttachments(lesson),
      },
      assessment: {
        source: (Array.isArray(lesson?.exercises) && lesson.exercises.length > 0) || (Array.isArray(metadata?.exercises) && metadata.exercises.length > 0) ? 'metadata' : 'generated',
        exercises: normalizeExercises(lesson?.exercises?.length ? lesson.exercises : metadata?.exercises),
        // Deeper typed/theory questions reserved exclusively for the final lesson
        // test (never shown as a per-chunk exercise) — see buildFinalAssessmentQuestions.
        finalOnly: normalizeExercises(lesson?.final_assessment?.length ? lesson.final_assessment : metadata?.final_assessment).filter(Boolean),
        checkpoints: normalizeList(metadata?.checkpoints),
      },
      authorship: {
        creatorId: firstText(lesson?.creator_id, metadata?.creator_id) || null,
        creatorName: firstText(
          lesson?.creator?.full_name,
          lesson?.creator?.name,
          metadata?.creator_name,
          lesson?.author_name
        ),
        publishedAt: firstText(lesson?.published_at, metadata?.published_at) || null,
        createdAt: firstText(lesson?.created_at, metadata?.created_at) || null,
        updatedAt: firstText(lesson?.updated_at, metadata?.updated_at) || null,
      },
      engagement: {
        likes: Math.max(0, Math.round(safeNumber(lesson?.stats?.like_count, lesson?.likes, metadata?.likes))),
        views: Math.max(0, Math.round(safeNumber(lesson?.stats?.view_count, lesson?.views, metadata?.views))),
        downloads: Math.max(0, Math.round(safeNumber(lesson?.downloads, metadata?.downloads))),
        comments: Math.max(0, Math.round(safeNumber(lesson?.stats?.comment_count, metadata?.comments))),
        shares: Math.max(0, Math.round(safeNumber(lesson?.stats?.share_count, metadata?.shares))),
      },
      progress: {
        completed: Boolean(lesson?.user_engagement?.completed || lesson?.completed),
        progressPercentage: clamp(
          Math.round(safeNumber(lesson?.user_engagement?.progress_percentage, lesson?.user_interactions?.progress, 0)),
          0,
          100
        ),
        timeSpentSeconds: Math.max(0, Math.round(safeNumber(lesson?.user_engagement?.time_spent_seconds, 0))),
      },
      metadata,
    },
    sessionSeed: createLessonSessionSeed(lesson),
    raw: lesson,
  };

  return schema;
};
