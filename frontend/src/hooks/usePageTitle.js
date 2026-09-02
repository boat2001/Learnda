import { useEffect } from 'react';

const normalizePart = (value) => (value || '').toString().trim();

const dedupeParts = (parts) => {
  const seen = new Set();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildPageTitle = (title, options = {}) => {
  const config = typeof options === 'string' ? { suffix: options } : options;
  const suffix = normalizePart(config?.suffix || 'Sharether');
  const section = normalizePart(config?.section || '');
  const trimmed = normalizePart(title);

  const parts = dedupeParts([trimmed, section, suffix]).filter(Boolean);
  if (!parts.length) return suffix || 'Sharether';
  return parts.join(' | ');
};

export default function usePageTitle(title, options = {}) {
  const suffix = options.suffix || 'Sharether';
  const section = options.section;

  useEffect(() => {
    document.title = buildPageTitle(title, { suffix, section });
  }, [title, suffix, section]);
}
