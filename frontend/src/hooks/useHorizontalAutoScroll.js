import { useCallback, useEffect, useRef, useState } from 'react';

export default function useHorizontalAutoScroll(
  scrollRef,
  {
    enabled = true,
    interval = 4200,
    pauseOnInteractionMs = 5000,
    itemCount = 0,
    trackActiveIndex = true,
  } = {}
) {
  const autoTimerRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const scrollFrameRef = useRef(null);
  const scrollReleaseTimerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const getElement = useCallback(() => scrollRef?.current || null, [scrollRef]);

  const getItems = useCallback(() => {
    const element = getElement();
    return element ? Array.from(element.children) : [];
  }, [getElement]);

  const getTrackPaddingLeft = useCallback((element) => {
    if (!element || typeof window === 'undefined') return 0;
    return Number.parseFloat(window.getComputedStyle(element).paddingLeft || '0') || 0;
  }, []);

  const getTargetLeft = useCallback(
    (element, item) => {
      if (!element || !item) return 0;
      return Math.max(0, item.offsetLeft - getTrackPaddingLeft(element));
    },
    [getTrackPaddingLeft]
  );

  const getNearestIndex = useCallback(() => {
    const element = getElement();
    const items = getItems();
    if (!element || !items.length) return 0;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    items.forEach((item, index) => {
      const distance = Math.abs(element.scrollLeft - getTargetLeft(element, item));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }, [getElement, getItems, getTargetLeft]);

  const getStepSize = useCallback(
    (startIndex = 0) => {
      const element = getElement();
      const items = getItems();
      if (!element || !items.length) return 1;

      const safeStartIndex = Math.min(Math.max(startIndex, 0), items.length - 1);
      const startItem = items[safeStartIndex];
      const startLeft = getTargetLeft(element, startItem);
      let visibleCount = 0;

      for (let index = safeStartIndex; index < items.length; index += 1) {
        const item = items[index];
        const itemLeft = getTargetLeft(element, item);
        const itemRight = itemLeft + item.getBoundingClientRect().width;
        const span = itemRight - startLeft;

        if (visibleCount > 0 && span > element.clientWidth + 4) break;
        visibleCount += 1;
      }

      return Math.max(1, visibleCount);
    },
    [getElement, getItems, getTargetLeft]
  );

  const clearProgrammaticScrollState = useCallback(() => {
    if (scrollReleaseTimerRef.current) {
      window.clearTimeout(scrollReleaseTimerRef.current);
      scrollReleaseTimerRef.current = null;
    }

    const element = getElement();
    if (element) {
      element.style.scrollSnapType = '';
    }
  }, [getElement]);

  const setTrackedIndex = useCallback(
    (index) => {
      if (!trackActiveIndex) return;
      setActiveIndex((currentIndex) => (currentIndex === index ? currentIndex : index));
    },
    [trackActiveIndex]
  );

  const syncActiveIndex = useCallback(() => {
    const index = getNearestIndex();
    setTrackedIndex(index);
    return index;
  }, [getNearestIndex, setTrackedIndex]);

  const scrollToIndex = useCallback(
    (index, behavior = 'smooth') => {
      const element = getElement();
      const items = getItems();
      if (!element || !items.length) return;

      const safeIndex = Math.min(Math.max(index, 0), items.length - 1);
      const item = items[safeIndex];
      if (!item) return;

      if (behavior !== 'auto') {
        clearProgrammaticScrollState();
        element.style.scrollSnapType = 'none';
        scrollReleaseTimerRef.current = window.setTimeout(() => {
          scrollReleaseTimerRef.current = null;
          element.style.scrollSnapType = '';
        }, 420);
      }

      element.scrollTo({
        left: getTargetLeft(element, item),
        behavior,
      });
      setTrackedIndex(safeIndex);
    },
    [clearProgrammaticScrollState, getElement, getItems, getTargetLeft, setTrackedIndex]
  );

  const pauseAutoScroll = useCallback(
    (duration = pauseOnInteractionMs) => {
      pauseUntilRef.current = Date.now() + duration;
    },
    [pauseOnInteractionMs]
  );

  useEffect(() => {
    const element = getElement();
    if (!element) return undefined;

    syncActiveIndex();

    const handleScroll = () => {
      if (scrollFrameRef.current) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        syncActiveIndex();
      });
    };

    const handleResize = () => {
      const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      if (maxScrollLeft <= 8) {
        element.scrollLeft = 0;
        setActiveIndex(0);
        return;
      }

      if (element.scrollLeft > maxScrollLeft) {
        element.scrollLeft = maxScrollLeft;
      }

      syncActiveIndex();
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize);
      observer.observe(element);
      Array.from(element.children).forEach((child) => {
        observer.observe(child);
      });
    }

    return () => {
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      element.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [getElement, itemCount, syncActiveIndex]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const element = getElement();
    if (!element) return undefined;

    const clearAutoTimer = () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };

    const scheduleAdvance = () => {
      clearAutoTimer();
      autoTimerRef.current = window.setTimeout(() => {
        const slider = getElement();
        const items = getItems();
        if (!slider || items.length <= 1) {
          scheduleAdvance();
          return;
        }

        if (document.hidden || Date.now() < pauseUntilRef.current) {
          scheduleAdvance();
          return;
        }

        if (slider.scrollWidth <= slider.clientWidth + 8) {
          slider.scrollLeft = 0;
          setActiveIndex(0);
          scheduleAdvance();
          return;
        }

        const currentIndex = syncActiveIndex();
        const stepSize = getStepSize(currentIndex);
        const nextIndex =
          currentIndex >= items.length - stepSize
            ? 0
            : currentIndex + stepSize;

        scrollToIndex(nextIndex);
        scheduleAdvance();
      }, interval);
    };

    const handleInteraction = () => {
      pauseAutoScroll();
      syncActiveIndex();
    };

    element.addEventListener('pointerdown', handleInteraction);
    element.addEventListener('touchstart', handleInteraction, { passive: true });
    element.addEventListener('wheel', handleInteraction, { passive: true });
    element.addEventListener('focusin', handleInteraction);

    scheduleAdvance();

    return () => {
      clearAutoTimer();
      element.removeEventListener('pointerdown', handleInteraction);
      element.removeEventListener('touchstart', handleInteraction);
      element.removeEventListener('wheel', handleInteraction);
      element.removeEventListener('focusin', handleInteraction);
    };
  }, [
    enabled,
    getElement,
    getItems,
    getStepSize,
    interval,
    itemCount,
    pauseAutoScroll,
    scrollToIndex,
    syncActiveIndex,
  ]);

  useEffect(
    () => () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current);
      }
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      clearProgrammaticScrollState();
    },
    [clearProgrammaticScrollState]
  );

  return {
    activeIndex,
    pauseAutoScroll,
    scrollToIndex,
    syncActiveIndex,
  };
}
