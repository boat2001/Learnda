'use strict';
/**
 * Produce a quality report for structured quiz and past-question drafts.
 *
 * Usage:
 *   node src/scripts/audit_agent_practice_quality.js
 */

const fs = require('fs');
const path = require('path');
const { BACKEND_ROOT, ensureDir, writeJson } = require('./import_pipeline/extraction');
const { validatePracticeOutput } = require('./import_pipeline/content_builders');

const DRAFT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-drafts');
const PACKET_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-packets');
const REPORT_DIR = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'practice_quality_report.json');
const TYPES = ['quiz', 'past_question'];

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

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasOcrNoise(text) {
  return /be+ve+|GODp|%s|\b[a-z]{25,}\b|[�]/i.test(safeText(text));
}

function hasWatermark(text) {
  return /sharether\.com|Downloaded from|get files/i.test(safeText(text));
}

function hasAnswerSpill(text) {
  return /\b(Answer|Answer key|Answers|Solutions)\s*:/i.test(safeText(text));
}

function questionIssues(question) {
  const issues = [];
  const prompt = safeText(question.prompt || question.question || question.text);
  const answer = safeText(question.answer || question.correctAnswer || question.correct_answer);
  const options = Array.isArray(question.options) ? question.options.map(safeText).filter(Boolean) : [];

  if (!prompt) issues.push('missing_prompt');
  if (prompt.length > 0 && prompt.length < 12) issues.push('short_prompt');
  if (hasOcrNoise(prompt)) issues.push('ocr_noise');
  if (hasWatermark(prompt)) issues.push('watermark');
  if (hasAnswerSpill(prompt)) issues.push('answer_spill');
  if (!answer) issues.push('missing_answer');
  if (/Review required|review the source|Generated without/i.test(answer)) issues.push('placeholder_answer');

  if (question.type === 'multiple_choice') {
    if (options.length !== 4) issues.push('bad_option_count');
    if (answer && !options.includes(answer)) issues.push('answer_not_in_options');
  }

  if (question.type === 'true_false' && answer && !['True', 'False'].includes(answer)) {
    issues.push('bad_true_false_answer');
  }

  return [...new Set(issues)];
}

function auditDraft(filePath, subtype) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const generated = payload.generated || payload;
  const validationErrors = validatePracticeOutput(generated, subtype);
  const questions = Array.isArray(generated.questions) ? generated.questions : [];
  const issueCounts = {};
  let questionsWithIssues = 0;
  let publishReadyQuestions = 0;

  for (const question of questions) {
    const issues = questionIssues(question);
    if (issues.length) questionsWithIssues += 1;
    else publishReadyQuestions += 1;
    for (const issue of issues) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }

  const needsReview = questions.some((question) => question.needs_review) ||
    validationErrors.length > 0 ||
    questionsWithIssues > 0;

  return {
    file: path.relative(BACKEND_ROOT, filePath),
    subtype,
    title: safeText(generated.title),
    questions: questions.length,
    publishReadyQuestions,
    questionsWithIssues,
    needsReview,
    validationErrors,
    issueCounts,
  };
}

function auditPackets() {
  const stats = { total: 0, invalidJson: 0, emptyText: 0, byType: {} };
  for (const subtype of TYPES) {
    const files = walkJson(path.join(PACKET_ROOT, subtype));
    stats.byType[subtype] = { total: 0, invalidJson: 0, emptyText: 0 };
    for (const filePath of files) {
      stats.total += 1;
      stats.byType[subtype].total += 1;
      try {
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!safeText(payload.extracted_text)) {
          stats.emptyText += 1;
          stats.byType[subtype].emptyText += 1;
        }
      } catch (_) {
        stats.invalidJson += 1;
        stats.byType[subtype].invalidJson += 1;
      }
    }
  }
  return stats;
}

function main() {
  const drafts = [];
  const summary = {
    files: 0,
    questions: 0,
    publishReadyQuestions: 0,
    questionsWithIssues: 0,
    filesNeedingReview: 0,
    validationErrorFiles: 0,
    issueCounts: {},
    byType: {},
  };

  for (const subtype of TYPES) {
    summary.byType[subtype] = {
      files: 0,
      questions: 0,
      publishReadyQuestions: 0,
      questionsWithIssues: 0,
      filesNeedingReview: 0,
    };

    for (const filePath of walkJson(path.join(DRAFT_ROOT, subtype))) {
      const audit = auditDraft(filePath, subtype);
      drafts.push(audit);
      summary.files += 1;
      summary.questions += audit.questions;
      summary.publishReadyQuestions += audit.publishReadyQuestions;
      summary.questionsWithIssues += audit.questionsWithIssues;
      if (audit.needsReview) summary.filesNeedingReview += 1;
      if (audit.validationErrors.length) summary.validationErrorFiles += 1;

      summary.byType[subtype].files += 1;
      summary.byType[subtype].questions += audit.questions;
      summary.byType[subtype].publishReadyQuestions += audit.publishReadyQuestions;
      summary.byType[subtype].questionsWithIssues += audit.questionsWithIssues;
      if (audit.needsReview) summary.byType[subtype].filesNeedingReview += 1;

      for (const [issue, count] of Object.entries(audit.issueCounts)) {
        summary.issueCounts[issue] = (summary.issueCounts[issue] || 0) + count;
      }
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    summary,
    packets: auditPackets(),
    highRiskDrafts: drafts
      .filter((draft) => draft.validationErrors.length || draft.questionsWithIssues > 0)
      .sort((a, b) => b.questionsWithIssues - a.questionsWithIssues)
      .slice(0, 100),
  };

  ensureDir(REPORT_DIR);
  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify({
    report: path.relative(BACKEND_ROOT, REPORT_PATH),
    summary,
    packets: report.packets,
  }, null, 2));
}

main();
