import { useEffect, useRef, useState } from 'react';

export default function useHeaderSheen() {
  const [headerSheenReady, setHeaderSheenReady] = useState(false);
  const [headerSheenCycle, setHeaderSheenCycle] = useState(0);
  const headerScrollArmedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const activateHeaderSheen = () => {
      window.requestAnimationFrame(() => {
        setHeaderSheenReady(true);
        setHeaderSheenCycle((previous) => previous + 1);
      });
    };

    if (document.readyState === 'complete') {
      activateHeaderSheen();
      return undefined;
    }

    const handleLoad = () => {
      window.removeEventListener('load', handleLoad);
      activateHeaderSheen();
    };

    window.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const replayHeaderSheen = () => {
      setHeaderSheenCycle((previous) => previous + 1);
    };

    const handleScroll = () => {
      if (window.scrollY > 24) {
        headerScrollArmedRef.current = true;
        return;
      }

      if (!headerScrollArmedRef.current) return;
      headerScrollArmedRef.current = false;
      replayHeaderSheen();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return {
    headerSheenReady,
    headerSheenCycle,
  };
}
