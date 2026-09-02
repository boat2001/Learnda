/**
 * Reads uploads/resources/notes/second-sem courses.txt and writes
 * backend/data/second_sem_course_source_list.csv with OER search URLs and target paths.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const SOURCE_TXT = path.join(ROOT, 'uploads/resources/notes/second-sem courses.txt');
const OUT_CSV = path.join(ROOT, 'data/second_sem_course_source_list.csv');

const decode = (s) =>
  String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

function slugHint(name) {
  return decode(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

function oerCommonsSearchUrl(query) {
  const q = encodeURIComponent(query);
  return `https://oercommons.org/search?f.search=${q}&view_mode=summary&batch_size=20`;
}

function mitOcwSearchUrl(query) {
  const q = encodeURIComponent(query);
  return `https://ocw.mit.edu/search/?q=${q}`;
}

/**
 * Parse "Name, code, credits?, audience" where Name may contain commas.
 * @returns {{ name: string, code: string, credits: string, audience: string } | null}
 */
function parseCourseLine(raw) {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length < 3) return null;

  const last = parts[parts.length - 1];
  const p2 = parts[parts.length - 2];
  const p3 = parts.length >= 4 ? parts[parts.length - 3] : null;

  const isCode = (s) => /^\d{2,3}[JP]?$/i.test(s);
  const isCreditsish = (s) => /^[\d.]+$|^\d+\/\d+$/.test(s);

  if (parts.length === 3) {
    if (!isCode(p2)) return null;
    return {
      name: decode(parts[0]),
      code: p2,
      credits: '',
      audience: last
    };
  }

  if (parts.length >= 4 && p3 !== null && isCode(p3) && isCreditsish(p2)) {
    return {
      name: decode(parts.slice(0, -3).join(', ')),
      code: p3,
      credits: p2,
      audience: last
    };
  }

  if (parts.length >= 4 && isCode(p2)) {
    return {
      name: decode(parts.slice(0, -2).join(', ')),
      code: p2,
      credits: '',
      audience: last
    };
  }

  return null;
}

function parseLines(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  /** @type {{ group: string, level: string, name: string, code: string, credits: string, audience: string }[]} */
  const rows = [];
  let group = 'core';
  let level = '';

  const isLevelLine = (l) => /^[1-4]00$/.test(l);
  const isGroupLine = (l) => /^\.\.+[a-z]{2,20}$/i.test(l.replace(/\s/g, ''));
  const extractGroup = (l) => l.replace(/^\.+/, '').trim().toLowerCase();

  for (const raw of lines) {
    if (!raw || raw.startsWith('---') || raw.startsWith('..........')) continue;
    if (/^Learnda second semester/i.test(raw)) continue;

    if (raw.toLowerCase().includes('core courses')) {
      group = 'core';
      level = '';
      continue;
    }

    if (isGroupLine(raw)) {
      group = extractGroup(raw);
      level = '';
      continue;
    }

    if (isLevelLine(raw)) {
      level = raw;
      continue;
    }

    if (!level || !raw.includes(',')) continue;

    const parsed = parseCourseLine(raw);
    if (!parsed) continue;

    rows.push({ group, level, ...parsed });
  }

  return rows;
}

function csvEscape(field) {
  const s = String(field ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  if (!fs.existsSync(SOURCE_TXT)) {
    console.error('Missing:', SOURCE_TXT);
    process.exit(1);
  }
  const text = fs.readFileSync(SOURCE_TXT, 'utf8');
  const rows = parseLines(text);

  const header = [
    'group',
    'level',
    'course_code',
    'course_name',
    'credits',
    'audience',
    'target_notes_path',
    'suggested_oer_search_query',
    'oer_commons_search_url',
    'mit_ocw_search_url',
    'license_note'
  ];

  const linesOut = [header.join(',')];
  for (const r of rows) {
    const query = `${r.name} teacher education basic school Africa`;
    const target = `uploads/resources/notes/sem-2/${r.level}/${r.group}/${slugHint(r.name)}/`;
    const row = [
      r.group,
      r.level,
      r.code,
      r.name,
      r.credits,
      r.audience,
      target,
      query,
      oerCommonsSearchUrl(query),
      mitOcwSearchUrl(r.name),
      'Verify licence on each result before hosting; prefer CC-BY / CC-BY-SA / public domain.'
    ].map(csvEscape);
    linesOut.push(row.join(','));
  }

  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  fs.writeFileSync(OUT_CSV, linesOut.join('\n'), 'utf8');
  console.log(`Wrote ${rows.length} rows to ${OUT_CSV}`);
}

main();
