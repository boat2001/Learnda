import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'sharether:scroll-positions';

const readStoredPositions = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const persistPositions = (positions) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage write failures.
  }
};

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positionsRef = useRef(readStoredPositions());
  const previousLocationKeyRef = useRef(location.key);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const previousKey = previousLocationKeyRef.current;
    if (previousKey) {
      positionsRef.current[previousKey] = { x: window.scrollX, y: window.scrollY };
    }

    previousLocationKeyRef.current = location.key;
    persistPositions(positionsRef.current);

    const restore = () => {
      const savedPosition = positionsRef.current[location.key];
      if (savedPosition) {
        window.scrollTo({ left: savedPosition.x || 0, top: savedPosition.y || 0, behavior: 'auto' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    };

    const scrollToHash = () => {
      const hashValue = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
      if (!hashValue) return false;

      const targetById = document.getElementById(hashValue);
      if (targetById) {
        targetById.scrollIntoView();
        return true;
      }

      const escapedHashValue =
        typeof window.CSS !== 'undefined' && typeof window.CSS.escape === 'function'
          ? window.CSS.escape(hashValue)
          : hashValue.replace(/["\\]/g, '\\$&');
      const targetByName = document.querySelector(`[name="${escapedHashValue}"]`);
      if (targetByName) {
        targetByName.scrollIntoView();
        return true;
      }

      return false;
    };

    const frame = window.requestAnimationFrame(() => {
      if (navigationType === 'POP') {
        restore();
        return;
      }

      if (scrollToHash()) return;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [location.key, location.hash, navigationType]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const saveCurrentPosition = () => {
      const activeKey = previousLocationKeyRef.current;
      if (!activeKey) return;
      positionsRef.current[activeKey] = { x: window.scrollX, y: window.scrollY };
      persistPositions(positionsRef.current);
    };

    window.history.scrollRestoration = 'manual';
    window.addEventListener('beforeunload', saveCurrentPosition);

    return () => {
      saveCurrentPosition();
      window.removeEventListener('beforeunload', saveCurrentPosition);
    };
  }, []);

  return null;
}
