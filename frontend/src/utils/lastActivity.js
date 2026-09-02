// Lightweight "pick up where you left off" tracker.
//
// We record the last meaningful thing the student did — opening a course
// (learning), a practice, or a file — in localStorage, so the Home page can
// offer a one-tap way back into it. Intentionally client-side and best-effort:
// it reflects this device's activity and never blocks anything if storage is
// unavailable.

const STORAGE_KEY = 'sharether_last_activity';

export const ACTIVITY_TYPES = {
  LEARNING: 'learning',
  PRACTICE: 'practice',
  FILES: 'files',
};

/**
 * Persist the most recent activity.
 * @param {{ type: string, title?: string, subtitle?: string, credits?: string, path: string, progress?: number }} activity
 */
export function recordLastActivity(activity) {
  if (typeof window === 'undefined') return;
  if (!activity || !activity.type || !activity.path) return;
  try {
    const payload = {
      type: activity.type,
      title: activity.title || '',
      subtitle: activity.subtitle || '',
      credits: activity.credits || '',
      path: activity.path,
      progress: Number.isFinite(Number(activity.progress))
        ? Math.max(0, Math.min(100, Math.round(Number(activity.progress))))
        : null,
      at: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage is optional — ignore quota/availability errors.
  }
}

/**
 * Read the last recorded activity, or null if none/invalid.
 * @returns {{ type: string, title: string, subtitle: string, credits: string, path: string, progress: number | null, at: number } | null}
 */
export function readLastActivity() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.type || !parsed.path) return null;
    return parsed;
  } catch {
    return null;
  }
}
