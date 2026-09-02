'use strict';
/**
 * Audit and structure PDF-extracted lesson packets/drafts.
 *
 * Usage:
 *   node src/scripts/structure_agent_lesson_packets.js
 *   node src/scripts/structure_agent_lesson_packets.js --apply
 *   node src/scripts/structure_agent_lesson_packets.js --apply --course=EFO731
 */

const fs = require('fs');
const path = require('path');
const { BACKEND_ROOT, ensureDir, writeJson } = require('./import_pipeline/extraction');
const {
  safeText,
  stripHtml,
  buildLessonDocument,
  validateLessonOutput,
} = require('./import_pipeline/content_builders');

const PACKET_DIR = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-packets', 'lessons');
const DRAFT_DIR = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-drafts', 'lessons');
const REPORT_DIR = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'lesson_packet_structure_report.json');

const STRUCTURE_VERSION = 1;
const MAX_PARAGRAPHS_PER_CHUNK = 5;

const MOJIBAKE_REPLACEMENTS = [
  ['â€¢', '-'],
  ['â€“', '-'],
  ['â€”', '-'],
  ['â€¦', '...'],
  ['â€˜', "'"],
  ['â€™', "'"],
  ['â€œ', '"'],
  ['â€', '"'],
  ['â€', '"'],
  ['Â ', ' '],
  ['Â', ''],
];

function parseArgs(argv) {
  const args = { apply: false, course: '' };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    const course = /^--course=(.+)$/.exec(arg);
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

function maybeRawCourseMatch(filePath, raw, course) {
  if (!course) return true;
  return `${filePath} ${raw}`.toLowerCase().includes(course);
}

function cleanText(value) {
  let text = String(value || '');
  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
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
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return { value: JSON.parse(raw), repaired: false, error: null };
  } catch (error) {
    const repaired = repairPacketWithRawExtractedText(raw);
    if (repaired) return { value: repaired, repaired: true, error: error.message };
    return { value: null, repaired: false, error: error.message };
  }
}

function repairPacketWithRawExtractedText(raw) {
  const marker = '"extracted_text"';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) return null;

  const colonIndex = raw.indexOf(':', markerIndex);
  const openingQuoteIndex = raw.indexOf('"', colonIndex + 1);
  const valueStart = openingQuoteIndex + 1;
  if (colonIndex < 0) return null;
  if (openingQuoteIndex < 0) {
    const packet = JSON.parse(`${raw.slice(0, colonIndex + 1)} ""}`);
    packet.status = 'needs_extraction_review';
    packet.extracted_text = '';
    packet.extraction = {
      ...(packet.extraction || {}),
      repaired_truncated_json: true,
      repair_notes: 'Packet JSON ended before extracted_text value. Closed the packet with empty text.',
    };
    packet.draft_output_template = lessonDraftTemplate();
    return packet;
  }

  const suffixPattern = /",\s*\r?\n\s*"draft_output_template"\s*:/g;
  let match = null;
  let lastMatch = null;
  while ((match = suffixPattern.exec(raw)) !== null) {
    if (match.index > valueStart) lastMatch = match;
  }
  if (!lastMatch) {
    const packet = JSON.parse(`${raw.slice(0, valueStart)}"}`);
    packet.extracted_text = decodeRawJsonStringFragment(raw.slice(valueStart));
    packet.status = packet.extracted_text ? 'ready' : 'needs_extraction_review';
    packet.extraction = {
      ...(packet.extraction || {}),
      repaired_truncated_json: true,
      repair_notes: 'Packet JSON ended inside extracted_text. Salvaged the available text and closed the packet.',
    };
    packet.draft_output_template = lessonDraftTemplate();
    return packet;
  }

  const before = raw.slice(0, valueStart);
  const rawExtractedText = raw.slice(valueStart, lastMatch.index);
  const after = raw.slice(lastMatch.index);
  const escapedExtractedText = escapeRawJsonStringFragment(rawExtractedText);

  return JSON.parse(`${before}${escapedExtractedText}${after}`);
}

function escapeRawJsonStringFragment(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\f/g, '\\f')
    .replace(/\t/g, '\\t');
}

function decodeRawJsonStringFragment(value) {
  return JSON.parse(`"${escapeRawJsonStringFragment(value)}"`);
}

function lessonDraftTemplate() {
  return {
    title: '',
    description: '',
    tags: [],
    objectives: [],
    chunks: [
      { heading: '', paragraphs: ['<p></p>'] },
    ],
    exercises: [
      { type: 'multiple_choice', prompt: '', options: ['', '', '', ''], answer: '', explanation: '' },
    ],
  };
}

function normalizeParagraphs(paragraphs) {
  return (Array.isArray(paragraphs) ? paragraphs : [])
    .map((paragraph) => {
      const text = cleanText(paragraph);
      if (!text) return '';
      if (/^\s*<(p|ul|ol|blockquote|table|h[1-6])[\s>]/i.test(text)) return text;
      return `<p>${escapeHtml(text)}</p>`;
    })
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function summarizeChunk(chunk) {
  const firstParagraph = normalizeParagraphs(chunk?.paragraphs)[0] || '';
  return stripHtml(firstParagraph).slice(0, 220);
}

function chunkPurpose(index, total, heading) {
  const normalizedHeading = safeText(heading).toLowerCase();
  if (index === 0) return normalizedHeading.includes('recap') ? 'recap' : 'orientation';
  if (index === total - 1) return normalizedHeading.includes('achieved') ? 'course_closure' : 'next_step';
  if (index === total - 2) return 'application';
  return 'concept';
}

function compactChunks(chunks) {
  const cleaned = chunks
    .map((chunk) => ({
      ...chunk,
      heading: cleanText(chunk?.heading),
      paragraphs: normalizeParagraphs(chunk?.paragraphs).slice(0, MAX_PARAGRAPHS_PER_CHUNK),
    }))
    .filter((chunk) => chunk.heading && chunk.paragraphs.length);

  if (cleaned.length <= 5) return cleaned;

  const opening = cleaned[0];
  const closing = cleaned[cleaned.length - 1];
  const middle = cleaned.slice(1, -1);
  const concept = middle.slice(0, Math.ceil(middle.length / 2));
  const application = middle.slice(Math.ceil(middle.length / 2));

  return [
    opening,
    mergeChunkGroup('Core Concepts', concept),
    mergeChunkGroup('How the Ideas Work in Practice', application),
    closing,
  ].filter((chunk) => chunk.heading && chunk.paragraphs.length);
}

function mergeChunkGroup(heading, chunks) {
  return {
    heading,
    paragraphs: chunks
      .flatMap((chunk) => [
        `<p><strong>${escapeHtml(safeText(chunk.heading))}:</strong> ${stripHtml((chunk.paragraphs || [])[0] || '')}</p>`,
        ...(chunk.paragraphs || []).slice(1),
      ])
      .filter(Boolean)
      .slice(0, MAX_PARAGRAPHS_PER_CHUNK),
  };
}

function ensureMinimumChunks(generated, context) {
  const chunks = compactChunks(generated.chunks || []);
  if (chunks.length >= 3) return chunks;

  const title = safeText(generated.title || context.source_title || 'this lesson');
  const existingText = chunks.flatMap((chunk) => chunk.paragraphs).map(stripHtml).join(' ');
  const focus = existingText.slice(0, 160) || title;

  while (chunks.length < 2) {
    chunks.push({
      heading: chunks.length === 0 ? `Welcome to ${title}` : 'Key Ideas',
      paragraphs: [`<p>This section introduces ${escapeHtml(title)} and highlights the ideas students should understand before moving into practice.</p>`],
    });
  }

  chunks.push({
    heading: Number(context.total_lessons || 0) === Number(context.lesson_number || -1) ? "What You've Achieved" : "What's Coming Up",
    paragraphs: [`<p>Review the main idea carefully: ${escapeHtml(focus)}. Use the exercises to check whether you can explain and apply it in your own words.</p>`],
  });

  return chunks;
}

function normalizeExercise(exercise, index) {
  const type = safeText(exercise?.type || 'short_answer');
  const options = Array.isArray(exercise?.options) ? exercise.options.map(cleanText).filter(Boolean) : [];
  const answer = cleanText(exercise?.answer || exercise?.correctAnswer || exercise?.correct_answer);
  const normalized = {
    id: safeText(exercise?.id) || `exercise-${index + 1}`,
    type,
    prompt: cleanText(exercise?.prompt || exercise?.question),
    options,
    answer,
    explanation: cleanText(exercise?.explanation),
  };

  if (type === 'true_false') normalized.options = ['True', 'False'];
  if (type === 'multiple_choice' && normalized.options.length > 4) {
    normalized.options = normalized.options.slice(0, 4);
  }
  return normalized;
}

function structureDraftPayload(payload, filePath) {
  const isWrapped = Boolean(payload.generated);
  const context = cleanDeep(payload.context || payload.generated?.context || {});
  const generated = cleanDeep(isWrapped ? payload.generated : payload);
  const before = JSON.stringify(payload);

  generated.chunks = ensureMinimumChunks(generated, context).map((chunk, index, all) => ({
    id: safeText(chunk.id) || `chunk_${index}`,
    heading: cleanText(chunk.heading || `Chunk ${index + 1}`),
    purpose: safeText(chunk.purpose) || chunkPurpose(index, all.length, chunk.heading),
    summary: cleanText(chunk.summary) || summarizeChunk(chunk),
    paragraphs: normalizeParagraphs(chunk.paragraphs),
    ...(chunk.illustration ? { illustration: chunk.illustration } : {}),
  }));

  generated.exercises = (generated.exercises || []).map(normalizeExercise);
  generated.objectives = (generated.objectives || [])
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 6);
  generated.tags = [...new Set((generated.tags || []).map(cleanText).filter(Boolean))];
  generated.description = cleanText(generated.description);
  generated.title = cleanText(generated.title);
  generated.lesson_document = buildLessonDocument(generated, Number(context.lesson_number || generated.lesson_number || 1));
  generated.metadata = {
    ...(generated.metadata && typeof generated.metadata === 'object' ? generated.metadata : {}),
    course_code: safeText(context.course_code || generated.metadata?.course_code),
    course_title: safeText(context.course_title || generated.metadata?.course_title),
    lesson_number: Number(context.lesson_number || generated.metadata?.lesson_number || 1),
    total_lessons: Number(context.total_lessons || generated.metadata?.total_lessons || 0) || null,
    structure_version: `agent_lesson_structure.v${STRUCTURE_VERSION}`,
    structure_source: 'pdf_extracted_agent_draft',
    source_title: safeText(context.source_title || generated.metadata?.source_title || path.basename(filePath, '.json')),
  };

  const nextPayload = isWrapped
    ? { ...payload, context, generated }
    : { ...generated, context };

  return {
    payload: nextPayload,
    changed: before !== JSON.stringify(nextPayload),
    validationErrors: validateLessonOutput(generated),
  };
}

function structurePacket(packet) {
  const before = JSON.stringify(packet);
  const nextPacket = cleanDeep(packet);
  if (nextPacket.extracted_text) nextPacket.extracted_text = cleanText(nextPacket.extracted_text);
  nextPacket.context = {
    ...(nextPacket.context || {}),
    structure_version: `agent_lesson_packet.v${STRUCTURE_VERSION}`,
  };
  nextPacket.extraction = {
    ...(nextPacket.extraction || {}),
    extractedChars: safeText(nextPacket.extracted_text).length,
  };
  return { packet: nextPacket, changed: before !== JSON.stringify(nextPacket) };
}

function processPackets(args) {
  const stats = { total: 0, valid: 0, repaired: 0, invalid: 0, changed: 0, files: [] };
  for (const filePath of walkJson(PACKET_DIR)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (args.course && !maybeRawCourseMatch(filePath, raw, args.course)) continue;
    const parsed = parseJsonFile(filePath);
    if (parsed.value && !maybeCourseMatch(filePath, parsed.value, args.course)) continue;
    stats.total += 1;
    if (!parsed.value) {
      stats.invalid += 1;
      stats.files.push({ file: path.relative(BACKEND_ROOT, filePath), status: 'invalid', error: parsed.error });
      continue;
    }

    const { packet, changed } = structurePacket(parsed.value);
    if (args.apply && (changed || parsed.repaired)) writeJson(filePath, packet);
    stats.valid += 1;
    if (parsed.repaired) stats.repaired += 1;
    if (changed || parsed.repaired) stats.changed += 1;
    stats.files.push({
      file: path.relative(BACKEND_ROOT, filePath),
      status: parsed.repaired ? 'repaired' : changed ? 'structured' : 'ok',
      chars: safeText(packet.extracted_text).length,
    });
  }
  return stats;
}

function processDrafts(args) {
  const stats = { total: 0, changed: 0, invalid: 0, validationErrors: 0, files: [] };
  for (const filePath of walkJson(DRAFT_DIR)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (args.course && !maybeRawCourseMatch(filePath, raw, args.course)) continue;
    const parsed = parseJsonFile(filePath);
    if (parsed.value && !maybeCourseMatch(filePath, parsed.value, args.course)) continue;
    stats.total += 1;
    if (!parsed.value) {
      stats.invalid += 1;
      stats.files.push({ file: path.relative(BACKEND_ROOT, filePath), status: 'invalid', error: parsed.error });
      continue;
    }

    const { payload, changed, validationErrors } = structureDraftPayload(parsed.value, filePath);
    if (args.apply && changed) writeJson(filePath, payload);
    if (changed) stats.changed += 1;
    if (validationErrors.length) stats.validationErrors += 1;
    stats.files.push({
      file: path.relative(BACKEND_ROOT, filePath),
      status: changed ? 'structured' : 'ok',
      validationErrors,
    });
  }
  return stats;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = {
    mode: args.apply ? 'apply' : 'dry-run',
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
      repaired: report.packets.repaired,
      invalid: report.packets.invalid,
      changed: report.packets.changed,
    },
    drafts: {
      total: report.drafts.total,
      changed: report.drafts.changed,
      invalid: report.drafts.invalid,
      validationErrors: report.drafts.validationErrors,
    },
  }, null, 2));
}

main();
