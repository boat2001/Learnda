const LOCK_STATE_KEY = '__learndaBodyScrollLockState__';

const getLockState = () => {
  if (typeof window === 'undefined') return null;
  if (!window[LOCK_STATE_KEY]) {
    window[LOCK_STATE_KEY] = {
      locks: new Set(),
      previousBodyOverflow: '',
      previousDocumentOverflow: ''
    };
  }
  if (!(window[LOCK_STATE_KEY].locks instanceof Set)) {
    window[LOCK_STATE_KEY] = {
      locks: new Set(),
      previousBodyOverflow: window[LOCK_STATE_KEY].previousOverflow || '',
      previousDocumentOverflow: ''
    };
  }
  return window[LOCK_STATE_KEY];
};

export const lockBodyScroll = () => {
  if (typeof document === 'undefined') return () => {};
  const lockState = getLockState();
  if (!lockState) return () => {};

  const lockId = Symbol('body-scroll-lock');
  if (lockState.locks.size === 0) {
    lockState.previousBodyOverflow = document.body.style.overflow;
    lockState.previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  lockState.locks.add(lockId);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockState.locks.delete(lockId);
    if (lockState.locks.size === 0) {
      document.body.style.overflow = lockState.previousBodyOverflow || '';
      document.documentElement.style.overflow = lockState.previousDocumentOverflow || '';
      lockState.previousBodyOverflow = '';
      lockState.previousDocumentOverflow = '';
    }
  };
};
