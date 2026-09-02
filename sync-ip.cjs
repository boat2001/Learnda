#!/usr/bin/env node
/**
 * sync-ip.js
 *
 * Detects the current local network IP (Wi-Fi / Ethernet) and updates
 * local URL values in both frontend/.env and backend/.env automatically.
 *
 * Run manually:   node sync-ip.cjs
 * Or it runs automatically when you do `npm run dev` in either package.
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');

// ── config ────────────────────────────────────────────────────────────────────

const ROOT = __dirname;

const ENV_FILES = [
  {
    file: path.join(ROOT, 'frontend', '.env.development.local'),
    vars: [
      { name: 'VITE_API_BASE_URL', mode: 'api-url-list' },
    ],
  },
  {
    file: path.join(ROOT, 'backend', '.env.development.local'),
    vars: [
      // Keep loopback origins and add/update the matching LAN origins.
      { name: 'CORS_ORIGIN', mode: 'cors-origin-list' },
      // Leave localhost alone, but stale LAN callback URLs must follow the active IP.
      { name: 'APP_PUBLIC_URL', mode: 'private-url' },
    ],
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────

// Windows' Mobile Hotspot / Internet Connection Sharing always hands itself
// this fixed gateway IP on its virtual adapter. If it's up, the user almost
// certainly turned it on to reach a phone directly (e.g. campus wifi isolates
// devices from each other), so it should win over the "real" Wi-Fi adapter.
const ICS_HOTSPOT_PREFIX = '192.168.137.';

/** Returns the best local network IPv4 address. */
function getLocalIp() {
  const interfaces = os.networkInterfaces();

  // Zeroth pass: an active Windows Mobile Hotspot / ICS adapter.
  for (const addresses of Object.values(interfaces)) {
    for (const addr of addresses || []) {
      if (addr.family === 'IPv4' && !addr.internal && addr.address.startsWith(ICS_HOTSPOT_PREFIX)) {
        return addr.address;
      }
    }
  }

  // Preference order: Wi-Fi, WLAN, Ethernet, any other non-internal interface
  const preferredNames = ['wi-fi', 'wlan', 'wlan0', 'wlan1', 'wireless', 'eth0', 'ethernet', 'en0', 'en1'];

  // First pass: preferred interface names (case-insensitive)
  for (const name of preferredNames) {
    for (const [ifName, addresses] of Object.entries(interfaces)) {
      if (ifName.toLowerCase().replace(/\s+/g, '') !== name.replace(/\s+/g, '')) continue;
      for (const addr of addresses || []) {
        if (addr.family === 'IPv4' && !addr.internal && isUsableIp(addr.address)) {
          return addr.address;
        }
      }
    }
  }

  // Second pass: any non-internal IPv4 that looks like a LAN address
  for (const [, addresses] of Object.entries(interfaces)) {
    for (const addr of addresses || []) {
      if (addr.family === 'IPv4' && !addr.internal && isUsableIp(addr.address)) {
        return addr.address;
      }
    }
  }

  return null;
}

/** Returns true for usable LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) */
function isUsableIp(ip) {
  if (!ip) return false;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  // Exclude loopback, link-local, multicast
  if (a === 127 || a === 169 || a >= 224) return false;
  // Private ranges only (so we don't accidentally use a public IP)
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

const isLoopbackHost = (host) => LOOPBACK_HOSTS.has(String(host || '').toLowerCase());

const parseHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const replaceUrlHost = (value, newIp, shouldReplaceHost) => {
  const parsed = parseHttpUrl(value);
  if (!parsed || !shouldReplaceHost(parsed.hostname)) {
    return { updated: value, oldIp: '' };
  }

  const oldIp = parsed.hostname === newIp ? '' : parsed.hostname;
  parsed.hostname = newIp;
  return { updated: parsed.toString().replace(/\/$/, ''), oldIp };
};

const dedupeValues = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const cloneWithLanHost = (value, newIp) => (
  replaceUrlHost(value, newIp, (host) => isLoopbackHost(host)).updated
);

const updateUrlList = (value, newIp, { cloneLoopback }) => {
  const oldIps = new Set();
  const values = String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
  const updatedValues = values.map((item) => {
    const replacement = replaceUrlHost(item, newIp, (host) => isUsableIp(host));
    if (replacement.oldIp) oldIps.add(replacement.oldIp);
    return replacement.updated;
  });

  if (cloneLoopback) {
    values
      .filter((item) => isLoopbackHost(parseHttpUrl(item)?.hostname))
      .map((item) => cloneWithLanHost(item, newIp))
      .forEach((item) => updatedValues.push(item));
  }

  const updated = dedupeValues(updatedValues).join(',');
  return { updated, oldIps };
};

const updateValue = (value, newIp, mode) => {
  if (mode === 'api-url-list' || mode === 'cors-origin-list') {
    return updateUrlList(value, newIp, { cloneLoopback: true });
  }

  if (mode === 'private-url') {
    const replacement = replaceUrlHost(value, newIp, (host) => isUsableIp(host));
    return {
      updated: replacement.updated,
      oldIps: new Set(replacement.oldIp ? [replacement.oldIp] : []),
    };
  }

  return { updated: value, oldIps: new Set() };
};

/**
 * Reads an .env file and replaces the IP in the specified variables.
 * Lines for other variables are left untouched.
 * Returns { content, changed, oldIps }.
 */
function updateEnvFile(filePath, vars, newIp) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠  File not found, skipping: ${filePath}`);
    return { content: null, changed: false, oldIps: new Set() };
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split('\n');
  const allOldIps = new Set();
  let changed = false;

  const updated = lines.map((line) => {
    // Skip comments and blank lines
    if (!line.trim() || line.trim().startsWith('#')) return line;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return line;

    const key = line.slice(0, eqIdx).trim();
    const variable = vars.find((entry) => entry.name === key);
    if (!variable) return line;

    const value = line.slice(eqIdx + 1);
    const { updated: newValue, oldIps } = updateValue(value, newIp, variable.mode);

    if (newValue !== value) {
      changed = true;
      oldIps.forEach((ip) => allOldIps.add(ip));
      return `${key}=${newValue}`;
    }
    return line;
  });

  return {
    content: updated.join('\n'),
    changed,
    oldIps: allOldIps,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

function main() {
  const newIp = getLocalIp();

  if (!newIp) {
    console.error('sync-ip: Could not detect a local network IP address.');
    console.error('         Make sure you are connected to a network and try again.');
    process.exit(0); // non-fatal — let the dev server start anyway
  }

  console.log(`sync-ip: Local IP detected → ${newIp}`);

  let anyChange = false;

  for (const { file, vars } of ENV_FILES) {
    const rel = path.relative(ROOT, file);
    const { content, changed, oldIps } = updateEnvFile(file, vars, newIp);

    if (content === null) continue; // file missing, already warned

    if (!changed) {
      console.log(`  ✓  ${rel} — already up to date`);
      continue;
    }

    fs.writeFileSync(file, content, 'utf8');
    const oldList = [...oldIps].join(', ') || '(previous IP)';
    console.log(`  ✓  ${rel} — updated: ${oldList} → ${newIp}`);
    anyChange = true;
  }

  if (anyChange) {
    console.log('sync-ip: .env files updated. Restart dev servers if already running.');
  }
}

main();
