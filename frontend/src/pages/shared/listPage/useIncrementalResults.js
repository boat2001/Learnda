import { useEffect, useMemo, useState } from 'react';

const DEFAULT_INITIAL_COUNT = 24;
const DEFAULT_STEP = 24;

const scheduleIdleWork = (callback, timeout = 180) => {
  if (typeof window === 'undefined') return null;
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout });
  }
  return window.setTimeout(callback, 32);
};

const cancelIdleWork = (handle) => {
  if (handle == null || typeof window === 'undefined') return;
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle);
    return;
  }
  window.clearTimeout(handle);
};

export const scheduleCatalogWarmup = (callback, delay = 800) => {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};

  let idleHandle = null;
  const timeoutId = window.setTimeout(() => {
    idleHandle = scheduleIdleWork(callback, 600);
  }, delay);

  return () => {
    window.clearTimeout(timeoutId);
    cancelIdleWork(idleHandle);
  };
};

export default function useIncrementalResults(
  items,
  {
    active = true,
    initialCount = DEFAULT_INITIAL_COUNT,
    step = DEFAULT_STEP,
  } = {},
) {
  const safeItems = Array.isArray(items) ? items : [];
  const [visibleCount, setVisibleCount] = useState(() => Math.min(initialCount, safeItems.length));

  useEffect(() => {
    setVisibleCount(active ? Math.min(initialCount, safeItems.length) : 0);
  }, [active, initialCount, safeItems]);

  useEffect(() => {
    if (!active || visibleCount >= safeItems.length) return undefined;

    const handle = scheduleIdleWork(() => {
      setVisibleCount((current) => Math.min(current + step, safeItems.length));
    });

    return () => cancelIdleWork(handle);
  }, [active, safeItems.length, step, visibleCount]);

  return useMemo(
    () => ({
      items: active ? safeItems.slice(0, visibleCount) : [],
      visibleCount,
      totalCount: safeItems.length,
      isIncrementing: active && visibleCount < safeItems.length,
    }),
    [active, safeItems, visibleCount],
  );
}
