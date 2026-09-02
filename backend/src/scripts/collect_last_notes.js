/* Collects publicly accessible course documents from web search and public Telegram channels. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const courses = require('../data/lastNotesCourses');
const curatedSources = require('../data/lastNotesSources');

const ROOT = path.resolve(__dirname, '../../last-notes');
const USER_AGENT = 'SharetherCourseNotesCollector/1.0 (+educational-resource-indexer)';
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt']);
const MIME_EXTENSIONS = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.ms-powerpoint', '.ppt'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
  ['text/plain', '.txt']
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const envInt = (name, fallback) => Math.max(0, Number.parseInt(process.env[name] || fallback, 10));

function parseArgs(argv) {
  const args = { dryRun: false, code: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    if (arg.startsWith('--course=')) args.code = arg.slice(9).trim().toUpperCase();
  }
  return args;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function safeName(value, fallback = 'document') {
  // eslint-disable-next-line no-control-regex
  return String(value || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ').trim().slice(0, 150) || fallback;
}

function atomicJson(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

async function fetchWithRetry(url, options = {}) {
  const attempts = options.attempts || envInt('NOTES_SCRAPER_RETRIES', 3) || 1;
  const timeoutMs = options.timeoutMs || envInt('NOTES_SCRAPER_TIMEOUT_MS', 20000);
  const fetchOptions = { ...options };
  delete fetchOptions.attempts;
  delete fetchOptions.timeoutMs;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: 'follow', ...fetchOptions, signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...(fetchOptions.headers || {}) }
      });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) throw new Error(`HTTP ${response.status}`);
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    await sleep(Math.min(1000 * (2 ** (attempt - 1)), 8000));
  }
  throw lastError || new Error('Request failed');
}

function xmlItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const field = (name) => decodeEntities((match[1].match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i')) || [])[1]);
    return { title: field('title'), url: field('link'), description: field('description') };
  });
}

function duckDuckGoItems(html) {
  const items = [];
  const blocks = html.match(/<div class="result[\s\S]*?<div class="clear"><\/div>\s*<\/div>\s*<\/div>/gi) || [];
  for (const block of blocks) {
    const anchor = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    try {
      let url = decodeEntities(anchor[1]);
      if (url.startsWith('//')) url = `https:${url}`;
      const parsed = new URL(url, 'https://duckduckgo.com');
      if (parsed.hostname.endsWith('duckduckgo.com') && parsed.searchParams.get('uddg')) {
        url = parsed.searchParams.get('uddg');
      }
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
      const stripTags = (value) => decodeEntities(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      items.push({ url, title: stripTags(anchor[2]), description: stripTags(snippetMatch && snippetMatch[1]) });
    } catch (_) { /* Ignore malformed search results. */ }
  }
  return items;
}

function extractDocumentLinks(html, baseUrl) {
  const links = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(decodeEntities(match[1]), baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (DOCUMENT_EXTENSIONS.has(path.extname(url.pathname).toLowerCase())) links.push(url.href);
    } catch (_) { /* Ignore malformed page links. */ }
  }
  return [...new Set(links)];
}

function relevant(course, text) {
  const normalized = String(text || '').toLowerCase();
  if (normalized.includes(course.code.toLowerCase())) return true;
  const words = course.title.toLowerCase().match(/[a-z]{4,}/g) || [];
  return words.filter((word) => normalized.includes(word)).length >= Math.min(3, words.length);
}

async function discoverWeb(course) {
  const query = `"${course.code}" "${course.title}" (notes OR outline OR lecture) filetype:pdf`;
  const response = await fetchWithRetry(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
  const items = xmlItems(await response.text()).slice(0, envInt('NOTES_SCRAPER_SEARCH_RESULTS', 5));
  const discovered = [];
  for (const item of items) {
    if (!relevant(course, `${item.title} ${item.description} ${item.url}`)) continue;
    const ext = path.extname(new URL(item.url).pathname).toLowerCase();
    if (DOCUMENT_EXTENSIONS.has(ext)) {
      discovered.push({ url: item.url, pageUrl: item.url, title: item.title, source: 'web' });
      continue;
    }
    try {
      const page = await fetchWithRetry(item.url, {
        headers: { Accept: 'text/html' }, attempts: 1,
        timeoutMs: envInt('NOTES_SCRAPER_PAGE_TIMEOUT_MS', 10000)
      });
      const type = (page.headers.get('content-type') || '').toLowerCase();
      if (!type.includes('text/html')) continue;
      const html = await page.text();
      extractDocumentLinks(html, page.url).forEach((url) => discovered.push({
        url, pageUrl: item.url, title: item.title, source: 'web'
      }));
    } catch (_) { /* A failed result page must not stop the course run. */ }
    await sleep(envInt('NOTES_SCRAPER_DELAY_MS', 900));
  }
  return discovered;
}

async function discoverDuckDuckGo(course) {
  const queries = [
    `"${course.code}" "${course.title}"`,
    `"${course.title}" (lecture notes OR course outline OR course manual) pdf`,
    `"${course.title}" education Ghana filetype:pdf`
  ];
  const discovered = [];
  for (const query of queries.slice(0, envInt('NOTES_SCRAPER_QUERY_VARIANTS', 3))) {
    try {
      const response = await fetchWithRetry(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'text/html' }, attempts: 1, timeoutMs: envInt('NOTES_SCRAPER_TIMEOUT_MS', 20000) }
      );
      const items = duckDuckGoItems(await response.text())
        .slice(0, envInt('NOTES_SCRAPER_DDG_RESULTS', 10));
      for (const item of items) {
        if (!relevant(course, `${item.title} ${item.description} ${item.url}`)) continue;
        let ext;
        try { ext = path.extname(new URL(item.url).pathname).toLowerCase(); } catch (_) { continue; }
        if (DOCUMENT_EXTENSIONS.has(ext)) {
          discovered.push({ ...item, pageUrl: item.url, source: 'duckduckgo' });
          continue;
        }
        try {
          const page = await fetchWithRetry(item.url, {
            headers: { Accept: 'text/html' }, attempts: 1,
            timeoutMs: envInt('NOTES_SCRAPER_PAGE_TIMEOUT_MS', 10000)
          });
          if (!(page.headers.get('content-type') || '').toLowerCase().includes('text/html')) continue;
          extractDocumentLinks(await page.text(), page.url).forEach((url) => discovered.push({
            url, pageUrl: item.url, title: item.title, source: 'duckduckgo'
          }));
        } catch (_) { /* Continue through unavailable result pages. */ }
      }
    } catch (_) { /* Other queries and providers can still produce results. */ }
    await sleep(envInt('NOTES_SCRAPER_DELAY_MS', 900));
  }
  return discovered;
}

function discoverCurated(course) {
  return (curatedSources[course.code] || []).map((item) => ({
    ...item, pageUrl: item.url, source: `curated:${item.source}`
  }));
}

async function discoverTelegram(course, channels) {
  const discovered = [];
  try {
    const query = `site:t.me/s "${course.code}" "${course.title}" (notes OR outline OR lecture)`;
    const search = await fetchWithRetry(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
    const indexedPosts = xmlItems(await search.text()).slice(0, envInt('NOTES_SCRAPER_TELEGRAM_RESULTS', 5));
    for (const item of indexedPosts) {
      if (!/^https:\/\/t\.me\//i.test(item.url) || !relevant(course, `${item.title} ${item.description} ${item.url}`)) continue;
      try {
        const page = await fetchWithRetry(item.url, {
          headers: { Accept: 'text/html' }, attempts: 1,
          timeoutMs: envInt('NOTES_SCRAPER_PAGE_TIMEOUT_MS', 10000)
        });
        extractDocumentLinks(await page.text(), page.url).forEach((url) => discovered.push({
          url, pageUrl: item.url, title: item.title, source: 'telegram:public-index'
        }));
      } catch (_) { /* Continue through unavailable indexed posts. */ }
    }
  } catch (_) { /* Configured public channels can still be scanned below. */ }
  for (const channel of channels) {
    const clean = channel.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
    if (!clean) continue;
    const pageUrl = `https://t.me/s/${clean}?q=${encodeURIComponent(course.code)}`;
    try {
      const response = await fetchWithRetry(pageUrl, { headers: { Accept: 'text/html' } });
      const html = await response.text();
      extractDocumentLinks(html, response.url).forEach((url) => discovered.push({
        url, pageUrl, title: `${course.code} from @${clean}`, source: `telegram:@${clean}`
      }));
    } catch (_) { /* Logged by the caller when no usable documents are found. */ }
    await sleep(envInt('NOTES_SCRAPER_DELAY_MS', 900));
  }
  return discovered;
}

function extensionFor(url, contentType, buffer) {
  const urlExt = path.extname(new URL(url).pathname).toLowerCase();
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  const ext = DOCUMENT_EXTENSIONS.has(urlExt) ? urlExt : MIME_EXTENSIONS.get(mime);
  if (!ext) return null;
  if (ext === '.pdf' && buffer.subarray(0, 5).toString() !== '%PDF-') return null;
  if (['.docx', '.pptx'].includes(ext) && buffer.subarray(0, 2).toString() !== 'PK') return null;
  return ext;
}

async function readLimited(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes`);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes`);
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function download(candidate, course, state, dryRun) {
  if (state.urls[candidate.url]) return { status: 'skipped', reason: 'known_url' };
  if (dryRun) return { status: 'dry-run', candidate };
  const response = await fetchWithRetry(candidate.url);
  const length = Number(response.headers.get('content-length') || 0);
  const maxBytes = envInt('NOTES_SCRAPER_MAX_FILE_MB', 30) * 1024 * 1024;
  if (length > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes`);
  const buffer = await readLimited(response, maxBytes);
  if (buffer.length < 100 || buffer.length > maxBytes) throw new Error(`Invalid file size: ${buffer.length}`);
  const ext = extensionFor(response.url, response.headers.get('content-type'), buffer);
  if (!ext) throw new Error('Response is not an allowed document type');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  if (state.hashes[sha256]) {
    state.urls[candidate.url] = { sha256, duplicateOf: state.hashes[sha256], checkedAt: new Date().toISOString() };
    return { status: 'skipped', reason: 'duplicate_content' };
  }
  const courseDir = path.join(ROOT, course.code);
  fs.mkdirSync(courseDir, { recursive: true });
  const urlStem = path.basename(new URL(response.url).pathname, ext);
  const stem = safeName(urlStem || candidate.title || course.code);
  const filename = `${stem}-${sha256.slice(0, 10)}${ext}`;
  const relativePath = path.join(course.code, filename).replace(/\\/g, '/');
  fs.writeFileSync(path.join(ROOT, relativePath), buffer);
  const record = {
    courseCode: course.code, courseTitle: course.title, filename: relativePath,
    source: candidate.source, sourcePage: candidate.pageUrl, downloadUrl: candidate.url,
    finalUrl: response.url, bytes: buffer.length, sha256, downloadedAt: new Date().toISOString()
  };
  fs.appendFileSync(path.join(ROOT, 'manifest.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
  state.urls[candidate.url] = record;
  state.hashes[sha256] = relativePath;
  return { status: 'downloaded', record };
}

function acquireLock() {
  const lockPath = path.join(ROOT, '.collector.lock');
  try {
    const handle = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return () => { fs.closeSync(handle); try { fs.unlinkSync(lockPath); } catch (_) { /* Already cleared. */ } };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age > 12 * 60 * 60 * 1000) { fs.unlinkSync(lockPath); return acquireLock(); }
    throw new Error('Another notes collection run is active');
  }
}

async function run(options = {}) {
  fs.mkdirSync(ROOT, { recursive: true });
  const selected = options.code ? courses.filter((course) => course.code === options.code) : courses;
  if (!selected.length) throw new Error(`Unknown course code: ${options.code}`);
  const release = acquireLock();
  const statePath = path.join(ROOT, 'state.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { urls: {}, hashes: {} };
  const failures = [];
  const summary = { startedAt: new Date().toISOString(), downloaded: 0, skipped: 0, failed: 0, courses: 0 };
  const channels = (process.env.NOTES_TELEGRAM_CHANNELS || '').split(',').map((value) => value.trim()).filter(Boolean);
  try {
    for (const course of selected) {
      summary.courses += 1;
      try {
        const candidates = [
          ...discoverCurated(course),
          ...await discoverDuckDuckGo(course),
          ...await discoverWeb(course),
          ...await discoverTelegram(course, channels)
        ];
        const unique = [...new Map(candidates.map((item) => [item.url, item])).values()];
        let downloadedForCourse = 0;
        for (const candidate of unique) {
          if (downloadedForCourse >= envInt('NOTES_SCRAPER_MAX_PER_COURSE', 3)) break;
          try {
            const result = await download(candidate, course, state, options.dryRun);
            if (result.status === 'downloaded') { summary.downloaded += 1; downloadedForCourse += 1; }
            else summary.skipped += 1;
          } catch (error) {
            summary.failed += 1;
            failures.push({ course: course.code, url: candidate.url, error: error.message });
          }
          if (!options.dryRun) atomicJson(statePath, state);
          await sleep(envInt('NOTES_SCRAPER_DELAY_MS', 900));
        }
      } catch (error) {
        summary.failed += 1;
        failures.push({ course: course.code, error: error.message });
      }
    }
  } finally {
    summary.finishedAt = new Date().toISOString();
    if (!options.dryRun) {
      atomicJson(statePath, state);
      atomicJson(path.join(ROOT, 'last-run.json'), summary);
      atomicJson(path.join(ROOT, 'failures.json'), failures);
    }
    release();
  }
  return { ...summary, failures };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = {
  run, parseArgs, extractDocumentLinks, xmlItems, duckDuckGoItems, relevant, extensionFor
};
