#!/usr/bin/env node
/* eslint-disable no-console */
require('../config/loadEnv').loadEnv();

const fs = require('fs');
const path = require('path');
const { HeadObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const ROOT = path.resolve(process.cwd());
const UPLOAD_DIR = path.resolve(ROOT, process.env.UPLOAD_DIR || 'uploads');
const BUCKET = process.env.R2_BUCKET;
const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const START_INDEX_ARG = process.argv.find((arg) => arg.startsWith('--start-index='));
const START_INDEX = (() => {
  if (!START_INDEX_ARG) return 1;
  const raw = Number.parseInt(String(START_INDEX_ARG).split('=')[1], 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
})();
const TARGET_ARGS = process.argv.filter((arg) => arg.startsWith('--target='));
const TARGETS = TARGET_ARGS.length > 0
  ? TARGET_ARGS.map((arg) => arg.split('=').slice(1).join('='))
  : null;
const WALK_DIRS = TARGETS ? TARGETS.map((t) => path.resolve(UPLOAD_DIR, t)) : [UPLOAD_DIR];

const usage = () => {
  console.log('Usage: node src/scripts/migrate_uploads_to_r2.js [--dry-run] [--force] [--target=subdir ...]');
  console.log('  --dry-run       show what would upload without writing');
  console.log('  --force         overwrite objects even if key already exists');
  console.log('  --start-index=N start from 1-based file index');
  console.log('  --target=subdir only walk this subdirectory of uploads/ (repeatable, keys rooted at uploads/)');
};

const required = [
  ['R2_BUCKET', BUCKET],
  ['R2_ENDPOINT', ENDPOINT],
  ['R2_ACCESS_KEY_ID', ACCESS_KEY_ID],
  ['R2_SECRET_ACCESS_KEY', SECRET_ACCESS_KEY],
];

const missing = required.filter(([, v]) => !String(v || '').trim());
if (missing.length) {
  console.error(
    `Missing required env vars: ${missing.map(([k]) => k).join(', ')}`
  );
  usage();
  process.exit(1);
}

if (!fs.existsSync(UPLOAD_DIR)) {
  console.error(`Upload directory does not exist: ${UPLOAD_DIR}`);
  process.exit(1);
}

for (const walkDir of WALK_DIRS) {
  if (!fs.existsSync(walkDir)) {
    console.error(`Target directory does not exist: ${walkDir}`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  endpoint: ENDPOINT,
  region: 'auto',
  forcePathStyle: true,
  maxAttempts: 4,
});

const walkFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
      continue;
    }
    if (entry.isFile()) files.push(full);
  }
  return files;
};

const toPosix = (value) => String(value).replace(/\\/g, '/');
const toKey = (absolutePath) => {
  const rel = path.relative(UPLOAD_DIR, absolutePath);
  return `uploads/${toPosix(rel).replace(/^\/+/, '')}`;
};

const contentTypeFor = (file) => {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.html': 'text/html',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.mp4': 'video/mp4',
  };
  return map[ext] || 'application/octet-stream';
};

const headObject = async (key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (error) {
    if (error && (error.$metadata?.httpStatusCode === 404 || error.name === 'NotFound')) {
      return false;
    }
    throw error;
  }
};

const uploadOne = async (absolutePath, key) => {
  const contentType = contentTypeFor(absolutePath);
  const body = fs.createReadStream(absolutePath);
  const contentLength = fs.statSync(absolutePath).size;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
  );
};

const formatBytes = (num) => {
  const value = Number(num || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const run = async () => {
  const files = WALK_DIRS.flatMap((d) => walkFiles(d));
  const filesToProcess = files.slice(Math.max(START_INDEX - 1, 0));
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  console.log(`Uploads root: ${UPLOAD_DIR}`);
  if (TARGETS) console.log(`Target subdirs: ${TARGETS.join(', ')}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Mode: ${DRY_RUN ? 'dry-run' : 'write'}`);
  console.log(`Files found: ${files.length}`);
  console.log(`Starting at index: ${START_INDEX}`);
  console.log(`Files to process: ${filesToProcess.length}`);

  for (let i = 0; i < filesToProcess.length; i += 1) {
    const absolutePath = filesToProcess[i];
    const stat = fs.statSync(absolutePath);
    const key = toKey(absolutePath);
    const absoluteIndex = START_INDEX + i;
    const progress = `[${absoluteIndex}/${files.length}]`;

    try {
      if (!FORCE) {
        const exists = await headObject(key);
        if (exists) {
          skipped += 1;
          console.log(`${progress} skip ${key}`);
          continue;
        }
      }

      if (DRY_RUN) {
        uploaded += 1;
        bytes += stat.size;
        console.log(`${progress} dry ${key}`);
        continue;
      }

      await uploadOne(absolutePath, key);
      uploaded += 1;
      bytes += stat.size;
      console.log(`${progress} up   ${key}`);
    } catch (error) {
      failed += 1;
      console.error(`${progress} fail ${key} :: ${error.message}`);
    }
  }

  console.log('---');
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total bytes uploaded: ${bytes} (${formatBytes(bytes)})`);
  if (failed > 0) process.exitCode = 1;
};

run().catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});
