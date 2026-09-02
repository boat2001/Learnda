/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fingerprint, loadDataset, normalize, writeDataset } = require('./edutainment_collector');

const BOOKS = [
  { id: 7283, heading: 'h2', start: 'SHORT STORIES AND SELECTIONS', defaultAuthor: null },
  { id: 5403, heading: 'h1', start: 'THE FIRST CHRISTMAS TREE', defaultAuthor: null }
];
const SKIP = /^(THE PROJECT GUTENBERG|SHORT STORIES AND SELECTIONS$|TABLE OF CONTENTS|CONTENTS|PREFACE|INTRODUCTION|HOW THIS BOOK MAY BE USED|THE FULL PROJECT GUTENBERG)/i;
const ARTICLE_TITLES = /ADDRESS|INAUGURAL|APPRECIATION|ACCOUNT OF HIS SPEECH|WALT WHITMAN|HEROISM IN HOUSEKEEPING|^WAR$|^SIGHT IN SAVAGES$/i;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'SharetherPublicDomainReader/1.0 (admin@sharether.com)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'SharetherPublicDomainReader/1.0 (admin@sharether.com)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

function cleanTitle(value) {
  return normalize(value).replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

function extractAuthor(parts) {
  for (let index = 0; index < Math.min(parts.length, 12); index += 1) {
    const direct = parts[index].match(/^BY\s+([A-Z][A-Z .,'’-]{2,100})$/i);
    if (direct) return normalize(direct[1]);
    if (/^BY$/i.test(parts[index]) && /^[A-Z][A-Z .,'’-]{2,100}$/i.test(parts[index + 1] || '')) {
      return normalize(parts[index + 1]);
    }
  }
  const opening = parts.slice(0, 6).join(' ').match(/\bby\s+([A-Z][A-Za-z .'-]{2,80})(?:\.|,\s*Copyright)/);
  if (opening) return normalize(opening[1]);
  for (const text of [...parts].reverse()) {
    const byline = text.match(/^[—-]\s*(.{2,120})\.?$/);
    if (byline) return normalize(byline[1]).replace(/\s*\(adapted\.?\)\.?$/i, '').replace(/\.$/, '');
  }
  return null;
}

function extractEntries(html, book, metadata) {
  const $ = cheerio.load(html);
  const headings = $(book.heading).toArray();
  let started = false;
  const entries = [];
  for (const heading of headings) {
    const title = cleanTitle($(heading).text());
    if (!started && title === book.start) started = true;
    if (!started || SKIP.test(title)) continue;
    const parts = [];
    let cursor = $(heading).next();
    while (cursor.length && cursor.prop('tagName')?.toLowerCase() !== book.heading) {
      const text = normalize(cursor.text());
      const usefulBylineFootnote = /^\[Footnote:/i.test(text) && /\bby\b/i.test(text);
      if (text && (!/^\[Footnote:/i.test(text) || usefulBylineFootnote) && !/^\*{3}/.test(text)
        && !/^THE FULL PROJECT GUTENBERG/i.test(text)) parts.push(text);
      cursor = cursor.next();
    }
    const author = extractAuthor(parts) || book.defaultAuthor || 'Unknown / traditional';
    const bodyParts = parts.filter((text, index) => !/^[—-]\s*.{2,120}\.?$/.test(text)
      && !/^\[Footnote:/i.test(text) && !/^BY(?:\s+[A-Z][A-Z .,'’-]{2,100})?$/i.test(text)
      && !(index > 0 && /^BY$/i.test(parts[index - 1])));
    const body = bodyParts.join('\n\n').trim();
    if (body.split(/\s+/).length < 120) continue;
    const category = ARTICLE_TITLES.test(title) ? 'articles' : 'stories';
    entries.push({
      id: fingerprint(`${category}:${metadata.id}:${title}:${body}`), category, title, body,
      summary: body.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 500), author,
      sourceName: metadata.title, sourceUrl: null, license: 'Public-domain source text',
      imageUrl: metadata.formats['image/jpeg'] || null,
      tags: ['public-domain-reader', 'english-course-reading', 'teacher-resource', `gutenberg-${metadata.id}`],
      collectedAt: new Date().toISOString(), metadata: {
        gutenbergId: metadata.id, sourceBook: metadata.title,
        acquisitionSource: `https://www.gutenberg.org/ebooks/${metadata.id}`,
        sourceHtmlSha256: crypto.createHash('sha256').update(html).digest('hex'),
        copyrightFlag: metadata.copyright, rightsReview: 'Public-domain source; retain Gutenberg license link and attribution',
        fullTextImported: true
      }
    });
  }
  return entries;
}

async function run() {
  const collected = [];
  const sources = [];
  for (const book of BOOKS) {
    const metadata = await fetchJson(`https://gutendex.com/books/${book.id}`);
    if (metadata.copyright !== false) throw new Error(`Gutenberg ${book.id} is not marked copyright=false`);
    const htmlUrl = metadata.formats['text/html'] || metadata.formats['text/html; charset=iso-8859-1'];
    const html = await fetchText(htmlUrl);
    const entries = extractEntries(html, book, metadata);
    collected.push(...entries);
    sources.push({ id: book.id, title: metadata.title, url: `https://www.gutenberg.org/ebooks/${book.id}`, entries: entries.length });
  }
  const results = {};
  for (const category of ['stories', 'articles']) {
    const dataset = loadDataset(category);
    const additions = collected.filter((item) => item.category === category);
    const retained = dataset.entries.filter((entry) => !entry.tags?.includes('public-domain-reader'));
    const unique = new Map([...retained, ...additions].map((entry) => [fingerprint(entry.body), entry]));
    const entries = [...unique.values()];
    writeDataset(category, { ...dataset, entries, total: entries.length, updatedAt: new Date().toISOString() });
    results[category] = { added: entries.length - dataset.entries.length, total: entries.length };
  }
  const auditPath = path.resolve(__dirname, '../../data/edutainment/sources/public-domain-readers.index.json');
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(), sources,
    deferred: [{ id: 473, reason: 'Sara Cone Bryant died in 1956; defer full-text Ghana publication pending local term review.' }],
    discoveryOnly: ['shortstoryguide.com/public-domain-short-stories', 'freekidsbooks.org/license/creative-commons', 'libguides.library.umkc.edu/OER/PublicDomainBooks']
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ sources, results }, null, 2));
  return results;
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { extractAuthor, extractEntries, run };
