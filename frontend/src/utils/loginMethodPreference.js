const STORAGE_KEY = 'sharether_last_login_method';

/** @typedef {'google' | 'email' | 'phone'} LoginMethod */

/** @returns {LoginMethod | null} */
export const getLastLoginMethod = () => {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'google' || v === 'email' || v === 'phone') return v;
  } catch {
    // no-op
  }
  return null;
};

/** @param {LoginMethod} method */
export const setLastLoginMethod = (method) => {
  if (typeof window === 'undefined') return;
  if (method !== 'google' && method !== 'email' && method !== 'phone') return;
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // no-op
  }
};
