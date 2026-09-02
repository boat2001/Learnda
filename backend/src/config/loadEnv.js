const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
let loaded = false;

const normalizeMode = (value) => String(value || 'development').trim() || 'development';

const getEnvFileCandidates = (mode = process.env.NODE_ENV) => {
  const normalizedMode = normalizeMode(mode);
  const explicitFile = String(process.env.BACKEND_ENV_FILE || '').trim();
  const candidates = [
    explicitFile,
    `.env.${normalizedMode}.local`,
    `.env.${normalizedMode}`,
    '.env.local',
    // Legacy fallback for existing local setups. Mode-specific files should be used going forward.
    '.env',
  ].filter(Boolean);

  return [...new Set(candidates)].map((file) => (
    path.isAbsolute(file) ? file : path.join(BACKEND_ROOT, file)
  ));
};

const loadEnv = (options = {}) => {
  if (loaded && !options.force) return;

  getEnvFileCandidates(options.mode).forEach((filePath) => {
    if (!fs.existsSync(filePath)) return;
    dotenv.config({ path: filePath });
  });

  loaded = true;
};

module.exports = {
  loadEnv,
  getEnvFileCandidates,
};
