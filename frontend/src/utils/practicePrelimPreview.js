const STORAGE_PREFIX = 'sharether:practice-prelim-preview';

const buildStorageKey = (lessonId) => `${STORAGE_PREFIX}:${String(lessonId || '').trim()}`;

const canUseSessionStorage = () => typeof window !== 'undefined' && Boolean(window.sessionStorage);

export const isPracticePrelimLessonId = (lessonId) =>
  /^practice-prelim-/i.test(String(lessonId || '').trim());

export const savePracticePrelimPreviewLesson = (lesson) => {
  const lessonId = String(lesson?.id || '').trim();
  if (!lessonId || !canUseSessionStorage()) return false;

  try {
    window.sessionStorage.setItem(buildStorageKey(lessonId), JSON.stringify(lesson));
    return true;
  } catch (_error) {
    return false;
  }
};

export const loadPracticePrelimPreviewLesson = (lessonId) => {
  const normalizedLessonId = String(lessonId || '').trim();
  if (!normalizedLessonId || !canUseSessionStorage()) return null;

  try {
    const rawValue = window.sessionStorage.getItem(buildStorageKey(normalizedLessonId));
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue);
    return String(parsed?.id || '').trim() === normalizedLessonId ? parsed : null;
  } catch (_error) {
    return null;
  }
};
