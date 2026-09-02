/**
 * Utility functions for the Sharether platform
 */

// Format a person's name so every word starts with a capital and the rest are lowercase
// Handles hyphens and apostrophes (e.g. "O'BRIEN" → "O'Brien", "mary-anne" → "Mary-Anne")
export const formatDisplayName = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[-'\s])([a-z])/g, (_, sep, char) => `${sep}${char.toUpperCase()}`);
