// src/controllers/contentController.js
const { Op, Sequelize } = require('sequelize');
const db = require('../models');
const { ContentEngagement, ContentStats, Comment, User } = db;
const { findById, findModelInstance, normalizeRow } = require('../utils/contentLookup');
const { buildCanonicalPayload } = require('../scripts/clean_edutainment_uploads');
const { getFileUrl } = require('../config/upload');

const PUBLIC_WHERE = { status: 'published' };
// Non-learning tags still used for text_lesson filtering across the view
const NON_LEARNING_TAGS = ['about', 'team', 'profile', 'contributors', 'donators'];
const NON_LEARNING_SUBTYPES = ['site_info', 'team_profile'];

/**
 * Build a WHERE clause fragment for the all_content view using raw SQL conditions.
 * Returns an object used with sequelize.query replacements.
 */
const buildLearningFeedWhere = (includeMisc = false) => {
  // For the all_content view we filter in raw SQL; this helper returns
  // the extra SQL condition string to append after "WHERE status = 'published'"
  if (includeMisc) return '';
  return `AND (subtype IS NULL OR subtype NOT IN ('site_info','team_profile'))
    AND NOT (content_type = 'lesson' AND tags::text[] && ARRAY['about','team','profile','contributors','donators']::text[])`;
};

const resolvePlanName = (user) => {
  if (!user) return 'Basic Student';
  return user.subscription?.plan?.name || user.current_plan || 'Basic Student';
};

const hasPremiumAccess = (user) => {
  const planName = resolvePlanName(user);
  return planName && planName !== 'Basic Student';
};

const SUPPORTED_REACTION_EMOJIS = ['😂', '🤯', '❤️', '💡', '👏'];

async function getReactionAggregate(contentId, userId) {
  const reactionEngagements = await ContentEngagement.findAll({
    where: {
      content_id: contentId,
      action: 'rate',
      [Op.or]: [
        Sequelize.where(Sequelize.cast(Sequelize.col('metadata'), 'jsonb'), '@>', JSON.stringify({ kind: 'reaction' })),
        Sequelize.where(Sequelize.cast(Sequelize.col('metadata'), 'jsonb'), '@>', JSON.stringify({ reaction: true })),
      ],
    },
    attributes: ['user_id', 'metadata', 'createdAt'],
  });

  const latestByUser = new Map();
  let userReaction = null;
  let userReactionAt = 0;
  reactionEngagements.forEach((row) => {
    const emoji = row.metadata?.emoji;
    if (!emoji || !SUPPORTED_REACTION_EMOJIS.includes(emoji)) return;
    const rowUserId = String(row.user_id || '');
    const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : 0;
    const previous = latestByUser.get(rowUserId);
    if (!previous || createdAt >= previous.createdAt) {
      latestByUser.set(rowUserId, { emoji, createdAt });
    }
    if (userId && rowUserId === String(userId)) {
      if (!userReaction || createdAt >= userReactionAt) {
        userReaction = emoji;
        userReactionAt = createdAt;
      }
    }
  });

  const counts = {};
  latestByUser.forEach(({ emoji }) => {
    counts[emoji] = (counts[emoji] || 0) + 1;
  });

  return { reaction_counts: counts, user_reactions: userReaction ? [userReaction] : [] };
}

async function ensureStats(contentId) {
  const [stats] = await ContentStats.findOrCreate({
    where: { content_id: contentId },
    defaults: { content_id: contentId }
  });
  return stats;
}

async function getUserInteractions(userId, contentId) {
  if (!userId) {
    return {
      liked: false,
      saved: false,
      completed: false,
      progress: 0,
      metadata: {},
      lessonState: null,
      completionSummary: null,
      finalAssessment: null,
      lastAction: null,
      lastViewedAt: null,
      completedAt: null,
      durationSeconds: 0,
      reaction_counts: {},
      user_reactions: [],
    };
  }

  const engagements = await ContentEngagement.findAll({
    where: {
      user_id: userId,
      content_id: contentId
    }
  });

  const liked = engagements.some((eng) => eng.type === 'like' || eng.action === 'like');
  const saved = engagements.some((eng) => eng.type === 'bookmark' || eng.action === 'save' || eng.action === 'bookmark');
  const completed = engagements.some((eng) => eng.action === 'complete' || eng.metadata?.completed);
  const progress = engagements.reduce((max, eng) => {
    const progressValue = Number(eng.progress_percentage || eng.metadata?.progress_percentage || 0);
    return Math.max(max, progressValue);
  }, 0);
  const latestLearningEngagement = engagements.reduce((latest, engagement) => {
    if (!engagement || !['view', 'complete'].includes(engagement.action)) return latest;
    if (!latest) return engagement;
    return new Date(engagement.created_at).getTime() > new Date(latest.created_at).getTime() ? engagement : latest;
  }, null);
  const latestCompletionEngagement = engagements.reduce((latest, engagement) => {
    if (!engagement || engagement.action !== 'complete') return latest;
    if (!latest) return engagement;
    return new Date(engagement.created_at).getTime() > new Date(latest.created_at).getTime() ? engagement : latest;
  }, null);
  const engagementMetadata =
    latestLearningEngagement?.metadata ||
    latestCompletionEngagement?.metadata ||
    {};

  return {
    liked,
    saved,
    completed,
    progress,
    metadata: engagementMetadata,
    lessonState:
      engagementMetadata?.lesson_state ||
      latestCompletionEngagement?.metadata?.lesson_state ||
      null,
    completionSummary:
      latestCompletionEngagement?.metadata?.completion_summary ||
      engagementMetadata?.completion_summary ||
      null,
    finalAssessment:
      engagementMetadata?.final_assessment ||
      latestCompletionEngagement?.metadata?.final_assessment ||
      null,
    lastAction: latestLearningEngagement?.action || latestCompletionEngagement?.action || null,
    lastViewedAt: latestLearningEngagement?.created_at || null,
    completedAt: latestCompletionEngagement?.created_at || null,
    durationSeconds: Number(
      latestLearningEngagement?.duration_seconds ||
      latestCompletionEngagement?.duration_seconds ||
      0
    ),
    ...(await getReactionAggregate(contentId, userId)),
    like_count: (await ContentStats.findOne({ where: { content_id: contentId }, attributes: ['like_count'] }))?.like_count || 0,
  };
}

const escapeSvgText = (value = '') =>
  value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeShareKey = (content) => {
  const type = String(content?.type || '').toLowerCase();
  const category = String(content?.metadata?.category || content?.category || '').toLowerCase();

  if (type === 'quote' || category.includes('quote')) return 'quote';
  if (category.includes('fact') || category.includes('did_you_know')) return 'fact';
  if (type === 'joke' || category.includes('joke')) return 'joke';
  if (type === 'story' || category.includes('story')) return 'story';
  if (type === 'blog' || type === 'article' || category.includes('article')) return 'article';
  return 'article';
};

const pickBody = (content) =>
  content?.metadata?.body ||
  content?.metadata?.content ||
  content?.description ||
  content?.title ||
  '';

const pickAuthor = (content) =>
  content?.metadata?.author ||
  content?.creator?.full_name ||
  content?.creator_name ||
  'Unknown author';

const splitWordsToLines = (text = '', maxChars = 24) => {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxChars && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = nextLine;
  });
  if (line) lines.push(line);
  return lines;
};

const fitQuoteLines = (text, maxWidth, maxHeight) => {
  for (let fontSize = 102; fontSize >= 48; fontSize -= 2) {
    const approxChars = Math.max(12, Math.floor(maxWidth / (fontSize * 0.54)));
    const lines = splitWordsToLines(text, approxChars);
    const lineHeight = Math.round(fontSize * 1.18);
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, fontSize, lineHeight };
    }
  }

  return {
    lines: splitWordsToLines(text, 24),
    fontSize: 48,
    lineHeight: 57
  };
};

const brandLogoSvg = ({ x, baselineY, align = 'left' }) => {
  const logoSize = 30;
  const brand = 'Learnda';
  const estimatedTextWidth = 120;
  const totalWidth = logoSize + 10 + estimatedTextWidth;
  const startX = align === 'right' ? x - totalWidth : x;
  const logoY = baselineY - 23;

  return `
    <rect x="${startX}" y="${logoY}" width="${logoSize}" height="${logoSize}" rx="8" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.48)" />
    <text x="${startX + 9}" y="${logoY + 20}" fill="#ffffff" font-size="18" font-family="Manrope, Segoe UI, sans-serif" font-weight="700">S</text>
    <text x="${startX + logoSize + 10}" y="${baselineY}" fill="rgba(255,255,255,0.92)" font-size="26" font-family="Manrope, Segoe UI, sans-serif" font-weight="600">${brand}</text>
  `;
};

const buildQuoteShareCardSvg = ({ quote, author }) => {
  const placement = Math.random() < 0.5 ? 'top-right' : 'bottom-left';
  const { lines, fontSize, lineHeight } = fitQuoteLines(quote, 1008, 960);
  const quoteStartY = 290;
  const rawAuthorY = quoteStartY + lines.length * lineHeight + 44;
  const authorY = Math.min(rawAuthorY, 1524);

  const quoteLines = lines
    .map((line, index) => {
      const y = quoteStartY + index * lineHeight;
      return `<text x="96" y="${y}" fill="#ffffff" font-size="${fontSize}" font-family="Manrope, Segoe UI, sans-serif" font-weight="700">${escapeSvgText(line)}</text>`;
    })
    .join('\n');

  const topBrand = placement === 'top-right' ? brandLogoSvg({ x: 1104, baselineY: 132, align: 'right' }) : '';
  const bottomBrand = placement === 'bottom-left' ? brandLogoSvg({ x: 96, baselineY: authorY, align: 'left' }) : '';
  const authorX = placement === 'bottom-left' ? 336 : 96;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#164f84" />
          <stop offset="52%" stop-color="#1d7d9a" />
          <stop offset="100%" stop-color="#2d9b8f" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1600" fill="url(#bg)" />
      <circle cx="1020" cy="210" r="240" fill="rgba(255,255,255,0.1)" />

      <rect x="96" y="86" width="62" height="62" rx="14" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.48)" />
      <text x="115" y="132" fill="#ffffff" font-size="44" font-family="Manrope, Segoe UI, sans-serif" font-weight="700">&#8220;</text>
      <text x="176" y="132" fill="#ffffff" font-size="54" font-family="Manrope, Segoe UI, sans-serif" font-weight="700">Quote for the day</text>

      ${topBrand}
      ${quoteLines}

      <text x="${authorX}" y="${authorY}" fill="rgba(255,255,255,0.92)" font-size="34" font-family="Manrope, Segoe UI, sans-serif" font-weight="500">- ${escapeSvgText(author)}</text>
      ${bottomBrand}
    </svg>
  `;
};

const buildGenericShareCardSvg = ({ title, category, body, key }) => {
  const glyphMap = {
    quote: '&#8220;',
    fact: '?',
    joke: '&#9786;',
    article: '&#9998;',
    story: '&#9654;'
  };
  const glyph = glyphMap[key] || '&#10022;';
  const bodyLines = splitWordsToLines(body, 34).slice(0, 10);
  const bodyText = bodyLines
    .map((line, index) => `<text x="96" y="${640 + index * 62}" fill="rgba(255,255,255,0.92)" font-size="44" font-family="Manrope, Segoe UI, sans-serif" font-weight="500">${escapeSvgText(line)}</text>`)
    .join('\n');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#164f84" />
          <stop offset="52%" stop-color="#1d7d9a" />
          <stop offset="100%" stop-color="#2d9b8f" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1600" fill="url(#bg)" />
      <circle cx="1020" cy="210" r="240" fill="rgba(255,255,255,0.1)" />
      <text x="96" y="136" fill="#ffffff" font-size="42" font-family="Manrope, Segoe UI, sans-serif" font-weight="700">${escapeSvgText(String(category || '').toUpperCase())}</text>
      <text x="96" y="300" fill="#ffffff" font-size="140" font-family="Manrope, Segoe UI, sans-serif" font-weight="700">${glyph}</text>
      <text x="96" y="370" fill="#ffffff" font-size="72" font-family="Manrope, Segoe UI, sans-serif" font-weight="700">${escapeSvgText(title)}</text>
      ${bodyText}
      <rect x="96" y="1448" width="1008" height="2" fill="rgba(255,255,255,0.9)" />
      <text x="96" y="1524" fill="rgba(255,255,255,0.92)" font-size="36" font-family="Manrope, Segoe UI, sans-serif" font-weight="600">Shared from Learnda</text>
    </svg>
  `;
};

/**
 * Fetch rows from all_content view, joining ContentStats.
 * Returns plain objects with a `type` field normalized for API consumers.
 */
async function queryAllContent({ extraWhere = '', replacements = {}, limit = 20, offset = 0, orderBy = 'ac.created_at DESC' } = {}) {
  const { sequelize } = db;
  const sql = `
    SELECT ac.*,
           cs.total_views, cs.like_count, cs.save_count, cs.share_count,
           cs.total_completions, cs.avg_time_spent, cs.unique_viewers, cs.last_updated AS stats_last_updated
    FROM all_content ac
    LEFT JOIN content_stats cs ON cs.content_id = ac.id
    WHERE ac.status = 'published'
    ${extraWhere}
    ORDER BY ${orderBy}
    LIMIT :_limit OFFSET :_offset
  `;
  const rows = await sequelize.query(sql, {
    replacements: { ...replacements, _limit: limit, _offset: offset },
    type: sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    ...normalizeRow(row),
    stats: {
      total_views: row.total_views || 0,
      like_count: row.like_count || 0,
      save_count: row.save_count || 0,
      share_count: row.share_count || 0,
      total_completions: row.total_completions || 0,
      avg_time_spent: row.avg_time_spent || 0,
      unique_viewers: row.unique_viewers || 0,
    },
    view_count: row.total_views || 0,
  }));
}

async function countAllContent({ extraWhere = '', replacements = {} } = {}) {
  const { sequelize } = db;
  const [{ total }] = await sequelize.query(
    `SELECT COUNT(*)::int AS total FROM all_content ac WHERE ac.status = 'published' ${extraWhere}`,
    { replacements, type: sequelize.QueryTypes.SELECT }
  );
  return total || 0;
}

module.exports = {
  async list(req, res) {
    const { type, tone, course, level, q, search, tags, page = 1, limit = 20, include_misc } = req.query;
    const includeMisc = String(include_misc || 'false').toLowerCase() === 'true';

    const conditions = [];
    const replacements = {};

    // type filter — maps legacy type → content_type or subtype
    if (type) {
      if (type === 'text_lesson') {
        conditions.push(`ac.content_type = 'lesson'`);
      } else if (type === 'video') {
        conditions.push(`ac.content_type = 'video_lesson'`);
      } else if (['edutainment','quote','blog','quiz','past_question','illustration','site_info','team_profile'].includes(type)) {
        conditions.push(`ac.content_type = 'text_item' AND ac.subtype = :filterType`);
        replacements.filterType = type;
      }
    }

    if (level) {
      if (['basic', 'enhanced', 'advanced'].includes(level)) {
        conditions.push(`ac.depth_level = :level`);
        replacements.level = level;
      } else {
        conditions.push(`ac.level = :level`);
        replacements.level = level;
      }
    }

    if (course) {
      conditions.push(`(
        ac.course_id::text = :course
        OR ac.metadata->>'course_id' = :course
        OR ac.metadata->>'course' ILIKE :courseText
        OR ac.metadata->>'course_title' ILIKE :courseText
        OR ac.metadata->>'course_code' ILIKE :courseText
      )`);
      replacements.course = course;
      replacements.courseText = `%${course}%`;
    }

    if (tags) {
      const tagList = Array.isArray(tags)
        ? tags
        : String(tags).split(',').map((tag) => tag.trim()).filter(Boolean);
      if (tagList.length) {
        conditions.push(`ac.tags::text[] && ARRAY[:...tagList]::text[]`);
        replacements.tagList = tagList;
      }
    }

    const queryStr = q || search;
    if (queryStr) {
      conditions.push(`(ac.title ILIKE :searchQuery OR ac.description ILIKE :searchQuery)`);
      replacements.searchQuery = `%${queryStr}%`;
    }

    if (tone) {
      const normalizedTone = String(tone).trim().toLowerCase();
      const toneToCategory = { article: 'articles', story: 'stories', fact: 'facts', quote: 'quotes', joke: 'jocular' };
      const expectedCategory = toneToCategory[normalizedTone];
      if (expectedCategory) {
        conditions.push(`ac.category = :toneCategory`);
        replacements.toneCategory = expectedCategory;
      }
    }

    if (!includeMisc) {
      conditions.push(`(ac.subtype IS NULL OR ac.subtype NOT IN ('site_info','team_profile'))`);
      conditions.push(`NOT (ac.content_type = 'lesson' AND ac.tags::text[] && ARRAY['about','team','profile','contributors','donators']::text[])`);
    }

    const extraWhere = conditions.length ? 'AND ' + conditions.join(' AND ') : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [content, total] = await Promise.all([
      queryAllContent({ extraWhere, replacements, limit: Number(limit), offset }),
      countAllContent({ extraWhere, replacements }),
    ]);

    res.json({ success: true, content, total, page: Number(page) });
  },

  async featured(req, res) {
    const includeMisc = String(req.query?.include_misc || 'false').toLowerCase() === 'true';
    const extraCondition = buildLearningFeedWhere(includeMisc);
    const extraWhere = extraCondition ? extraCondition : '';
    const rows = await queryAllContent({ extraWhere, limit: 8 });
    res.json({ success: true, content: rows });
  },

  async trending(req, res) {
    const includeMisc = String(req.query?.include_misc || 'false').toLowerCase() === 'true';
    const extraCondition = buildLearningFeedWhere(includeMisc);
    const extraWhere = extraCondition ? extraCondition : '';
    // MVP: latest; later: order by engagement aggregation
    const rows = await queryAllContent({ extraWhere, limit: 10 });
    res.json({ success: true, content: rows });
  },

  async search(req, res) {
    const { q = '' } = req.query;
    req.query.q = q;
    return module.exports.list(req, res);
  },

  async personalized(req, res) {
    const includeMisc = String(req.query?.include_misc || 'false').toLowerCase() === 'true';
    const extraCondition = buildLearningFeedWhere(includeMisc);
    const extraWhere = extraCondition ? extraCondition : '';
    // MVP: latest; later: use progress + tags + institution
    const rows = await queryAllContent({ extraWhere, limit: 12 });
    res.json({ success: true, content: rows });
  },

  async previewEdutainmentParser(req, res) {
    const warningLimitRaw = Number(req.query?.warning_limit);
    const warningLimit = Number.isFinite(warningLimitRaw) && warningLimitRaw > 0
      ? Math.min(500, Math.floor(warningLimitRaw))
      : 200;

    const payload = buildCanonicalPayload();
    const categoryDiagnostics = payload?.diagnostics?.byCategory || {};
    const dedupeWarnings = Array.isArray(payload?.diagnostics?.dedupeWarnings)
      ? payload.diagnostics.dedupeWarnings
      : [];

    const categories = Object.entries(categoryDiagnostics).map(([key, value]) => ({
      category: key,
      source_file: value.sourceFile,
      total_blocks: value.totalBlocks || 0,
      parsed_items: value.parsedItems || 0,
      skipped_count: Array.isArray(value.skipped) ? value.skipped.length : 0,
      warning_count: Array.isArray(value.warnings) ? value.warnings.length : 0
    }));

    const warnings = [];
    Object.values(categoryDiagnostics).forEach((diag) => {
      (diag.warnings || []).forEach((entry) => {
        warnings.push({
          category: diag.category,
          source_file: diag.sourceFile,
          ...entry
        });
      });
      (diag.skipped || []).forEach((entry) => {
        warnings.push({
          category: diag.category,
          source_file: diag.sourceFile,
          severity: 'skipped',
          ...entry
        });
      });
    });
    dedupeWarnings.forEach((entry) => {
      warnings.push({
        category: 'global',
        source_file: entry.sourcePath,
        severity: 'skipped',
        ...entry
      });
    });

    res.json({
      success: true,
      preview: {
        generated_at: payload.generatedAt,
        schema_version: payload.schemaVersion,
        totals: payload.totals,
        category_diagnostics: categories
      },
      warnings: warnings.slice(0, warningLimit),
      warning_total: warnings.length,
      warning_limit: warningLimit,
      note: 'Preview only. No file was written and no seed action was performed.'
    });
  },

  async getById(req, res) {
    const row = await findById(db, req.params.id);
    if (!row || row.status !== 'published') return res.status(404).json({ success: false, error: 'Content not found' });

    if (row.is_premium && !hasPremiumAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Premium plan required' });
    }

    // Fetch stats and creator in parallel
    const [statsRow, creatorRow] = await Promise.all([
      ContentStats.findOne({ where: { content_id: row.id } }),
      row.creator_id ? User.findByPk(row.creator_id, { attributes: ['id', 'full_name', 'avatar_url'] }) : null,
    ]);

    const userInteractions = await getUserInteractions(req.user?.id, row.id);
    const payload = normalizeRow(row);

    // If the all_content view doesn't expose lesson_document/metadata, fetch directly from Lesson model
    if (row.content_type === 'lesson' && !payload.lesson_document && !payload.metadata?.lesson_document) {
      const fullLesson = await db.Lesson.findByPk(row.id, { raw: true });
      if (fullLesson) {
        if (fullLesson.lesson_document) payload.lesson_document = fullLesson.lesson_document;
        if (fullLesson.exercises) payload.exercises = fullLesson.exercises;
        if (fullLesson.final_assessment) payload.final_assessment = fullLesson.final_assessment;
        if (fullLesson.objectives) payload.objectives = fullLesson.objectives;
        if (fullLesson.metadata && Object.keys(fullLesson.metadata).length > 0) {
          payload.metadata = { ...fullLesson.metadata, ...(payload.metadata || {}) };
        }
      }
    }

    let contentBody = payload.body || payload.metadata?.body || payload.metadata?.content || payload.description || '';
    const lessonDocument = payload.lesson_document || payload.metadata?.lesson_document || payload.metadata?.lesson_payload || null;
    if (lessonDocument && typeof lessonDocument === 'object') {
      const lessonChunks = Array.isArray(lessonDocument?.chunks)
        ? lessonDocument.chunks
        : Object.values(lessonDocument?.chunks || {});
      const chunkHtml = lessonChunks
        .map((chunk) => {
          const heading = chunk?.chunk_head || chunk?.heading || chunk?.title || '';
          const rawParagraphs = Array.isArray(chunk?.paragraphs)
            ? chunk.paragraphs
            : Object.values(chunk?.chunk_content || {});
          const paragraphs = rawParagraphs
            .map((paragraph) => {
              if (typeof paragraph === 'string') return paragraph;
              return paragraph?.body_html || paragraph?.html || paragraph?.content || paragraph?.text || '';
            })
            .filter(Boolean)
            .join('');
          return `${heading ? `<h2>${heading}</h2>` : ''}${paragraphs}`;
        })
        .join('');

      if (chunkHtml) {
        contentBody = chunkHtml;
      }
    }
    if (!contentBody && Array.isArray(payload.metadata?.paragraphs) && payload.metadata.paragraphs.length) {
      contentBody = payload.metadata.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
    }

    payload.stats = statsRow || null;
    payload.creator = creatorRow ? creatorRow.toJSON() : null;
    payload.creator_name = creatorRow?.full_name || null;
    payload.author_name = creatorRow?.full_name || null;
    payload.author_avatar = creatorRow?.avatar_url || null;
    payload.read_time = payload.metadata?.read_time || payload.metadata?.reading_time || null;
    payload.featured_image = payload.metadata?.featured_image || payload.thumbnail_url || null;
    payload.category = payload.category || payload.metadata?.category || null;
    payload.view_count = statsRow?.total_views || 0;
    payload.course = payload.metadata?.course || null;
    payload.level = payload.level || payload.metadata?.level || null;
    payload.content = ['blog', 'blog_post', 'text_lesson', 'site_info', 'team_profile', 'quote'].includes(payload.type)
      ? contentBody
      : payload.content;
    payload.user_interactions = userInteractions;
    payload.user_engagement = {
      progress_percentage: userInteractions.progress,
      completed: userInteractions.completed,
      duration_seconds: userInteractions.durationSeconds,
      last_action: userInteractions.lastAction,
      last_viewed_at: userInteractions.lastViewedAt,
      completed_at: userInteractions.completedAt,
      metadata: userInteractions.metadata || {},
      lesson_state: userInteractions.lessonState || null,
      completion_summary: userInteractions.completionSummary || null,
      final_assessment: userInteractions.finalAssessment || null,
    };

    res.json({ success: true, content: payload });
  },

  async create(req, res) {
    const payload = req.body || {};
    const contentType = payload.type || 'text_lesson';
    const status = ['draft', 'published', 'pending', 'rejected'].includes(payload.status)
      ? payload.status
      : 'published';
    const publishedAt = status === 'published' ? new Date() : null;

    // Determine which model to use based on legacy type
    let created;
    if (contentType === 'text_lesson' || contentType === 'lesson') {
      created = await db.Lesson.create({
        title: payload.title,
        description: payload.description || null,
        depth_level: payload.level || null,
        is_premium: !!payload.is_premium,
        creator_id: req.user.id,
        status,
        thumbnail_url: payload.thumbnail_url || null,
        tags: payload.tags || [],
        metadata: {
          ...(payload.metadata || {}),
          course: payload.course || payload.metadata?.course || null,
          body: payload.body || payload.metadata?.body || null
        },
        published_at: publishedAt
      });
    } else if (contentType === 'video') {
      created = await db.VideoLesson.create({
        title: payload.title,
        description: payload.description || null,
        depth_level: payload.level || null,
        is_premium: !!payload.is_premium,
        creator_id: req.user.id,
        status,
        file_url: payload.file_url || payload.media_url || null,
        tags: payload.tags || [],
        metadata: payload.metadata || {},
        published_at: publishedAt
      });
    } else {
      // text_item for edutainment, quote, blog, quiz, past_question etc.
      created = await db.TextItem.create({
        subtype: contentType,
        title: payload.title,
        description: payload.description || null,
        body: payload.body || payload.metadata?.body || null,
        depth_level: payload.level || null,
        is_premium: !!payload.is_premium,
        creator_id: req.user.id,
        status,
        tags: payload.tags || [],
        category: payload.category || payload.metadata?.category || null,
        questions: payload.questions || payload.metadata?.questions || [],
        sections: payload.sections || payload.metadata?.sections || {},
        metadata: {
          ...(payload.metadata || {}),
          questions: payload.questions || payload.metadata?.questions || [],
          sections: payload.sections || payload.metadata?.sections || {},
        },
        published_at: publishedAt
      });
    }

    res.status(201).json({ success: true, content: created });
  },

  async update(req, res) {
    const item = await findModelInstance(db, req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Content not found' });

    if (item.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const payload = req.body || {};
    const patch = {
      title: payload.title ?? item.title,
      description: payload.description ?? item.description,
      depth_level: payload.level ?? item.depth_level,
      is_premium: payload.is_premium ?? item.is_premium,
      thumbnail_url: payload.thumbnail_url ?? item.thumbnail_url,
      file_url: (payload.file_url ?? payload.media_url) ?? item.file_url,
      tags: payload.tags ?? item.tags,
      metadata: payload.metadata ? { ...(item.metadata || {}), ...payload.metadata } : item.metadata
    };

    if (Object.prototype.hasOwnProperty.call(item, 'body') || item.constructor?.name === 'TextItem') {
      patch.body = payload.body ?? item.body;
    }
    if (Object.prototype.hasOwnProperty.call(item, 'category') || item.constructor?.name === 'TextItem') {
      patch.category = payload.category ?? payload.metadata?.category ?? item.category;
    }
    if (item.constructor?.name === 'TextItem') {
      patch.questions = payload.questions ?? payload.metadata?.questions ?? item.questions;
      patch.sections = payload.sections ?? payload.metadata?.sections ?? item.sections;
      if (payload.questions || payload.sections) {
        patch.metadata = {
          ...(patch.metadata || {}),
          ...(payload.questions ? { questions: payload.questions } : {}),
          ...(payload.sections ? { sections: payload.sections } : {}),
        };
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
      patch.status = payload.status;
      if (payload.status === 'published' && !item.published_at) {
        patch.published_at = new Date();
      }
    }

    await item.update(patch);

    res.json({ success: true, content: item });
  },

  async remove(req, res) {
    const item = await findModelInstance(db, req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Content not found' });

    if (item.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await item.destroy();
    res.json({ success: true });
  },

  async myContent(req, res) {
    const { sequelize } = db;
    const rows = await sequelize.query(
      `SELECT * FROM all_content WHERE creator_id = :creatorId ORDER BY created_at DESC`,
      { replacements: { creatorId: req.user.id }, type: sequelize.QueryTypes.SELECT }
    );
    res.json({ success: true, content: rows.map(normalizeRow) });
  },

  async upload(req, res) {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const fileUrl = getFileUrl(req.file);
    res.json({
      success: true,
      file_url: fileUrl,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size
    });
  },

  async like(req, res) {
    const existing = await ContentEngagement.findOne({
      where: {
        content_id: req.params.id,
        user_id: req.user.id,
        [Op.or]: [{ type: 'like' }, { action: 'like' }],
      },
    });

    if (existing) {
      await existing.destroy();
      const stats = await ensureStats(req.params.id);
      stats.like_count = Math.max((stats.like_count || 0) - 1, 0);
      stats.last_updated = new Date();
      await stats.save();
      return res.json({ success: true, liked: false });
    }

    await ContentEngagement.create({
      content_id: req.params.id,
      user_id: req.user.id,
      type: 'like',
      action: 'like',
    });
    const stats = await ensureStats(req.params.id);
    stats.like_count = (stats.like_count || 0) + 1;
    stats.last_updated = new Date();
    await stats.save();
    res.json({ success: true, liked: true });
  },

  async share(req, res) {
    await ContentEngagement.create({
      content_id: req.params.id,
      user_id: req.user.id,
      type: 'view',
      action: 'share',
      metadata: {
        source: req.body?.source || 'home_modal'
      }
    });

    const stats = await ensureStats(req.params.id);
    stats.share_count = (stats.share_count || 0) + 1;
    stats.last_updated = new Date();
    await stats.save();

    res.json({ success: true, shared: true, share_count: stats.share_count });
  },

  async save(req, res) {
    const existing = await ContentEngagement.findOne({
      where: {
        content_id: req.params.id,
        user_id: req.user.id,
        [Op.or]: [{ type: 'bookmark' }, { action: 'save' }, { action: 'bookmark' }],
      },
    });

    if (existing) {
      await existing.destroy();
      const stats = await ensureStats(req.params.id);
      stats.save_count = Math.max((stats.save_count || 0) - 1, 0);
      stats.last_updated = new Date();
      await stats.save();
      return res.json({ success: true, saved: false });
    }

    await ContentEngagement.create({
      content_id: req.params.id,
      user_id: req.user.id,
      type: 'bookmark',
      action: 'save',
    });
    const stats = await ensureStats(req.params.id);
    stats.save_count = (stats.save_count || 0) + 1;
    stats.last_updated = new Date();
    await stats.save();
    res.json({ success: true, saved: true });
  },

  async complete(req, res) {
    const duration = Number(req.body?.duration || 0);
    const requestedMetadata = req.body?.metadata && typeof req.body.metadata === 'object'
      ? req.body.metadata
      : {};

    await ContentEngagement.create({
      content_id: req.params.id,
      user_id: req.user.id,
      type: 'view',
      action: 'complete',
      duration_seconds: duration,
      progress_percentage: 100,
      metadata: {
        ...requestedMetadata,
        duration,
        completed: true,
        progress_percentage: 100,
      }
    });

    const stats = await ensureStats(req.params.id);
    stats.total_completions = (stats.total_completions || 0) + 1;
    if (duration) {
      const totalTime = (stats.avg_time_spent || 0) * (stats.total_completions - 1) + duration;
      stats.avg_time_spent = Math.round(totalTime / stats.total_completions);
    }
    stats.last_updated = new Date();
    await stats.save();

    try {
      const gamificationService = require('../services/gamificationService');
      await gamificationService.updateStreak(req.user.id);
    } catch (_streakErr) {
      // Streak is best-effort; completion should still succeed.
    }

    const contentRow = await findById(db, req.params.id);
    const normalizedContentRow = contentRow ? normalizeRow(contentRow) : null;
    if (normalizedContentRow && (normalizedContentRow.type === 'quiz' || normalizedContentRow.type === 'past_question')) {
      try {
        const contentService = require('../services/contentService');
        const gamificationService = require('../services/gamificationService');
        await contentService.awardCompletionXP(req.user.id, req.params.id);
        await gamificationService.checkAndAwardBadges(req.user.id, 'practice_complete', {});
      } catch (_quizGamErr) {
        // XP / badges are best-effort; completion is already recorded.
      }
    }

    res.json({ success: true });
  },

  async getComments(req, res) {
    const rows = await Comment.findAll({
      where: { content_id: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'avatar_url'] }],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    const comments = rows.map((comment) => ({
      id: comment.id,
      content: comment.body,
      author_id: comment.user_id,
      author_name: comment.user?.full_name || 'Learnda Student',
      author_avatar: comment.user?.avatar_url || null,
      created_at: comment.created_at,
      likes: comment.likes || 0
    }));

    res.json({ success: true, comments });
  },

  async addComment(req, res) {
    const body = (req.body?.body || req.body?.content || '').trim();
    if (!body) return res.status(400).json({ success: false, error: 'Comment body required' });
    const comment = await Comment.create({ content_id: req.params.id, user_id: req.user.id, body });
    const user = await User.findByPk(req.user.id);
    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.body,
        author_id: comment.user_id,
        author_name: user?.full_name || 'Learnda Student',
        author_avatar: user?.avatar_url || null,
        created_at: comment.created_at,
        likes: comment.likes || 0
      }
    });
  },

  async shareCard(req, res) {
    try {
      const row = await findById(db, req.params.id);
      if (!row || row.status !== 'published') {
        return res.status(404).json({ success: false, error: 'Content not found' });
      }
      const creatorRow = row.creator_id
        ? await User.findByPk(row.creator_id, { attributes: ['id', 'full_name', 'avatar_url'] })
        : null;

      const payload = { ...normalizeRow(row), creator: creatorRow ? creatorRow.toJSON() : null };
      const key = normalizeShareKey(payload);
      const title = payload.title || 'Learnda content';
      const category = payload.metadata?.category || payload.category || payload.type || 'content';
      const body = pickBody(payload);
      const author = pickAuthor(payload);

      const svg = key === 'quote'
        ? buildQuoteShareCardSvg({ quote: body, author })
        : buildGenericShareCardSvg({ title, category, body, key });

      const fileSafeTitle = String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'learnda-content';

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `inline; filename="${fileSafeTitle}.svg"`);
      return res.send(svg);
    } catch (error) {
      console.error('Generate share card error:', error);
      return res.status(500).json({ success: false, error: 'Failed to generate share card' });
    }
  },

  async interactions(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const interactions = await getUserInteractions(userId, req.params.id);
      res.json({ success: true, ...interactions });
    } catch (error) {
      console.error('Get interactions error:', error);
      res.status(500).json({ success: false, error: 'Failed to load interactions' });
    }
  },

  async trackView(req, res) {
    try {
      const contentId = req.params.id;
      const userId = req.user?.id || null;
      const duration = Number(req.body?.duration || 0);
      const progress = Number(req.body?.progress || req.body?.progress_percentage || 0);
      const requestedMetadata =
        req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
      const isLessonProgressHeartbeat = Boolean(
        requestedMetadata.lesson_state || requestedMetadata.lesson_progress === true
      );

      if (isLessonProgressHeartbeat && !userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const stats = await ensureStats(contentId);

      if (isLessonProgressHeartbeat) {
        await ContentEngagement.create({
          content_id: contentId,
          user_id: userId,
          type: 'view',
          action: 'view',
          duration_seconds: duration,
          progress_percentage: progress || null,
          metadata: {
            ...requestedMetadata,
            lesson_progress: true,
            duration,
            progress_percentage: progress,
          },
        });
        stats.last_updated = new Date();
        await stats.save();
        return res.json({ success: true });
      }

      if (!userId) {
        stats.total_views = (stats.total_views || 0) + 1;
        stats.last_updated = new Date();
        await stats.save();
        return res.json({ success: true });
      }

      const hadPriorImpression = await ContentEngagement.findOne({
        where: {
          [Op.and]: [
            { content_id: contentId },
            { user_id: userId },
            { action: 'view' },
            Sequelize.literal(
              `NOT (COALESCE(metadata, '{}'::jsonb) @> '{"lesson_progress":true}'::jsonb)`
            ),
          ],
        },
      });

      await ContentEngagement.create({
        content_id: contentId,
        user_id: userId,
        type: 'view',
        action: 'view',
        duration_seconds: duration,
        progress_percentage: progress || null,
        metadata: {
          ...requestedMetadata,
          duration,
          progress_percentage: progress,
        },
      });

      stats.total_views = (stats.total_views || 0) + 1;
      if (!hadPriorImpression) {
        stats.unique_viewers = (stats.unique_viewers || 0) + 1;
      }
      stats.last_updated = new Date();
      await stats.save();

      res.json({ success: true });
    } catch (error) {
      console.error('Track view error:', error);
      res.status(500).json({ success: false, error: 'Failed to track view' });
    }
  },

  async getStats(req, res) {
    try {
      const stats = await ensureStats(req.params.id);
      res.json({ success: true, stats });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ success: false, error: 'Failed to load stats' });
    }
  },

  async favorites(req, res) {
    if (!req.user) {
      return res.json({ success: true, content: [] });
    }

    const engagements = await ContentEngagement.findAll({
      where: {
        user_id: req.user.id,
        [Op.or]: [
          { type: 'bookmark' },
          { action: 'save' },
          { action: 'bookmark' },
        ],
      },
      order: [['created_at', 'DESC']],
    });

    const seen = new Set();
    const uniqueEngagements = engagements.filter((item) => {
      if (!item.content_id || seen.has(item.content_id)) return false;
      seen.add(item.content_id);
      return true;
    });

    const { sequelize } = db;
    const contentIds = uniqueEngagements.map((e) => e.content_id).filter(Boolean);
    const savedAtMap = new Map(uniqueEngagements.map((e) => [e.content_id, e.created_at]));

    let contentRows = [];
    if (contentIds.length) {
      contentRows = await sequelize.query(
        `SELECT ac.*, cs.total_views, cs.like_count, cs.save_count, cs.share_count, cs.total_completions, cs.avg_time_spent
         FROM all_content ac
         LEFT JOIN content_stats cs ON cs.content_id = ac.id
         WHERE ac.id IN (:ids)`,
        { replacements: { ids: contentIds }, type: sequelize.QueryTypes.SELECT }
      );
    }

    const favorites = contentRows.map((row) => ({
      ...normalizeRow(row),
      stats: {
        total_views: row.total_views || 0,
        like_count: row.like_count || 0,
        save_count: row.save_count || 0,
        share_count: row.share_count || 0,
        total_completions: row.total_completions || 0,
        avg_time_spent: row.avg_time_spent || 0,
      },
      is_saved: true,
      saved_at: savedAtMap.get(row.id) || null,
    }));

    res.json({ success: true, content: favorites });
  },

  async react(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const emoji = String(req.body?.emoji || '').trim();
      if (!emoji || !SUPPORTED_REACTION_EMOJIS.includes(emoji)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported reaction',
          supported: SUPPORTED_REACTION_EMOJIS,
        });
      }

      const reactionWhere = {
        content_id: req.params.id,
        user_id: userId,
        action: 'rate',
        [Op.or]: [
          Sequelize.where(Sequelize.cast(Sequelize.col('metadata'), 'jsonb'), '@>', JSON.stringify({ kind: 'reaction' })),
          Sequelize.where(Sequelize.cast(Sequelize.col('metadata'), 'jsonb'), '@>', JSON.stringify({ reaction: true })),
        ],
      };

      const existing = await ContentEngagement.findOne({
        where: {
          ...reactionWhere,
          [Op.and]: [
            Sequelize.where(Sequelize.cast(Sequelize.col('metadata'), 'jsonb'), '@>', JSON.stringify({ emoji })),
          ],
        },
      });

      await ContentEngagement.destroy({ where: reactionWhere });

      if (!existing) {
        await ContentEngagement.create({
          content_id: req.params.id,
          user_id: userId,
          action: 'rate',
          metadata: { kind: 'reaction', emoji, reaction: true },
        });
      }

      const aggregate = await getReactionAggregate(req.params.id, userId);
      res.json({ success: true, ...aggregate });
    } catch (error) {
      console.error('React content error:', error);
      res.status(500).json({ success: false, error: 'Failed to react' });
    }
  },
};

