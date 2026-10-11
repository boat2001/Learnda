'use strict';
/**
 * Build no-API review drafts from agent packets using local heuristics.
 *
 * This is intentionally conservative: every output remains a draft and includes
 * needs_review metadata because no paid model or human review has checked it.
 *
 * Usage:
 *   node src/scripts/build_local_drafts_from_packets.js
 *   node src/scripts/build_local_drafts_from_packets.js --kind=lessons
 *   node src/scripts/build_local_drafts_from_packets.js --kind=practice
 *   node src/scripts/build_local_drafts_from_packets.js --limit=50
 */

const fs = require('fs');
const path = require('path');
const { BACKEND_ROOT, ensureDir, readJson, writeJson } = require('./import_pipeline/extraction');
const { safeText, toSlug } = require('./import_pipeline/content_builders');

const PACKET_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-packets');
const DRAFT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-drafts');
const MAX_LESSON_TEXT_CHARS = 18_000;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being',
  'between', 'course', 'does', 'from', 'have', 'into', 'lesson', 'more', 'most', 'must',
  'other', 'same', 'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'under', 'using', 'when', 'where', 'which',
  'while', 'with', 'would', 'your',
]);

function parseArgs(argv) {
  const args = { kind: 'all', limit: 0 };
  for (const arg of argv) {
    const kind = /^--kind=(lessons|practice|all)$/.exec(arg);
    const limit = /^--limit=(\d+)$/.exec(arg);
    if (kind) args.kind = kind[1];
    if (limit) args.limit = Number.parseInt(limit[1], 10);
  }
  return args;
}

function walkJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) out.push(full);
  }
  return out;
}

function stripJunk(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sentenceCase(value) {
  const text = safeText(value).toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function extractKeywords(text, limit = 8) {
  const counts = new Map();
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOP_WORDS.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, limit);
}

function paragraphsFromText(text) {
  return stripJunk(text)
    .split(/\n\s*\n/)
    .map((part) => safeText(part))
    .filter((part) => part.length > 80)
    .slice(0, 18);
}

function chunkParagraphs(paragraphs, count) {
  const chunks = [];
  const size = Math.max(1, Math.ceil(paragraphs.length / count));
  for (let index = 0; index < count; index += 1) {
    const group = paragraphs.slice(index * size, (index + 1) * size);
    if (group.length) chunks.push(group);
  }
  return chunks;
}

function htmlParagraph(text) {
  const escaped = safeText(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped}</p>`;
}

function buildLessonDraft(packet) {
  const context = packet.context || {};
  const text = stripJunk(packet.extracted_text || '').slice(0, MAX_LESSON_TEXT_CHARS);
  const paragraphs = paragraphsFromText(text);
  const keywords = extractKeywords(text, 10);
  const courseTitle = safeText(context.course_title || 'this course');
  const lessonNumber = Number(context.lesson_number || 1);
  const totalLessons = Number(context.total_lessons || 1);
  const sourceTitle = safeText(context.source_title || 'Course Notes');
  const isFirst = lessonNumber === 1;
  const isLast = lessonNumber === totalLessons;
  const contentGroups = chunkParagraphs(paragraphs, 3).slice(0, 3);
  const focus = keywords.slice(0, 3).map(sentenceCase).join(', ') || sourceTitle;

  const chunks = [];
  chunks.push({
    heading: isFirst ? `Welcome to ${courseTitle}` : `Recap and Link to ${sourceTitle}`,
    paragraphs: [
      htmlParagraph(
        isFirst
          ? `Welcome to ${courseTitle}. This opening lesson introduces ${sourceTitle} and shows why these ideas matter for your studies and classroom practice.`
          : `In the previous lesson, you worked with ${safeText(context.previous_title || 'the earlier topic')}. This lesson builds on that foundation by focusing on ${focus}.`
      ),
    ],
  });

  contentGroups.forEach((group, index) => {
    const headingKeyword = sentenceCase(keywords[index] || `Key Idea ${index + 1}`);
    chunks.push({
      heading: headingKeyword,
      paragraphs: [
        htmlParagraph(`Think of ${headingKeyword.toLowerCase()} like a practical classroom tool: it becomes useful when you can connect the idea to real learners, real examples, and real decisions. What would this look like in a Ghanaian classroom or study group?`),
        ...group.slice(0, 2).map(htmlParagraph),
      ],
    });
  });

  chunks.push({
    heading: isLast ? "What You've Achieved" : "What's Coming Up",
    paragraphs: [
      htmlParagraph(
        isLast
          ? `You have reached the end of this course sequence. Review the major ideas around ${focus}, then test yourself with the practice questions so the learning becomes usable.`
          : `Next, you will move into ${safeText(context.next_title || 'the next lesson')}. Keep the ideas from ${sourceTitle} in mind, because they will help you understand the next topic faster.`
      ),
    ],
  });

  const exerciseFocus = keywords.slice(0, 4);
  const exercises = [
    {
      type: 'multiple_choice',
      prompt: `Which idea is a major focus of this lesson?`,
      options: [
        sentenceCase(exerciseFocus[0] || sourceTitle),
        'A campus entertainment event',
        'A payment subscription setting',
        'A social media profile update',
      ],
      answer: sentenceCase(exerciseFocus[0] || sourceTitle),
      explanation: `The lesson content is built around ${exerciseFocus[0] || sourceTitle}.`,
    },
    {
      type: 'true_false',
      prompt: `True or false: This lesson should be reviewed with examples from the extracted course notes.`,
      options: ['True', 'False'],
      answer: 'True',
      explanation: 'The lesson was generated from extracted source notes and should be reviewed against that source.',
    },
    {
      type: 'short_answer',
      prompt: `In your own words, explain one important idea from ${sourceTitle}.`,
      options: [],
      answer: `A strong answer should explain ${exerciseFocus[0] || 'one key concept'} and connect it to the lesson content.`,
      explanation: 'Short answers should show understanding, not memorisation only.',
    },
    {
      type: 'short_answer',
      prompt: 'Give one Ghanaian classroom or campus example that can help explain this lesson.',
      options: [],
      answer: 'A strong answer should apply one lesson idea to a realistic Ghanaian classroom, study group, or campus situation.',
      explanation: 'Local examples help students connect abstract notes to real practice.',
    },
  ];

  return {
    context,
    generated: {
      title: `${sourceTitle}`,
      description: `This draft lesson introduces ${sourceTitle} for ${courseTitle}. Review it against the source notes before publishing.`,
      tags: ['local-draft', 'pdf-import', ...keywords.slice(0, 4)],
      objectives: [
        `Explain key ideas from ${sourceTitle}.`,
        `Identify important terms connected to ${focus}.`,
        `Apply the lesson ideas to Ghanaian classroom or campus examples.`,
      ],
      chunks: chunks.slice(0, 5),
      exercises,
    },
  };
}

function parseNumberedQuestions(text) {
  const lines = stripJunk(text).split(/\n+/).map((line) => safeText(line)).filter(Boolean);
  const questions = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^(?:question\s*)?(\d+)[).:\-\s]+(.+)/i);
    if (match) {
      if (current) questions.push(current);
      current = { prompt: match[2], options: [] };
      continue;
    }

    const option = line.match(/^([A-D])[).:\-\s]+(.+)/i);
    if (option && current) {
      current.options.push(option[2]);
      continue;
    }

    if (current && current.prompt.length < 500) {
      current.prompt = `${current.prompt} ${line}`;
    }
  }

  if (current) questions.push(current);
  return questions.slice(0, 80);
}

function buildPracticeDraft(packet) {
  const context = packet.context || {};
  const subtype = packet.subtype || 'quiz';
  const text = stripJunk(packet.extracted_text || '');
  const sourceTitle = safeText(context.source_title || (subtype === 'quiz' ? 'Quiz' : 'Past Question'));
  const parsed = parseNumberedQuestions(text);
  const keywords = extractKeywords(text, 8);
  const fallbackPrompt = `Review ${sourceTitle} and answer the main questions from the source paper.`;
  const questions = (parsed.length ? parsed : [{ prompt: fallbackPrompt, options: [] }]).map((question, index) => {
    const hasOptions = question.options.length >= 4;
    return {
      type: hasOptions ? 'multiple_choice' : 'theory',
      section: index < 40 ? 'Section A' : 'Section B',
      prompt: question.prompt,
      options: hasOptions ? question.options.slice(0, 4) : [],
      answer: hasOptions ? '' : `Review required. A strong answer should mention ${keywords.slice(0, 4).join(', ') || 'the relevant course concepts'}.`,
      explanation: hasOptions
        ? 'Answer key was not confidently detected by the local parser. Review before publishing.'
        : 'This theory item needs lecturer/admin review before publishing.',
      keywords: hasOptions ? [] : keywords.slice(0, 5),
      needs_review: true,
      topic: keywords[index % Math.max(1, keywords.length)] || '',
    };
  });

  return {
    context,
    subtype,
    generated: {
      title: sourceTitle,
      description: `Locally generated draft from ${sourceTitle}. Review questions and answers before publishing.`,
      tags: ['local-draft', 'pdf-import', subtype, ...keywords.slice(0, 4)],
      metadata: {
        paper_type: subtype,
        course_code: context.course_code || '',
        year: context.year || '',
        time_limit_minutes: subtype === 'past_question' ? 60 : 30,
        needs_review: true,
        review_notes: 'Generated without a paid AI API. Check extraction quality, answers, marks, and sections before publishing.',
      },
      sections: {
        A: { title: 'Section A', instructions: 'Review source paper for exact instructions.', marks: '' },
      },
      questions,
    },
  };
}

function writeDraft(packetPath, packet) {
  const isLesson = packet.kind === 'lesson';
  const draft = isLesson ? buildLessonDraft(packet) : buildPracticeDraft(packet);
  const folder = isLesson ? 'lessons' : (packet.subtype || 'quiz');
  const outDir = path.join(DRAFT_ROOT, folder);
  ensureDir(outDir);
  const sourceTitle = safeText(packet.context?.source_title || path.basename(packetPath, '.json'));
  const idSuffix = safeText(packet.context?.source_id).slice(0, 8);
  const outPath = path.join(outDir, `${toSlug(folder, sourceTitle, idSuffix)}.json`);
  writeJson(outPath, draft);
  return outPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = [
    ...(args.kind === 'all' || args.kind === 'lessons' ? walkJson(path.join(PACKET_ROOT, 'lessons')) : []),
    ...(args.kind === 'all' || args.kind === 'practice' ? walkJson(path.join(PACKET_ROOT, 'quiz')) : []),
    ...(args.kind === 'all' || args.kind === 'practice' ? walkJson(path.join(PACKET_ROOT, 'past_question')) : []),
  ].slice(0, args.limit || undefined);

  const totals = { files: files.length, drafted: 0, skipped: 0 };
  for (const filePath of files) {
    const packet = readJson(filePath, null);
    if (!packet || !packet.extracted_text || packet.status !== 'ready') {
      totals.skipped += 1;
      continue;
    }
    const outPath = writeDraft(filePath, packet);
    totals.drafted += 1;
    console.log(`[draft] ${path.relative(BACKEND_ROOT, outPath)}`);
  }

  console.log(JSON.stringify(totals, null, 2));
}

main();
