const REGISTRATION_DRAFT_KEY = 'learnda_registration_draft_v1';

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export const loadRegistrationDraft = () => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(REGISTRATION_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const saveRegistrationDraft = (nextDraft) => {
  if (typeof window === 'undefined') return;

  const draft = isObject(nextDraft) ? nextDraft : {};
  const hasValues = Object.values(draft).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (isObject(value)) return Object.keys(value).length > 0;
    return value != null && String(value).trim() !== '';
  });

  if (!hasValues) {
    window.localStorage.removeItem(REGISTRATION_DRAFT_KEY);
    return;
  }

  window.localStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(draft));
};

export const clearRegistrationDraft = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REGISTRATION_DRAFT_KEY);
};
