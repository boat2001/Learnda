/**
 * Downloads PDFs (and other files) listed in uploads/resources/notes/sem-2/_ioe-course-links.json
 * into uploads/resources/notes/sem-2/ioe-downloads/{courseCode}/...
 *
 * Usage: node src/scripts/download_ioe_course_links.js
 * Options: --json=path/to.json  --out=relative/subdir  --dry-run
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../uploads/resources/notes/sem-2');
const DEFAULT_JSON = path.join(ROOT, '_ioe-course-links.json');

function parseArgs(argv) {
  const out = { jsonPath: DEFAULT_JSON, outSubdir: 'ioe-downloads', dryRun: false, force: false, sleepMs: 450 };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--force') out.force = true;
    const j = /^--json=(.+)$/.exec(a);
    if (j) out.jsonPath = path.resolve(j[1]);
    const o = /^--out=(.+)$/.exec(a);
    if (o) out.outSubdir = o[1].replace(/^[/\\]+/, '');
    const s = /^--sleep-ms=(\d+)$/.exec(a);
    if (s) out.sleepMs = Number(s[1], 10);
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeSegment(s, max = 120) {
  return String(s || 'misc')
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function uniqueDestPath(dir, baseName) {
  let dest = path.join(dir, baseName);
  if (!fs.existsSync(dest)) return dest;
  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;
  let i = 2;
  for (;;) {
    const candidate = path.join(dir, `${stem}_${i}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    i += 1;
    if (i > 500) return path.join(dir, `${stem}_${Date.now()}${ext}`);
  }
}

async function downloadOne(url, destPath, dryRun) {
  if (dryRun) {
    return { ok: true, skipped: true, destPath };
  }
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Sharether-ioe-course-sync/1.0 (+https://sharether.com)',
      Accept: '*/*'
    }
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.statusText };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) {
    return { ok: false, error: 'response_too_small', size: buf.length };
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { ok: true, bytes: buf.length, destPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.jsonPath)) {
    console.error('JSON not found:', args.jsonPath);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(args.jsonPath, 'utf8'));
  if (!Array.isArray(raw)) {
    console.error('Expected top-level JSON array');
    process.exit(1);
  }

  const outRoot = path.join(ROOT, args.outSubdir);
  let ok = 0;
  let fail = 0;
  let skip = 0;
  const failures = [];

  for (const entry of raw) {
    const code = safeSegment(entry.fullCode || entry.code || 'misc', 40);
    const links = Array.isArray(entry.links) ? entry.links : [];
    for (const link of links) {
      const url = link.url;
      const name = safeSegment(link.name || path.basename(new URL(url).pathname) || 'file.bin', 180);
      if (!url || !/^https?:\/\//i.test(url)) {
        failures.push({ url, reason: 'bad_url' });
        fail += 1;
        continue;
      }

      const dir = path.join(outRoot, code);
      let destPath = path.join(dir, name);
      if (!args.force && fs.existsSync(destPath)) {
        const st = fs.statSync(destPath);
        if (st.size > 500) {
          skip += 1;
          continue;
        }
      }
      if (fs.existsSync(destPath) && !args.force) {
        destPath = uniqueDestPath(dir, name);
      }

      try {
        const r = await downloadOne(url, destPath, args.dryRun);
        if (r.skipped) {
          console.log('[dry-run]', url, '->', path.relative(ROOT, destPath));
          ok += 1;
        } else if (r.ok) {
          ok += 1;
          console.log('OK', path.relative(path.join(__dirname, '../..'), destPath), r.bytes || '');
        } else {
          fail += 1;
          failures.push({ url, name, ...r });
          console.warn('FAIL', url, r.status || r.error);
        }
      } catch (e) {
        fail += 1;
        failures.push({ url, name, error: String(e.message || e) });
        console.warn('FAIL', url, e.message || e);
      }
      await sleep(args.sleepMs);
    }
  }

  console.log(JSON.stringify({ ok, fail, skip, outRoot: path.relative(path.join(__dirname, '../..'), outRoot) }, null, 2));
  if (failures.length && failures.length <= 30) {
    console.log('Failures detail:', JSON.stringify(failures, null, 2));
  } else if (failures.length) {
    const logPath = path.join(outRoot, '_download_failures.json');
    if (!args.dryRun) fs.mkdirSync(outRoot, { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify(failures, null, 2), 'utf8');
    console.log('Wrote failures to', logPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
