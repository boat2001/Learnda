'use strict';
/**
 * Bulk-publish agent-generated draft content (Lessons + TextItems) that has
 * already been imported by import_agent_drafts.js and is sitting at
 * status 'draft' or 'pending'.
 *
 * Scope is intentionally narrow: it ONLY touches rows tagged
 * metadata.source = 'agent_import' (the tag import_agent_drafts.js stamps on
 * every row it creates). It will never touch unrelated draft/pending content
 * (e.g. user contributions) that doesn't carry that tag.
 *
 * This mirrors exactly what the admin console's POST /content/:id/review
 * "approve" action does (see backend/src/routes/admin.js ~line 1769-1799):
 *   - status: 'pending'|'draft' -> 'published'
 *   - published_at: now
 *   - metadata.reviewed_by / reviewed_at / review_source stamped
 *
 * Usage:
 *   node src/scripts/publish_agent_drafts.js --dry-run
 *   node src/scripts/publish_agent_drafts.js --dry-run --kind=lessons
 *   node src/scripts/publish_agent_drafts.js --kind=lessons
 *   node src/scripts/publish_agent_drafts.js --kind=practice
 *   node src/scripts/publish_agent_drafts.js                 (publishes everything tagged agent_import)
 *   node src/scripts/publish_agent_drafts.js --course="general curriculum studies"
 *   node src/scripts/publish_agent_drafts.js --reviewer-id=<admin-user-uuid>
 */

const fs = require('fs');
const path = require('path');
const { Op, Sequelize } = require('sequelize');

const BACKEND_ROOT = path.join(__dirname, '..', '..');

function parseArgs(argv) {
  const args = { dryRun: false, kind: 'all', course: null, reviewerId: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else {
      const kind = /^--kind=(lessons|practice|all)$/.exec(arg);
      if (kind) args.kind = kind[1];
      const course = /^--course=(.+)$/.exec(arg);
      if (course) args.course = course[1].trim().toLowerCase();
      const reviewer = /^--reviewer-id=(.+)$/.exec(arg);
      if (reviewer) args.reviewerId = reviewer[1].trim();
    }
  }
  return args;
}

function loadEnv() {
  for (const name of ['.env', '.env.development.local', '.env.local', '.env.development']) {
    const envPath = path.join(BACKEND_ROOT, name);
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      return;
    }
  }
}

async function getReviewer(db, args) {
  if (args.reviewerId) {
    const user = await db.User.findByPk(args.reviewerId);
    if (!user) throw new Error(`--reviewer-id=${args.reviewerId} did not match any user`);
    return user;
  }
  const admin = await db.User.findOne({ where: { role: { [Op.in]: ['admin', 'lecturer'] } }, order: [['created_at', 'ASC']] });
  if (!admin) throw new Error('No admin/lecturer user found. Pass --reviewer-id=<uuid> explicitly.');
  return admin;
}

async function publishRows(Model, label, args, reviewer, totals) {
  const where = {
    status: { [Op.in]: ['draft', 'pending'] },
    [Op.and]: [
      Sequelize.where(Sequelize.cast(Sequelize.col('metadata'), 'jsonb'), '@>', JSON.stringify({ source: 'agent_import' })),
    ],
  };

  let rows = await Model.findAll({ where });

  // Course filtering done in JS rather than raw SQL on JSONB text -- simpler and
  // safer than building a brittle ILIKE-on-cast-text query. Dataset here is small
  // (a few hundred rows at most), so this is cheap.
  if (args.course) {
    const needle = args.course.toLowerCase();
    rows = rows.filter((row) => {
      const meta = row.metadata || {};
      const haystacks = [
        meta.course, meta.course_title, meta.source_note_title,
        row.title,
      ].filter(Boolean).map((s) => String(s).toLowerCase());
      return haystacks.some((h) => h.includes(needle));
    });
  }

  for (const row of rows) {
    totals.found += 1;
    if (args.dryRun) {
      console.log(`[would-publish] ${label} ${row.id} "${row.title}" (status=${row.status})`);
      continue;
    }
    await row.update({
      status: 'published',
      published_at: new Date(),
      metadata: {
        ...(row.metadata || {}),
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
        review_source: 'agent_bulk_publish',
      },
    });
    totals.published += 1;
    console.log(`[published] ${label} ${row.id} "${row.title}"`);
  }
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const db = require('../models');
  await db.sequelize.authenticate();
  const reviewer = await getReviewer(db, args);
  console.log(`Acting as reviewer: ${reviewer.id} (${reviewer.email || reviewer.username || 'unknown'})`);

  const totals = { found: 0, published: 0, dryRun: args.dryRun };

  if (args.kind === 'all' || args.kind === 'lessons') {
    await publishRows(db.Lesson, 'lesson', args, reviewer, totals);
  }
  if (args.kind === 'all' || args.kind === 'practice') {
    await publishRows(db.TextItem, 'text_item', args, reviewer, totals);
  }

  console.log(JSON.stringify(totals, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const db = require('../models');
      await db.sequelize.close();
    } catch (_) {
      // Ignore shutdown errors.
    }
  });
