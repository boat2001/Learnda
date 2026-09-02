/**
 * Extract plaintext from PDFs (and optionally DOCX) under uploads/resources/notes/sem-2,
 * writing mirrored outputs under sem-2/_extracted-text/...
 *
 * Usage:
 *   node src/scripts/extract_sem2_resource_text.js --dry-run
 *   node src/scripts/extract_sem2_resource_text.js
 *   node src/scripts/extract_sem2_resource_text.js --force
 *   node src/scripts/extract_sem2_resource_text.js --docx
 *   node src/scripts/extract_sem2_resource_text.js --only=200/core
 *
 * npm: npm run resources:extract-sem2-text -- --dry-run
 */
const fs = require('fs');
const path = require('path');
const { extractSourceText } = require('./import_pipeline/extraction');

const BACKEND_ROOT = path.join(__dirname, '../..');
const SEM2_ROOT = path.join(BACKEND_ROOT, 'uploads/resources/notes/sem-2');
const OUT_ROOT = path.join(SEM2_ROOT, '_extracted-text');
const MANIFEST_PATH = path.join(OUT_ROOT, '_manifest.json');

const MAX_BYTES = 80 * 1024 * 1024;
const SKIP_FILE_NAMES = new Set([
  '_ioe-course-links.json',
  '_ioe-organize-manifest.json',
  'second-sem courses.txt'
]);

function parseArgs(argv) {
  const out = {
    dryRun: false,
    force: false,
    docx: false,
    ocr: true,
    only: ''
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--force') out.force = true;
    if (a === '--docx') out.docx = true;
    if (a === '--no-ocr') out.ocr = false;
    const m = /^--only=(.+)$/.exec(a);
    if (m) out.only = m[1].trim().replace(/\\/g, '/');
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(dir, skipDirNames) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (skipDirNames.has(ent.name)) continue;
      out.push(...walkFiles(full, skipDirNames));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { version: 1, updatedAt: null, files: {} };
  }
  try {
    const j = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    if (j && typeof j.files === 'object') return j;
  } catch (_) {
    /* ignore */
  }
  return { version: 1, updatedAt: null, files: {} };
}

function saveManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  if (!fs.existsSync(OUT_ROOT)) fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(SEM2_ROOT)) {
    console.error('Missing sem-2 root:', SEM2_ROOT);
    process.exit(1);
  }

  const skipDirs = new Set(['_extracted-text']);
  const allFiles = walkFiles(SEM2_ROOT, skipDirs);
  const manifest = loadManifest();

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const absSrc of allFiles) {
    const rel = toPosix(path.relative(SEM2_ROOT, absSrc));
    const base = path.basename(absSrc);

    if (SKIP_FILE_NAMES.has(base)) {
      skipped += 1;
      continue;
    }
    if (args.only && !rel.replace(/\\/g, '/').includes(args.only)) {
      skipped += 1;
      continue;
    }

    const ext = path.extname(base).toLowerCase();
    let mode = null;
    if (ext === '.pdf') mode = 'pdf';
    else if (args.docx && ext === '.docx') mode = 'docx';
    else {
      manifest.files[rel] = {
        source: rel,
        status: 'skipped_unsupported',
        ext: ext || '(none)'
      };
      skipped += 1;
      continue;
    }

    const relDir = toPosix(path.dirname(rel));
    const srcBase = path.basename(rel);
    const outName = mode === 'pdf' ? `${srcBase}.txt` : `${srcBase}.raw.txt`;
    const outParts = ['_extracted-text', ...relDir.split('/').filter((p) => p && p !== '.')];
    const absOut = path.join(SEM2_ROOT, ...outParts, outName);

    let st;
    try {
      st = fs.statSync(absSrc);
    } catch (e) {
      errors += 1;
      manifest.files[rel] = { source: rel, status: 'error', error: String(e.message) };
      continue;
    }

    if (st.size > MAX_BYTES) {
      manifest.files[rel] = {
        source: rel,
        status: 'skipped_too_large',
        bytesIn: st.size,
        maxBytes: MAX_BYTES
      };
      skipped += 1;
      continue;
    }

    if (!args.force && fs.existsSync(absOut)) {
      try {
        const stOut = fs.statSync(absOut);
        if (stOut.mtimeMs >= st.mtimeMs) {
          skipped += 1;
          continue;
        }
      } catch (_) {
        /* fall through to re-extract */
      }
    }

    const t0 = Date.now();
    let entry = {
      source: rel,
      output: toPosix(path.relative(SEM2_ROOT, absOut)),
      bytesIn: st.size,
      durationMs: 0,
      charsOut: 0,
      pages: null,
      status: 'ok',
      error: null
    };

    try {
      let text = '';
      let pages = null;
      const r = await extractSourceText(
        {
          id: rel,
          title: srcBase,
          file_name: srcBase,
          file_path: absSrc,
        },
        { ocr: args.ocr }
      );
      text = r.text;
      pages = r.diagnostics.pages;
      entry.method = r.diagnostics.method;
      entry.warnings = r.diagnostics.warnings || [];

      entry.durationMs = Date.now() - t0;
      entry.pages = pages;

      const extractedChars = text.length;
      if (!text.length) {
        text =
          '# No extractable text (empty or scanned PDF).\n# Re-run with OCR tooling if you need this content.\n';
        entry.status = 'ok_empty_text';
        entry.extractedChars = 0;
        entry.charsOut = text.length;
      } else {
        entry.extractedChars = extractedChars;
        entry.charsOut = extractedChars;
      }

      if (args.dryRun) {
        console.log('[dry-run]', rel, '->', entry.output, `(${entry.charsOut} chars)`);
      } else {
        fs.mkdirSync(path.dirname(absOut), { recursive: true });
        fs.writeFileSync(absOut, text, 'utf8');
      }

      manifest.files[rel] = entry;
      processed += 1;
    } catch (e) {
      entry.status = 'error';
      entry.error = String(e.message || e);
      entry.durationMs = Date.now() - t0;
      manifest.files[rel] = entry;
      errors += 1;
      console.warn('FAIL', rel, e.message || e);
    }
  }

  if (!args.dryRun) {
    saveManifest(manifest);
  }

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        docx: args.docx,
        ocr: args.ocr,
        only: args.only || null,
        processed,
        skipped,
        errors,
        manifestPath: path.relative(BACKEND_ROOT, MANIFEST_PATH)
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
