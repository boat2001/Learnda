// src/config/upload.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── R2 / S3-compatible storage (optional) ─────────────────────────────────────
let r2Storage = null;
let r2Client = null; // exported for authenticated downloads (no public access required)

const r2Configured =
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET &&
  process.env.R2_ENDPOINT;

if (r2Configured) {
  try {
    // multer-s3 v3 requires @aws-sdk/client-s3 (SDK v3), not aws-sdk (v2)
    const { S3Client } = require('@aws-sdk/client-s3');
    const multerS3 = require('multer-s3');

    r2Client = new S3Client({
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      endpoint: process.env.R2_ENDPOINT,
      region: 'auto',
      forcePathStyle: true,
    });

    r2Storage = multerS3({
      s3: r2Client,
      bucket: process.env.R2_BUCKET || 'sharether-content',
      // R2 does not support per-object ACLs — omit `acl` entirely.
      // Public access is controlled at the bucket level in the R2 dashboard.
      contentType: (req, file, cb) => cb(null, file.mimetype),
      key: (_, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `uploads/${Date.now()}_${safeName}`);
      },
    });
  } catch (err) {
    console.warn('[upload] R2 init failed, falling back to disk:', err.message);
    r2Storage = null;
    r2Client = null;
  }
}

// ── Local disk fallback ────────────────────────────────────────────────────────
const backendRoot = path.resolve(__dirname, '..', '..');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(backendRoot, 'uploads'));
if (!r2Configured && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const unavailableServerlessStorage = {
  _handleFile: (_, __, cb) => cb(new Error(
    'Cloudflare R2 must be configured before uploads can be accepted on Vercel.'
  )),
  _removeFile: (_, __, cb) => cb(null),
};

const storage = r2Storage || (process.env.VERCEL ? unavailableServerlessStorage : diskStorage);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (default for most routes)
});

/** Community forum file attachments (larger cap; route also validates size). */
const uploadCommunity = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

// Resolve the public URL of an uploaded file
const getFileUrl = (file) => {
  if (r2Configured && process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${file.key || file.filename}`;
  }
  if (file.location) return file.location;
  if (file.filename) {
    return `/uploads/${file.filename}`;
  }
  return null;
};

/**
 * Express error-handling middleware for multer errors.
 * Drop this after any upload middleware to return JSON instead of HTML on failure.
 */
const handleUploadError = (err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large.'
      : `Upload error: ${err.message}`;
    return res.status(400).json({ success: false, error: message });
  }

  // S3 / R2 or any other storage errors
  console.error('[upload] Storage error:', err.code || err.statusCode || err.name, err.message);
  return res.status(500).json({ success: false, error: 'File storage is unavailable. Please try again.' });
};

module.exports = {
  uploadDir,
  upload,
  uploadCommunity,
  getFileUrl,
  handleUploadError,
  isR2: Boolean(r2Configured),
  r2Client,
};
