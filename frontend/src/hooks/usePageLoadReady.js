import { useEffect, useState } from 'react';

export default function usePageLoadReady(delayMs = 120) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsReady(true);
      return undefined;
    }

    let readyTimerId = null;
    const markReady = () => {
      readyTimerId = window.setTimeout(() => {
        setIsReady(true);
      }, delayMs);
    };

    if (document.readyState === 'complete') {
      markReady();
      return () => {
        if (readyTimerId !== null) {
          window.clearTimeout(readyTimerId);
        }
      };
    }

    const handleWindowLoad = () => markReady();
    window.addEventListener('load', handleWindowLoad, { once: true });

    return () => {
      window.removeEventListener('load', handleWindowLoad);
      if (readyTimerId !== null) {
        window.clearTimeout(readyTimerId);
      }
    };
  }, [delayMs]);

  return isReady;
}
