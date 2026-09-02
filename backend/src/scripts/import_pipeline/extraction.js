'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const BACKEND_ROOT = path.join(__dirname, '../../..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads');
const DEFAULT_MIN_TEXT_CHARS = 250;
const DEFAULT_MAX_BYTES = 80 * 1024 * 1024;

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function toPosix(value) {
  return String(value || '').split(path.sep).join('/');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function resolveLocalPath(filePath) {
  if (!filePath) return null;
  const candidates = [
    filePath,
    path.join(BACKEND_ROOT, filePath),
    path.join(UPLOADS_ROOT, filePath),
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }

  return null;
}

function downloadToTemp(url) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(new URL(url).pathname) || '.pdf';
    const tmp = path.join(os.tmpdir(), `sharether_import_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
    const file = fs.createWriteStream(tmp);
    const lib = url.startsWith('https') ? https : http;

    lib.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {
          // Ignore temp cleanup errors.
        }
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }

      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(tmp)));
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(tmp); } catch (_) {
        // Ignore temp cleanup errors.
      }
      reject(err);
    });
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`.trim()));
    });
  });
}

function windowsToolCandidates(command) {
  if (process.platform !== 'win32') return [command];

  const candidates = [command];
  if (command === 'tesseract') {
    candidates.push(
      process.env.TESSERACT_PATH,
      'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
      'C:\\Program Files\\NAPS2\\lib\\_win64\\tesseract.exe'
    );
  }

  if (command === 'pdftoppm') {
    const wingetRoot = path.join(
      process.env.LOCALAPPDATA || '',
      'Microsoft',
      'WinGet',
      'Packages'
    );
    if (fs.existsSync(wingetRoot)) {
      for (const entry of fs.readdirSync(wingetRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.toLowerCase().includes('poppler')) continue;
        const packageDir = path.join(wingetRoot, entry.name);
        for (const child of fs.readdirSync(packageDir, { withFileTypes: true })) {
          if (!child.isDirectory() || !child.name.toLowerCase().startsWith('poppler-')) continue;
          candidates.push(path.join(packageDir, child.name, 'Library', 'bin', 'pdftoppm.exe'));
        }
      }
    }
    candidates.push(process.env.PDFTOPPM_PATH);
  }

  return candidates.filter(Boolean);
}

async function resolveCommand(command) {
  const probe = process.platform === 'win32'
    ? { command: 'where.exe', args: [command] }
    : { command: 'which', args: [command] };

  try {
    const { stdout } = await runCommand(probe.command, probe.args);
    const first = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0];
    return first || command;
  } catch (_) {
    for (const candidate of windowsToolCandidates(command)) {
      if (candidate !== command && fs.existsSync(candidate)) return candidate;
    }
    return null;
  }
}

async function extractPdfText(filePath) {
  const pdfParse = require('pdf-parse');
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  return {
    text: normalizeText(data.text || ''),
    pages: data.numpages || 0,
    method: 'pdf_text',
  };
}

async function extractDocxText(filePath) {
  const mammoth = require('mammoth');
  const { value } = await mammoth.extractRawText({ path: filePath });
  return {
    text: normalizeText(value || ''),
    pages: null,
    method: 'docx',
  };
}

async function extractTxtText(filePath) {
  return {
    text: normalizeText(fs.readFileSync(filePath, 'utf8')),
    pages: null,
    method: 'txt',
  };
}

async function ocrPdf(filePath, options = {}) {
  const language = options.ocrLanguage || process.env.OCR_LANGUAGE || 'eng';
  const density = String(options.ocrDensity || process.env.OCR_DENSITY || 200);
  const maxPages = Number(options.ocrMaxPages || process.env.OCR_MAX_PAGES || 0);
  const pdftoppmPath = await resolveCommand('pdftoppm');
  const tesseractPath = await resolveCommand('tesseract');

  if (!pdftoppmPath || !tesseractPath) {
    const missing = [
      !pdftoppmPath ? 'pdftoppm' : null,
      !tesseractPath ? 'tesseract' : null,
    ].filter(Boolean);
    return {
      text: '',
      pages: null,
      method: 'ocr',
      warnings: [`OCR skipped. Missing CLI tool(s): ${missing.join(', ')}`],
      error: 'ocr_tools_missing',
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sharether_ocr_'));
  const prefix = path.join(tempDir, 'page');

  try {
    const renderArgs = ['-r', density, '-png'];
    if (maxPages > 0) renderArgs.push('-f', '1', '-l', String(maxPages));
    renderArgs.push(filePath, prefix);
    await runCommand(pdftoppmPath, renderArgs);

    const images = fs.readdirSync(tempDir)
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const pageTexts = [];
    for (const image of images) {
      const imagePath = path.join(tempDir, image);
      const { stdout } = await runCommand(tesseractPath, [imagePath, 'stdout', '-l', language]);
      pageTexts.push(stdout);
    }

    return {
      text: normalizeText(pageTexts.join('\n\n')),
      pages: images.length,
      method: 'ocr',
      warnings: images.length ? [] : ['OCR rendered no pages.'],
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {
      // Ignore temp cleanup errors.
    }
  }
}

async function resolveSourceFile(source) {
  const localPath = resolveLocalPath(source.file_path || source.path);
  if (localPath) return { filePath: localPath, cleanup: null };

  const url = source.file_url || source.url;
  if (url && /^https?:\/\//i.test(url)) {
    const tempPath = await downloadToTemp(url);
    return {
      filePath: tempPath,
      cleanup: () => {
        try { fs.unlinkSync(tempPath); } catch (_) {
          // Ignore temp cleanup errors.
        }
      },
    };
  }

  return { filePath: null, cleanup: null };
}

async function extractSourceText(source, options = {}) {
  const startedAt = Date.now();
  const diagnostics = {
    sourceId: source.id || null,
    sourceTitle: source.title || source.file_name || null,
    sourceFileName: source.file_name || null,
    sourceFilePath: source.file_path || source.path || null,
    sourceFileUrl: source.file_url || source.url || null,
    status: 'ok',
    method: null,
    pages: null,
    bytesIn: 0,
    charsOut: 0,
    extractedChars: 0,
    durationMs: 0,
    warnings: [],
    error: null,
  };

  const { filePath, cleanup } = await resolveSourceFile(source);
  try {
    if (!filePath) {
      diagnostics.status = 'error';
      diagnostics.error = 'no_file';
      return { text: '', diagnostics };
    }

    const stat = fs.statSync(filePath);
    diagnostics.bytesIn = stat.size;
    const maxBytes = Number(options.maxBytes || DEFAULT_MAX_BYTES);
    if (stat.size > maxBytes) {
      diagnostics.status = 'skipped_too_large';
      diagnostics.error = `File is larger than ${maxBytes} bytes.`;
      return { text: '', diagnostics };
    }

    const ext = path.extname(source.file_name || source.file_url || filePath).toLowerCase();
    let result;
    if (ext === '.pdf') {
      result = await extractPdfText(filePath);
      const minTextChars = Number(options.minTextChars || DEFAULT_MIN_TEXT_CHARS);
      if ((options.ocr !== false) && result.text.length < minTextChars) {
        diagnostics.warnings.push(`Selectable PDF text was below ${minTextChars} characters; OCR attempted.`);
        const ocrResult = await ocrPdf(filePath, options);
        if (ocrResult.text.length > result.text.length) {
          result = ocrResult;
        } else {
          diagnostics.warnings.push(...(ocrResult.warnings || []));
          if (ocrResult.error) diagnostics.warnings.push(ocrResult.error);
        }
      }
    } else if (ext === '.docx') {
      result = await extractDocxText(filePath);
    } else if (ext === '.txt' || ext === '.text') {
      result = await extractTxtText(filePath);
    } else {
      diagnostics.status = 'skipped_unsupported';
      diagnostics.error = `unsupported_ext:${ext || 'none'}`;
      return { text: '', diagnostics };
    }

    const text = normalizeText(result.text);
    diagnostics.method = result.method;
    diagnostics.pages = result.pages;
    diagnostics.extractedChars = text.length;
    diagnostics.charsOut = text.length;
    diagnostics.warnings.push(...(result.warnings || []));
    if (!text) {
      diagnostics.status = 'ok_empty_text';
      diagnostics.error = result.error || 'empty_text';
    }

    return { text, diagnostics };
  } catch (error) {
    diagnostics.status = 'error';
    diagnostics.error = error.message || String(error);
    return { text: '', diagnostics };
  } finally {
    diagnostics.durationMs = Date.now() - startedAt;
    if (cleanup) cleanup();
  }
}

function defaultManifest() {
  return {
    version: 1,
    updatedAt: null,
    files: {},
  };
}

function upsertManifestEntry(manifestPath, key, entry) {
  const manifest = readJson(manifestPath, defaultManifest());
  manifest.updatedAt = new Date().toISOString();
  manifest.files[key] = entry;
  writeJson(manifestPath, manifest);
  return manifest;
}

function outputTextPathForSource(outRoot, source, fallbackName = 'source') {
  const rawName = source.file_name || source.title || fallbackName;
  const safeName = String(rawName)
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || fallbackName;
  return path.join(outRoot, `${safeName}.txt`);
}

module.exports = {
  BACKEND_ROOT,
  UPLOADS_ROOT,
  normalizeText,
  toPosix,
  ensureDir,
  readJson,
  writeJson,
  resolveLocalPath,
  extractSourceText,
  upsertManifestEntry,
  outputTextPathForSource,
};
