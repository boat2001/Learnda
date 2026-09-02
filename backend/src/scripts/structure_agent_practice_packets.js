'use strict';
/**
 * Audit and structure PDF-extracted quiz and past-question packets/drafts.
 *
 * Usage:
 *   node src/scripts/structure_agent_practice_packets.js
 *   node src/scripts/structure_agent_practice_packets.js --apply
 *   node src/scripts/structure_agent_practice_packets.js --apply --type=quiz
 *   node src/scripts/structure_agent_practice_packets.js --apply --course="Basic Design"
 */

const fs = require('fs');
const path = require('path');
const { BACKEND_ROOT, ensureDir, writeJson } = require('./import_pipeline/extraction');
const {
  safeText,
  validatePracticeOutput,
  normalizePracticeOutput,
} = require('./import_pipeline/content_builders');

const PACKET_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-packets');
const DRAFT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-drafts');
const REPORT_DIR = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'practice_packet_structure_report.json');
const STRUCTURE_VERSION = 1;

const PRACTICE_TYPES = ['quiz', 'past_question'];
const WATERMARK_PATTERNS = [
  /Downloaded from learnda\.com/gi,
  /Downloaded from/gi,
  /Get files and let's learn together/gi,
  /Get files and let's leat together/gi,
  /learnda\.com/gi,
];

const PLACEHOLDER_ANSWER_PATTERN = /^(Review required|Review the source|Generated without|This theory item needs|Answer key was not confidently)/i;
const ANSWER_KEY_SPILLOVER_PATTERN = /\s*(?:&&+|[-=]{4,}|\*{4,})?\s*(?:ANSWERS?|ANSWER KEY|SOLUTIONS?)\s+(?:TO\s+)?(?:QUIZ|QUESTIONS?|SECTION|PAPER)?\b.*$/i;

const MOJIBAKE_REPLACEMENTS = [
  ['â€¢', '-'],
  ['â€“', '-'],
  ['â€”', '-'],
  ['â€¦', '...'],
  ['â„¢', 'th'],
  ['â€˜', "'"],
  ['â€™', "'"],
  ['â€œ', '"'],
  ['â€', '"'],
  ['Ã©', 'e'],
  ['Â ', ' '],
  ['Â', ''],
];

function parseArgs(argv) {
  const args = { apply: false, type: 'all', course: '' };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    const type = /^--type=(quiz|past_question|all)$/.exec(arg);
    const course = /^--course=(.+)$/.exec(arg);
    if (type) args.type = type[1];
    if (course) args.course = course[1].trim().toLowerCase();
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

function selectedTypes(args) {
  return args.type === 'all' ? PRACTICE_TYPES : [args.type];
}

function cleanText(value) {
  let text = String(value || '');
  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  for (const pattern of WATERMARK_PATTERNS) {
    text = text.replace(pattern, ' ');
  }
  return text
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.{5,}/g, '____')
    .replace(/\s+([?.!,;:])/g, '$1')
    .trim();
}

function cleanPrompt(value) {
  return cleanText(value)
    .replace(ANSWER_KEY_SPILLOVER_PATTERN, '')
    .replace(/\s*Candidate'?s Index Number.*$/i, '')
    .replace(/\s*Signature:\s*/i, '')
    .replace(/\s*Page\s+\d+\s+of\s+\d+\s*$/i, '')
    .replace(/[&]{4,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDeep(value) {
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map(cleanDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanDeep(item)]));
  }
  return value;
}

function parseJsonFile(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function maybeCourseMatch(filePath, value, course) {
  if (!course) return true;
  const text = [
    filePath,
    value?.context?.course_code,
    value?.context?.course_title,
    value?.context?.source_title,
    value?.generated?.title,
    value?.title,
  ].map(safeText).join(' ').toLowerCase();
  return text.includes(course);
}

function normalizeSections(sections, subtype) {
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) {
    return {
      A: {
        title: subtype === 'past_question' ? 'Section A' : 'Practice Questions',
        instructions: subtype === 'past_question'
          ? 'Answer according to the source paper instructions.'
          : 'Answer all questions and review explanations where provided.',
        marks: '',
      },
    };
  }

  return Object.fromEntries(Object.entries(sections).map(([key, value]) => {
    if (typeof value === 'string') {
      return [key, { title: cleanText(value), instructions: '', marks: '' }];
    }
    return [key, {
      title: cleanText(value?.title || value?.name || key),
      instructions: cleanText(value?.instructions || value?.instruction),
      marks: cleanText(value?.marks || value?.score),
    }];
  }));
}

function normalizeType(question) {
  const explicit = safeText(question?.type || question?.question_type).toLowerCase();
  const prompt = cleanText(question?.prompt || question?.question || question?.text);
  const options = Array.isArray(question?.options) ? question.options.map(cleanText).filter(Boolean) : [];

  if (explicit === 'true_false' || explicit === 'true-false' || /\btrue\s+or\s+false\b/i.test(prompt)) {
    return 'true_false';
  }
  if (options.length >= 4) {
    return 'multiple_choice';
  }
  return 'theory';
}

function extractPromptOptions(prompt) {
  const text = cleanText(prompt);
  const lettered = [...text.matchAll(/\b([A-D])[\).]\s*([^A-D]+?)(?=\s+[A-D][\).]\s+|$)/gi)]
    .map((match) => cleanText(match[2]))
    .filter(Boolean);
  if (lettered.length >= 4) {
    return {
      prompt: cleanText(text.replace(/\b[A-D][\).]\s*([^A-D]+?)(?=\s+[A-D][\).]\s+|$)/gi, '')),
      options: lettered.slice(0, 4),
    };
  }
  return { prompt: text, options: [] };
}

function normalizeAnswer(answer, options, type) {
  const text = cleanText(answer);
  if (!text) return '';
  if (PLACEHOLDER_ANSWER_PATTERN.test(text)) return '';
  if (type === 'true_false') {
    if (/^true$/i.test(text)) return 'True';
    if (/^false$/i.test(text)) return 'False';
    return '';
  }
  if (type !== 'multiple_choice') return text;
  const letter = /^([A-D])$/i.exec(text);
  if (letter && options.length >= 4) return options[letter[1].toUpperCase().charCodeAt(0) - 65] || text;
  const match = options.find((option) => option.toLowerCase() === text.toLowerCase());
  return match || '';
}

function splitEmbeddedAnswer(prompt) {
  const text = cleanPrompt(prompt);
  const match = /\bAnswer\s*:\s*/i.exec(text);
  if (!match) return { prompt: text, answer: '' };
  const questionText = text.slice(0, match.index).trim();
  const answerText = text.slice(match.index + match[0].length).trim();
  if (!questionText || !answerText || /^assignment\s*:?$/i.test(answerText)) {
    return { prompt: questionText || text.replace(/\bAnswer\s*:\s*.*$/i, '').trim(), answer: '' };
  }
  return { prompt: questionText, answer: answerText };
}

function normalizeQuestion(question, index, fallbackSection, subtype) {
  const extracted = extractPromptOptions(question?.prompt || question?.question || question?.text);
  const originalOptions = Array.isArray(question?.options) ? question.options.map(cleanText).filter(Boolean) : [];
  const options = originalOptions.length ? originalOptions : extracted.options;
  const type = normalizeType({ ...question, options, prompt: extracted.prompt });
  const normalizedOptions = type === 'true_false'
    ? ['True', 'False']
    : type === 'multiple_choice'
      ? options.slice(0, 4)
      : [];
  const embedded = splitEmbeddedAnswer(extracted.prompt);
  const answer = normalizeAnswer(
    question?.answer || question?.correctAnswer || question?.correct_answer || question?.solution || embedded.answer,
    normalizedOptions,
    type
  );
  const prompt = embedded.prompt;
  const keywords = Array.isArray(question?.keywords)
    ? question.keywords.map(cleanText).filter(Boolean)
    : [];
  const needsReview = Boolean(question?.needs_review) ||
    !answer ||
    (type === 'multiple_choice' && normalizedOptions.length !== 4) ||
    /[.]{5,}|be+ve+|%s|GODp/i.test(prompt);

  return {
    id: safeText(question?.id) || `practice-question-${index + 1}`,
    order: Number(question?.order || index + 1),
    type,
    section: cleanText(question?.section || fallbackSection || (subtype === 'past_question' ? 'Section A' : 'Practice')),
    prompt,
    options: normalizedOptions,
    answer,
    correctAnswer: answer,
    acceptedAnswers: answer ? [answer] : [],
    explanation: PLACEHOLDER_ANSWER_PATTERN.test(cleanText(question?.explanation || question?.solution_explanation))
      ? 'Review the source paper before publishing this answer.'
      : cleanText(question?.explanation || question?.solution_explanation) ||
      (needsReview ? 'Review the source paper before publishing this answer.' : ''),
    keywords,
    topic: cleanText(question?.topic || question?.chunkTitle || question?.category),
    needs_review: needsReview,
  };
}

function qualityIssues(question) {
  const issues = [];
  const prompt = safeText(question.prompt);
  const answer = safeText(question.answer);
  if (!answer) issues.push('missing_answer');
  if (prompt.length > 0 && prompt.length < 12) issues.push('short_prompt');
  if (/be+ve+|GODp|%s|\b[a-z]{25,}\b|[�]/i.test(prompt)) issues.push('ocr_noise');
  if (/learnda\.com|Downloaded from|get files/i.test(prompt)) issues.push('watermark');
  if (/\b(Answer|Answer key|Answers|Solutions)\s*:/i.test(prompt)) issues.push('answer_spill');
  if (question.type === 'multiple_choice') {
    if (!Array.isArray(question.options) || question.options.length !== 4) issues.push('bad_option_count');
    if (answer && !(question.options || []).includes(answer)) issues.push('answer_not_in_options');
  }
  if (question.type === 'true_false' && answer && !['True', 'False'].includes(answer)) {
    issues.push('bad_true_false_answer');
  }
  return issues;
}

function summarizeQuality(questions) {
  const issueCounts = {};
  let publishReadyQuestions = 0;
  let questionsWithIssues = 0;
  for (const question of questions) {
    const issues = qualityIssues(question);
    if (issues.length) questionsWithIssues += 1;
    else publishReadyQuestions += 1;
    for (const issue of issues) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }
  return {
    publishReadyQuestions,
    questionsWithIssues,
    issueCounts,
    qualityStatus: questionsWithIssues === 0 ? 'publish_ready' : 'needs_review',
  };
}

function structureDraftPayload(payload, subtype, filePath) {
  const isWrapped = Boolean(payload.generated);
  const context = cleanDeep(payload.context || payload.generated?.context || {});
  const generated = cleanDeep(isWrapped ? payload.generated : payload);
  const before = JSON.stringify(payload);
  const expectedSubtype = subtype || payload.subtype || generated.subtype || 'quiz';

  generated.title = cleanText(generated.title || context.source_title || path.basename(filePath, '.json'));
  generated.description = cleanText(generated.description) ||
    `Practice questions generated from ${generated.title}. Review answers before publishing.`;
  generated.tags = [...new Set((generated.tags || []).map(cleanText).filter(Boolean))];
  generated.sections = normalizeSections(generated.sections, expectedSubtype);
  generated.questions = (generated.questions || [])
    .map((question, index) => normalizeQuestion(question, index, safeText(question?.section), expectedSubtype))
    .filter((question) => question.prompt)
    .map((question, index) => ({ ...question, id: `practice-question-${index + 1}`, order: index + 1 }));
  const quality = summarizeQuality(generated.questions);

  generated.metadata = {
    ...(generated.metadata && typeof generated.metadata === 'object' ? generated.metadata : {}),
    paper_type: expectedSubtype,
    course_code: safeText(context.course_code || generated.metadata?.course_code),
    course_title: safeText(context.course_title || generated.metadata?.course_title),
    year: safeText(context.year || generated.metadata?.year),
    question_count: generated.questions.length,
    objective_count: generated.questions.filter((question) => ['multiple_choice', 'true_false'].includes(question.type)).length,
    theory_count: generated.questions.filter((question) => question.type === 'theory').length,
    publish_ready_questions: quality.publishReadyQuestions,
    questions_with_issues: quality.questionsWithIssues,
    quality_status: quality.qualityStatus,
    quality_issue_counts: quality.issueCounts,
    needs_review: generated.questions.some((question) => question.needs_review) || quality.qualityStatus !== 'publish_ready',
    structure_version: `agent_practice_structure.v${STRUCTURE_VERSION}`,
    structure_source: 'pdf_extracted_agent_draft',
    source_title: safeText(context.source_title || generated.metadata?.source_title || path.basename(filePath, '.json')),
  };

  const normalized = normalizePracticeOutput(generated);
  const validationErrors = validatePracticeOutput(generated, expectedSubtype);
  const nextPayload = isWrapped
    ? { ...payload, subtype: expectedSubtype, context, generated }
    : { ...generated, subtype: expectedSubtype, context };

  return {
    payload: nextPayload,
    changed: before !== JSON.stringify(nextPayload),
    validationErrors,
    questionCount: normalized.questions.length,
  };
}

function structurePacket(packet, subtype) {
  const before = JSON.stringify(packet);
  const nextPacket = cleanDeep(packet);
  nextPacket.subtype = nextPacket.subtype || subtype;
  nextPacket.context = {
    ...(nextPacket.context || {}),
    structure_version: `agent_practice_packet.v${STRUCTURE_VERSION}`,
  };
  if (typeof nextPacket.extracted_text === 'string') {
    nextPacket.extracted_text = cleanText(nextPacket.extracted_text);
  }
  nextPacket.extraction = {
    ...(nextPacket.extraction || {}),
    extractedChars: safeText(nextPacket.extracted_text).length,
  };
  return { packet: nextPacket, changed: before !== JSON.stringify(nextPacket) };
}

function processPackets(args) {
  const stats = { total: 0, valid: 0, invalid: 0, changed: 0, emptyText: 0, files: [] };
  for (const subtype of selectedTypes(args)) {
    for (const filePath of walkJson(path.join(PACKET_ROOT, subtype))) {
      const parsed = parseJsonFile(filePath);
      if (parsed.value && !maybeCourseMatch(filePath, parsed.value, args.course)) continue;
      stats.total += 1;
      if (!parsed.value) {
        stats.invalid += 1;
        stats.files.push({ file: path.relative(BACKEND_ROOT, filePath), status: 'invalid', error: parsed.error });
        continue;
      }
      const { packet, changed } = structurePacket(parsed.value, subtype);
      if (!safeText(packet.extracted_text)) stats.emptyText += 1;
      if (args.apply && changed) writeJson(filePath, packet);
      stats.valid += 1;
      if (changed) stats.changed += 1;
      stats.files.push({
        file: path.relative(BACKEND_ROOT, filePath),
        status: changed ? 'structured' : 'ok',
        subtype,
        chars: safeText(packet.extracted_text).length,
      });
    }
  }
  return stats;
}

function processDrafts(args) {
  const stats = { total: 0, valid: 0, invalidJson: 0, changed: 0, validationErrors: 0, questions: 0, files: [] };
  for (const subtype of selectedTypes(args)) {
    for (const filePath of walkJson(path.join(DRAFT_ROOT, subtype))) {
      const parsed = parseJsonFile(filePath);
      if (parsed.value && !maybeCourseMatch(filePath, parsed.value, args.course)) continue;
      stats.total += 1;
      if (!parsed.value) {
        stats.invalidJson += 1;
        stats.files.push({ file: path.relative(BACKEND_ROOT, filePath), status: 'invalid_json', error: parsed.error });
        continue;
      }
      const result = structureDraftPayload(parsed.value, subtype, filePath);
      if (args.apply && result.changed) writeJson(filePath, result.payload);
      stats.valid += 1;
      stats.questions += result.questionCount;
      if (result.changed) stats.changed += 1;
      if (result.validationErrors.length) stats.validationErrors += 1;
      stats.files.push({
        file: path.relative(BACKEND_ROOT, filePath),
        status: result.changed ? 'structured' : 'ok',
        subtype,
        questions: result.questionCount,
        validationErrors: result.validationErrors,
      });
    }
  }
  return stats;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = {
    mode: args.apply ? 'apply' : 'dry-run',
    type: args.type,
    course: args.course || null,
    generated_at: new Date().toISOString(),
    packets: processPackets(args),
    drafts: processDrafts(args),
  };

  ensureDir(REPORT_DIR);
  writeJson(REPORT_PATH, report);

  console.log(JSON.stringify({
    mode: report.mode,
    report: path.relative(BACKEND_ROOT, REPORT_PATH),
    packets: {
      total: report.packets.total,
      valid: report.packets.valid,
      invalid: report.packets.invalid,
      changed: report.packets.changed,
      emptyText: report.packets.emptyText,
    },
    drafts: {
      total: report.drafts.total,
      valid: report.drafts.valid,
      invalidJson: report.drafts.invalidJson,
      changed: report.drafts.changed,
      validationErrors: report.drafts.validationErrors,
      questions: report.drafts.questions,
    },
  }, null, 2));
}

main();
