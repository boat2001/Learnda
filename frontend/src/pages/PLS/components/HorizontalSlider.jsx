import { useCallback, useEffect, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function HorizontalSlider({
  trackClassName,
  role = 'list',
  ariaLabel,
  leftLabel = 'Scroll left',
  rightLabel = 'Scroll right',
  children,
}) {
  const trackRef = useRef(null);
  const mobileHideTimerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [mobileControlsActive, setMobileControlsActive] = useState(false);

  const showMobileControlsTemporarily = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    setMobileControlsActive(true);
    if (mobileHideTimerRef.current) {
      window.clearTimeout(mobileHideTimerRef.current);
    }
    mobileHideTimerRef.current = window.setTimeout(() => {
      setMobileControlsActive(false);
      mobileHideTimerRef.current = null;
    }, 1200);
  }, []);

  const updateScrollState = useCallback(() => {
    const element = trackRef.current;
    if (!element) return;

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const left = Math.max(0, element.scrollLeft);
    setCanScrollLeft(left > 4);
    setCanScrollRight(left < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return undefined;

    updateScrollState();

    const onScroll = () => {
      updateScrollState();
      showMobileControlsTemporarily();
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(onScroll);
      observer.observe(element);
    }

    return () => {
      element.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observer?.disconnect();
    };
  }, [showMobileControlsTemporarily, updateScrollState]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(updateScrollState);
    const timeoutId = window.setTimeout(updateScrollState, 120);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [children, updateScrollState]);

  useEffect(
    () => () => {
      if (mobileHideTimerRef.current) {
        window.clearTimeout(mobileHideTimerRef.current);
      }
    },
    []
  );

  const scrollByStep = useCallback((direction) => {
    const element = trackRef.current;
    if (!element) return;

    showMobileControlsTemporarily();
    const step = Math.max(180, Math.round(element.clientWidth * 0.72));
    element.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  }, [showMobileControlsTemporarily]);

  const handleTouchStart = useCallback(() => {
    showMobileControlsTemporarily();
  }, [showMobileControlsTemporarily]);

  return (
    <div className={`pls-horizontal-slider ${mobileControlsActive ? 'mobile-controls-active' : ''}`}>
      <button
        type="button"
        className={`pls-slider-arrow left ${canScrollLeft ? 'visible' : ''}`}
        onClick={() => scrollByStep('left')}
        aria-label={leftLabel}
        disabled={!canScrollLeft}
      >
        <FiChevronLeft />
      </button>

      <div ref={trackRef} className={trackClassName} role={role} aria-label={ariaLabel} onTouchStart={handleTouchStart}>
        {children}
      </div>

      <button
        type="button"
        className={`pls-slider-arrow right ${canScrollRight ? 'visible' : ''}`}
        onClick={() => scrollByStep('right')}
        aria-label={rightLabel}
        disabled={!canScrollRight}
      >
        <FiChevronRight />
      </button>
    </div>
  );
}
