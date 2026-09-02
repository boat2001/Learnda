const PRELIM_PROGRESS_STORAGE_PREFIX = 'sharether:prelim-progress';

const normalizeStorageKeyPart = (value, fallback = 'guest') => {
  const text = String(value || '').trim();
  return text || fallback;
};

export const buildPrelimProgressStorageKey = ({ courseId, courseSlug, userKey }) => {
  const learnerKey = normalizeStorageKeyPart(userKey, 'guest');
  const courseKey = normalizeStorageKeyPart(courseId || courseSlug, 'course');
  return `${PRELIM_PROGRESS_STORAGE_PREFIX}:${learnerKey}:${courseKey}`;
};

export const loadPrelimProgress = (storageKey) => {
  if (typeof window === 'undefined' || !storageKey) return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

export const savePrelimProgress = (storageKey, progressMap) => {
  if (typeof window === 'undefined' || !storageKey) return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progressMap || {}));
  } catch (error) {
    // Ignore local storage failures to keep the learning flow moving.
  }
};

export const markPrelimComplete = ({ storageKey, prelimId, completedAt = new Date().toISOString() }) => {
  const nextMap = {
    ...loadPrelimProgress(storageKey),
    [String(prelimId || '')]: {
      completed: true,
      completedAt,
    },
  };
  savePrelimProgress(storageKey, nextMap);
  return nextMap;
};

export const isCompletedPrelim = (progressMap, prelimId) =>
  Boolean(progressMap?.[String(prelimId || '')]?.completed);
