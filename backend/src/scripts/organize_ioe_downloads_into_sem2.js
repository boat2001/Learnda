/**
 * Moves files from uploads/resources/notes/sem-2/ioe-downloads/{code}/
 * into uploads/resources/notes/sem-2/{level}/{group}/{course-slug}/
 * using backend/data/second_sem_course_source_list.csv (course_code → target_notes_path).
 *
 * Unmatched certificate (EIN*) and PGDE (EPS|EFO|EAS|ESC|EPA*) folders go under
 * sem-2/_ioe-other/certificate/ and sem-2/_ioe-other/pgde/.
 *
 * Usage: node src/scripts/organize_ioe_downloads_into_sem2.js
 *        node src/scripts/organize_ioe_downloads_into_sem2.js --dry-run
 *        node src/scripts/organize_ioe_downloads_into_sem2.js --repair-unmapped
 */
const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '../..');
const SEM2 = path.join(BACKEND_ROOT, 'uploads/resources/notes/sem-2');
const IOE_ROOT = path.join(SEM2, 'ioe-downloads');
const CSV_PATH = path.join(BACKEND_ROOT, 'data/second_sem_course_source_list.csv');

/** Folder name (as under ioe-downloads) → path under sem-2 (no leading slash). */
const FOLDER_OVERRIDES = {
  EBS323: '200/sci/methods-of-teaching-science',
  EBS327: '200/soc/curriculum-studies-in-social-studies',
  EBS322SW: '200/math/curriculum-studies-in-mathematics',
  EBS289: '400/math/mathematical-investigations',
  EBS101SW: '100/math/college-geometry',
  EBS330: '300/eng/english-in-multilingual-context',
  EBS313: '300/eng/english-in-multilingual-context',
  EBS301: '100/math/trigonometry',
  EBS210SW: '100/math/geometry-and-trigonometry',
  EBS121SW: '100/eng/prose-fiction',
  /** Information literacy — closest second-sem home is ICT office suite / learning theories. */
  EBS118SW: '100/ict/off-suit',
  /** Human land issues — not in sem-2 CSV; park with social-studies materials. */
  EBS157SW: '200/soc/curriculum-studies-in-social-studies',
  /** Social structure of Ghana — not listed in sem-2 CSV; integrated social studies. */
  EBS265: '200/soc/social-studies-as-an-integrated-subject',
  /** Population & socio-economic development — not in sem-2 CSV; nearest bucket is Gender & Development in Africa (soc 300). */
  EBS347SW: '300/soc/gender-development-in-africa'
};

/** When one IOE folder holds PDFs for two different catalogue courses. */
const FILE_ROUTE_RULES = [
  {
    folder: 'EBS403',
    re: /colonization|nationalism|403j/i,
    rel: '400/soc/colonization-nationalism-in-africa'
  },
  {
    folder: 'EBS403',
    re: /school|family|partnership|ece/i,
    rel: '400/ece/school-family-community-partnership-in-ece'
  }
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    repairUnmapped: argv.includes('--repair-unmapped')
  };
}

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

function loadCourseCodeToRelDir() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const table = parseCsv(raw);
  const header = table[0].map((h) => h.trim());
  const ic = header.indexOf('course_code');
  const it = header.indexOf('target_notes_path');
  if (ic < 0 || it < 0) throw new Error('CSV missing course_code or target_notes_path');
  const map = new Map();
  for (let r = 1; r < table.length; r += 1) {
    const code = String(table[r][ic] || '').trim().toUpperCase();
    let target = String(table[r][it] || '').trim().replace(/\/+$/, '');
    if (!code || !target) continue;
    const prefix = 'uploads/resources/notes/sem-2/';
    if (!target.startsWith(prefix)) continue;
    const rel = target.slice(prefix.length);
    map.set(code, rel);
  }
  return map;
}

function codeKeysFromFolder(folder) {
  const u = String(folder || '').toUpperCase();
  const m = u.match(/^([A-Z]{2,5})(\d{2,4})([A-Z]*)$/);
  if (!m) return [];
  const num = m[2];
  const suf = (m[3] || '').trim();
  const keys = [];
  if (suf) keys.push(`${num}${suf}`);
  keys.push(num);
  const n = parseInt(num, 10);
  if (!Number.isNaN(n) && String(n) !== num) keys.push(String(n));
  if (/^\d+$/.test(num)) {
    keys.push(`${num}J`, `${num}P`);
  }
  return [...new Set(keys)];
}

function uniqueDest(destFile) {
  if (!fs.existsSync(destFile)) return destFile;
  const dir = path.dirname(destFile);
  const ext = path.extname(destFile);
  const base = path.basename(destFile, ext);
  let i = 2;
  for (;;) {
    const c = path.join(dir, `${base}_ioe${i}${ext}`);
    if (!fs.existsSync(c)) return c;
    i += 1;
    if (i > 200) return path.join(dir, `${base}_ioe_${Date.now()}${ext}`);
  }
}

function lookupFromCodeMap(folderName, codeMap) {
  const keys = codeKeysFromFolder(folderName);
  for (const k of keys) {
    if (codeMap.has(k)) return codeMap.get(k);
  }
  return null;
}

function resolveRelDir(folderName, fileName, codeMap) {
  const rules = FILE_ROUTE_RULES.filter((x) => x.folder === folderName && x.re.test(fileName));
  if (rules.length) return rules[0].rel;

  if (FOLDER_OVERRIDES[folderName]) return FOLDER_OVERRIDES[folderName];

  const fromMap = lookupFromCodeMap(folderName, codeMap);
  if (fromMap) return fromMap;

  if (/^EIN/i.test(folderName)) return `_ioe-other/certificate/${folderName}`;
  if (/^(EPS|EFO|EAS|ESC|EPA)/i.test(folderName)) return `_ioe-other/pgde/${folderName}`;

  return `_ioe-other/unmapped/${folderName}`;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full));
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

function repairUnmappedFolders(codeMap, dryRun) {
  const um = path.join(SEM2, '_ioe-other', 'unmapped');
  if (!fs.existsSync(um)) return 0;
  let n = 0;
  for (const ent of fs.readdirSync(um, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const folderName = ent.name;
    const dir = path.join(um, folderName);
    const inner = walkFiles(dir);
    for (const src of inner) {
      const fileName = path.basename(src);
      const relDir = resolveRelDir(folderName, fileName, codeMap);
      if (relDir.startsWith('_ioe-other/unmapped')) continue;
      const destFile = uniqueDest(path.join(SEM2, relDir.split('/').join(path.sep), fileName));
      if (dryRun) {
        console.log('[repair dry-run]', path.relative(SEM2, src), '->', path.relative(SEM2, destFile));
        n += 1;
        continue;
      }
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.renameSync(src, destFile);
      n += 1;
    }
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch (_) {
      /* ignore */
    }
  }
  return n;
}

function main() {
  const { dryRun, repairUnmapped } = parseArgs(process.argv.slice(2));
  const codeMap = loadCourseCodeToRelDir();

  if (repairUnmapped) {
    const n = repairUnmappedFolders(codeMap, dryRun);
    console.log(JSON.stringify({ repairUnmapped: true, dryRun, filesMoved: n }, null, 2));
    return;
  }

  if (!fs.existsSync(IOE_ROOT)) {
    console.error('Missing IOE downloads folder:', IOE_ROOT);
    process.exit(1);
  }

  const files = walkFiles(IOE_ROOT);
  let moved = 0;
  const log = [];

  for (const src of files) {
    const relFromIoe = path.relative(IOE_ROOT, src);
    const parts = relFromIoe.split(path.sep);
    const folderName = parts[0];
    const relDir = resolveRelDir(folderName, path.basename(src), codeMap);
    const destDir = path.join(SEM2, relDir.split('/').join(path.sep));
    const destFile = uniqueDest(path.join(destDir, path.basename(src)));

    if (dryRun) {
      console.log('[dry-run]', relFromIoe, '->', path.relative(SEM2, destFile));
      moved += 1;
      continue;
    }

    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.renameSync(src, destFile);
    moved += 1;
    log.push({ from: relFromIoe, to: path.relative(SEM2, destFile) });
  }

  if (!dryRun) {
    for (const d of fs.readdirSync(IOE_ROOT, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = path.join(IOE_ROOT, d.name);
      try {
        if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
      } catch (_) {
        /* ignore */
      }
    }
    const manifest = path.join(SEM2, '_ioe-organize-manifest.json');
    fs.writeFileSync(
      manifest,
      JSON.stringify({ at: new Date().toISOString(), filesMoved: log.length, moves: log }, null, 2),
      'utf8'
    );
    console.log('Wrote', manifest);
  }

  console.log(JSON.stringify({ dryRun, filesMoved: moved }, null, 2));
}

main();
