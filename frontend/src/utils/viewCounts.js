export const toFiniteNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const formatCountCompact = (value) => {
  const count = Math.max(0, toFiniteNumber(value, 0));
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${count}`;
};

/** Resolves a persisted view count from API content, lessons, or practice items. */
export const resolveContentViewCount = (item = {}) =>
  Math.max(
    0,
    toFiniteNumber(
      item?.stats?.total_views ??
        item?.view_count ??
        item?.views ??
        item?.total_views ??
        item?.metadata?.view_count ??
        item?.metadata?.views ??
        0,
      0
    )
  );

export const isUuidString = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
