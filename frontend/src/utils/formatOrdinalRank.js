/**
 * @param {number | null | undefined} n 1-based rank
 * @returns {string} e.g. 1 → "1st", 11 → "11th", null → "—"
 */
export function formatOrdinalRank(n) {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) < 1) return '—';
  const r = Math.floor(Number(n));
  const mod100 = r % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${r}th`;
  switch (r % 10) {
    case 1: return `${r}st`;
    case 2: return `${r}nd`;
    case 3: return `${r}rd`;
    default: return `${r}th`;
  }
}
