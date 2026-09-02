import sharp from 'sharp';
import { readdir, stat, rename, unlink, writeFile } from 'fs/promises';
import { join, extname, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp']);
// Skip PWA icons, favicons — browsers expect specific formats for those
const SKIP_PATTERNS = [/favicon/, /pwa-/, /apple-touch/, /manifest/];

async function* walkDir(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkDir(full);
    else yield full;
  }
}

async function processImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED.has(ext)) return;
  if (SKIP_PATTERNS.some((p) => p.test(basename(filePath)))) return;

  const { size: before } = await stat(filePath);
  if (before < 50 * 1024) return; // skip files already under 50 KB

  try {
    const img = sharp(filePath);
    const meta = await img.metadata();

    // Determine output quality / format
    const isJpeg = ext === '.jpg' || ext === '.jpeg';
    const isPng  = ext === '.png';

    // Target: max 1400px wide, quality 82 (JPEG/WebP), preserve aspect ratio
    let pipeline = img.resize({ width: 1400, withoutEnlargement: true });

    let outputBuffer;
    if (isJpeg) {
      outputBuffer = await pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer();
    } else if (isPng) {
      // Convert PNG to WebP for much better compression (keep same filename for now)
      outputBuffer = await pipeline.webp({ quality: 82 }).toBuffer();
    } else {
      outputBuffer = await pipeline.webp({ quality: 82 }).toBuffer();
    }

    if (outputBuffer.length < before) {
      // Write to a temp path first, then atomically replace — avoids Windows
      // "can't overwrite open file" errors from sharp's in-place write.
      const tmp = filePath + '.tmp';
      await writeFile(tmp, outputBuffer);
      await unlink(filePath);
      await rename(tmp, filePath);
      const saved = before - outputBuffer.length;
      console.log(`✓ ${filePath.replace(PUBLIC_DIR, '')}  ${kb(before)} → ${kb(outputBuffer.length)}  (saved ${kb(saved)})`);
    } else {
      console.log(`– ${filePath.replace(PUBLIC_DIR, '')}  already optimal (${kb(before)})`);
    }
  } catch (err) {
    console.error(`✗ ${filePath.replace(PUBLIC_DIR, '')}: ${err.message}`);
  }
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

console.log('Compressing images in public/...\n');
let total = 0;
let saved = 0;

for await (const file of walkDir(PUBLIC_DIR)) {
  const ext = extname(file).toLowerCase();
  if (!SUPPORTED.has(ext)) continue;
  if (SKIP_PATTERNS.some((p) => p.test(basename(file)))) continue;
  const { size } = await stat(file);
  if (size < 50 * 1024) continue;
  total += size;
  const before = size;
  await processImage(file);
  const { size: after } = await stat(file);
  saved += before - after;
}

console.log(`\nDone. Total saved: ${kb(saved)} of ${kb(total)}`);
