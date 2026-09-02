/**
 * Seeds Eduvhibe videos (Content rows) for second-semester courses using YouTube Data API v3 search.
 *
 * Requires: YOUTUBE_API_KEY in env (Google Cloud → YouTube Data API v3 enabled).
 * Quota: each search.list call costs 100 units (default daily quota 10,000). Use --limit and --start.
 * Picks among several high-view results using tutorial/educational heuristics (not only the first hit).
 * Display title: "{Course name} · Level {level}". DB description is empty. A second API search runs only if the first pick scores below zero (extra 100 quota units).
 *
 * Usage:
 *   node src/scripts/seed_eduvhibe_second_sem_youtube.js --search-links-only
 *   node src/scripts/seed_eduvhibe_second_sem_youtube.js --dry-run
 *   node src/scripts/seed_eduvhibe_second_sem_youtube.js --limit 40 --start 0
 *
 * npm: npm run seed:eduvhibe-second-sem-youtube -- --limit 25
 */
const fs = require('fs');
const https = require('https');
const path = require('path');
const { URLSearchParams } = require('url');

const CSV_PATH = path.join(__dirname, '../../data/second_sem_course_source_list.csv');
const SEARCH_LINKS_OUT = path.join(__dirname, '../../data/second_sem_youtube_search_links.json');

function parseArgs(argv) {
  const out = { dryRun: false, searchLinksOnly: false, limit: 40, start: 0, sleepMs: 400 };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--search-links-only') out.searchLinksOnly = true;
    const m = /^--limit=(\d+)$/.exec(a);
    if (m) out.limit = Number(m[1], 10);
    const s = /^--start=(\d+)$/.exec(a);
    if (s) out.start = Number(s[1], 10);
    const sl = /^--sleep-ms=(\d+)$/.exec(a);
    if (sl) out.sleepMs = Number(sl[1], 10);
  }
  return out;
}

/** Minimal RFC4180-style CSV parser (handles quoted fields). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
  }
  return rows;
}

function loadCoursesFromCsv() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Missing ${CSV_PATH}. Run: npm run data:second-sem-sources`);
  }
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const table = parseCsv(raw);
  if (table.length < 2) throw new Error('CSV has no data rows');
  const header = table[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const ig = idx('group');
  const il = idx('level');
  const ic = idx('course_code');
  const iname = idx('course_name');
  if (ig < 0 || il < 0 || ic < 0 || iname < 0) {
    throw new Error('CSV missing required columns');
  }
  return table.slice(1).map((cells) => ({
    group: cells[ig]?.trim(),
    level: cells[il]?.trim(),
    course_code: cells[ic]?.trim(),
    course_name: cells[iname]?.trim()
  }));
}

function buildSearchQuery(course) {
  const name = course.course_name || '';
  return `${name} tutorial lesson explained teacher education B.Ed`.slice(0, 240);
}

function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Invalid JSON from YouTube API (${res.statusCode})`));
          }
        });
      })
      .on('error', reject);
  });
}

/** Prefer tutorials / lessons; penalise obvious off-topic patterns. */
function scoreTutorialSnippet(sn) {
  const title = String(sn?.title || '').toLowerCase();
  const desc = String(sn?.description || '')
    .toLowerCase()
    .slice(0, 500);
  const channel = String(sn?.channelTitle || '').toLowerCase();
  let score = 0;

  const goodTitle = [
    'tutorial',
    'lesson',
    'lecture',
    'explained',
    'introduction',
    'overview',
    'crash course',
    'revision',
    'basics',
    'step by step',
    'guide',
    'course',
    'class ',
    'chapter',
    'what is',
    'how to',
    'for beginners'
  ];
  for (const w of goodTitle) {
    if (title.includes(w)) score += 4;
    else if (desc.includes(w)) score += 1;
  }

  const goodChannel = [
    'khan',
    'crash course',
    'ted-ed',
    'mit ',
    'coursera',
    'edx',
    'freecodecamp',
    'professor dave',
    'organic chemistry tutor',
    'simplilearn',
    'study',
    'academy',
    'education',
    'teacher',
    'lecture',
    'university'
  ];
  for (const w of goodChannel) {
    if (channel.includes(w)) score += 3;
  }

  const bad = [
    'reaction',
    'trailer',
    'gameplay',
    ' vlog',
    'prank',
    'compilation',
    'highlights',
    'music video',
    'full movie',
    'official video',
    'live stream',
    'asmr',
    'podcast full episode'
  ];
  for (const w of bad) {
    if (title.includes(w)) score -= 12;
  }

  return score;
}

function pickBestCandidate(items) {
  if (!items?.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const sn = item.snippet;
    if (!item?.id?.videoId || !sn) continue;
    const s = scoreTutorialSnippet(sn);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return best;
}

async function youtubeSearchList(apiKey, query, options) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(options.maxResults || 12),
    order: options.order || 'viewCount',
    safeSearch: 'strict',
    q: query,
    key: apiKey,
    videoEmbeddable: 'true',
    videoSyndicated: 'true'
  });
  if (options.videoDuration) params.set('videoDuration', options.videoDuration);

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const data = await httpGetJson(url);
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.items || [];
}

/**
 * Fetch several candidates (sorted by view count), score for tutorial fit, return best watch URL + snippet.
 */
async function youtubeSearchBestTutorial(apiKey, course) {
  const primary = buildSearchQuery(course);
  const alt = `${course.course_name} education lecture tutorial`.slice(0, 240);

  let items = await youtubeSearchList(apiKey, primary, {
    maxResults: 15,
    order: 'viewCount',
    videoDuration: 'medium'
  });
  if (!items.length) {
    items = await youtubeSearchList(apiKey, primary, {
      maxResults: 15,
      order: 'viewCount'
    });
  }

  let best = pickBestCandidate(items);
  if (!best && items.length) best = items[0];

  let score = best ? scoreTutorialSnippet(best.snippet) : -999;
  if (score < 0) {
    const altItems = await youtubeSearchList(apiKey, alt, {
      maxResults: 10,
      order: 'relevance',
      videoDuration: 'medium'
    });
    let altBest = pickBestCandidate(altItems);
    if (!altBest && altItems.length) altBest = altItems[0];
    const altScore = altBest ? scoreTutorialSnippet(altBest.snippet) : -999;
    if (altBest && altScore > score) {
      best = altBest;
      score = altScore;
    }
  }

  if (!best?.id?.videoId) return null;

  const vid = best.id.videoId;
  const sn = best.snippet || {};
  return {
    videoId: vid,
    watchUrl: `https://www.youtube.com/watch?v=${vid}`,
    youtubeTitle: sn.title || primary,
    channelTitle: sn.channelTitle || '',
    pickScore: scoreTutorialSnippet(sn)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.searchLinksOnly) {
    const courses = loadCoursesFromCsv();
    const links = courses.map((c) => ({
      course_code: c.course_code,
      course_name: c.course_name,
      level: c.level,
      group: c.group,
      youtube_search_url: youtubeSearchUrl(buildSearchQuery(c))
    }));
    fs.writeFileSync(SEARCH_LINKS_OUT, JSON.stringify(links, null, 2), 'utf8');
    console.log(`Wrote ${links.length} entries to ${SEARCH_LINKS_OUT}`);
    return;
  }

  require('../config/loadEnv').loadEnv();
  const { Op } = require('sequelize');
  const { Content, User, sequelize } = require('../models');

  const VIDEO_TAGS = ['eduvhibe', 'eduvhibe_video'];

  function displayTitle(course) {
    const t = `${course.course_name} · Level ${course.level}`;
    return t.length > 500 ? `${t.slice(0, 497)}...` : t;
  }

  function legacyTitlePrefix(course) {
    return `Sem 2 · L${course.level} ${course.group} ${course.course_code} —`;
  }

  async function findExistingSem2Video(course) {
    const metaMatch = {
      type: 'video',
      tags: { [Op.overlap]: VIDEO_TAGS },
      metadata: {
        [Op.contains]: {
          sem2_course_code: String(course.course_code),
          sem2_level: String(course.level),
          sem2_group: String(course.group)
        }
      }
    };
    let row = await Content.findOne({ where: metaMatch });
    if (row) return row;
    row = await Content.findOne({
      where: {
        type: 'video',
        tags: { [Op.overlap]: VIDEO_TAGS },
        title: { [Op.startsWith]: legacyTitlePrefix(course) }
      }
    });
    return row;
  }

  async function getSeedUser() {
    const existing = await User.findOne({
      where: { role: { [Op.in]: ['admin', 'contributor'] } },
      order: [['created_at', 'ASC']]
    });
    if (existing) return existing;
    return User.findOne({ order: [['created_at', 'ASC']] });
  }

  async function upsertVideo({ creatorId, course, result }) {
    const title = displayTitle(course);
    const description = '';

    const existing = await findExistingSem2Video(course);

    const payload = {
      title,
      description,
      type: 'video',
      creator_id: creatorId,
      status: 'published',
      tags: VIDEO_TAGS,
      file_url: result.watchUrl,
      published_at: new Date(),
      metadata: {
        video_url: result.watchUrl,
        level: course.level,
        section: 'eduvhibe',
        sem2_course_code: String(course.course_code),
        sem2_level: String(course.level),
        sem2_group: String(course.group),
        sem2_course_name: course.course_name,
        youtube_video_id: result.videoId,
        youtube_channel_title: result.channelTitle,
        youtube_pick_title: result.youtubeTitle,
        youtube_pick_score: result.pickScore,
        seeded_from: 'youtube_data_api_search_v2'
      }
    };

    if (existing) {
      await existing.update(payload);
      return { action: 'updated', id: existing.id };
    }
    const row = await Content.create(payload);
    return { action: 'created', id: row.id };
  }

  const courses = loadCoursesFromCsv();
  const slice = courses.slice(args.start, args.start + args.limit);

  if (args.dryRun) {
    console.log(`Dry run: would process ${slice.length} courses (start=${args.start} limit=${args.limit}).`);
    slice.slice(0, 8).forEach((c) => {
      console.log('-', c.course_code, buildSearchQuery(c));
    });
    await sequelize.close();
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error(
      'Missing YOUTUBE_API_KEY. Add it to .env (YouTube Data API v3). Or run with --search-links-only to export manual search URLs.'
    );
    process.exitCode = 1;
    await sequelize.close();
    return;
  }

  const seedUser = await getSeedUser();
  if (!seedUser) {
    throw new Error('No user found — create an admin or any user before seeding.');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const course of slice) {
    try {
      const result = await youtubeSearchBestTutorial(apiKey, course);
      if (!result) {
        console.warn('No video for', course.course_code, course.course_name);
        skipped += 1;
      } else {
        const { action } = await upsertVideo({ creatorId: seedUser.id, course, result });
        if (action === 'created') created += 1;
        else updated += 1;
        console.log(action, course.course_code, `score=${result.pickScore}`, result.watchUrl);
      }
    } catch (e) {
      console.error('Failed', course.course_code, e.message || e);
      skipped += 1;
    }
    await sleep(args.sleepMs);
  }

  console.log(JSON.stringify({ created, updated, skipped, processed: slice.length }, null, 2));
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    const { sequelize } = require('../models');
    await sequelize.close();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
