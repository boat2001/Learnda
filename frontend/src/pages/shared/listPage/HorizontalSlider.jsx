import { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './listPage.css';
import useHorizontalAutoScroll from '../../../hooks/useHorizontalAutoScroll';

export default function HorizontalSlider({
  children,
  ariaLabel = 'Slider',
  autoSlide = false,
  onActiveIndexChange,
}) {
  const trackRef = useRef(null);
  const mobileHideTimerRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const lastNotifiedIndexRef = useRef(-1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [mobileControlsActive, setMobileControlsActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const childCount = useMemo(() => Children.count(children), [children]);

  useHorizontalAutoScroll(trackRef, {
    enabled: autoSlide && childCount > 1,
    interval: 4600,
    itemCount: childCount,
    pauseOnInteractionMs: 5200,
    trackActiveIndex: false,
  });
  const isInteractiveTarget = useCallback((target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('a, button, input, select, textarea, label, summary, [role="button"], [role="link"]')
    );
  }, []);

  const getItems = useCallback(() => {
    const element = trackRef.current;
    return element ? Array.from(element.children) : [];
  }, []);

  const getTrackPaddingLeft = useCallback((element) => {
    if (!element || typeof window === 'undefined') return 0;
    return Number.parseFloat(window.getComputedStyle(element).paddingLeft || '0') || 0;
  }, []);

  const getTargetLeft = useCallback((element, item) => {
    if (!element || !item) return 0;
    return Math.max(0, item.offsetLeft - getTrackPaddingLeft(element));
  }, [getTrackPaddingLeft]);

  const getNearestIndex = useCallback(() => {
    const element = trackRef.current;
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
  }, [getItems, getTargetLeft]);

  const getStepSize = useCallback((startIndex = 0) => {
    const element = trackRef.current;
    const items = getItems();
    if (!element || !items.length) return 1;

    const safeStartIndex = Math.min(Math.max(startIndex, 0), items.length - 1);
    const startItem = items[safeStartIndex];
    const startLeft = getTargetLeft(element, startItem);
    const maxViewportWidth = element.clientWidth;
    let visibleCount = 0;

    for (let index = safeStartIndex; index < items.length; index += 1) {
      const item = items[index];
      const itemLeft = getTargetLeft(element, item);
      const itemRight = itemLeft + item.getBoundingClientRect().width;
      const span = itemRight - startLeft;

      if (visibleCount > 0 && span > maxViewportWidth + 4) break;
      visibleCount += 1;
    }

    return Math.max(1, visibleCount);
  }, [getItems, getTargetLeft]);

  const scrollToIndex = useCallback((index, behavior = 'smooth') => {
    const element = trackRef.current;
    const items = getItems();
    if (!element || !items.length) return;

    const safeIndex = Math.min(Math.max(index, 0), items.length - 1);
    const item = items[safeIndex];
    if (!item) return;

    element.scrollTo({
      left: getTargetLeft(element, item),
      behavior,
    });
  }, [getItems, getTargetLeft]);

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

  const updateState = useCallback(() => {
    const element = trackRef.current;
    if (!element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const left = Math.max(0, element.scrollLeft);
    setCanScrollLeft(left > 4);
    setCanScrollRight(left < maxScrollLeft - 4);
    if (typeof onActiveIndexChange === 'function') {
      const nextIndex = getNearestIndex();
      if (nextIndex !== lastNotifiedIndexRef.current) {
        lastNotifiedIndexRef.current = nextIndex;
        onActiveIndexChange(nextIndex);
      }
    }
  }, [getNearestIndex, onActiveIndexChange]);

  const scrollByStep = useCallback((direction) => {
    const element = trackRef.current;
    if (!element) return;

    showMobileControlsTemporarily();
    const items = getItems();

    if (!items.length) {
      const fallbackStep = Math.max(180, Math.round(element.clientWidth * 0.78));
      element.scrollBy({
        left: direction === 'left' ? -fallbackStep : fallbackStep,
        behavior: 'smooth',
      });
      return;
    }

    const currentIndex = getNearestIndex();
    const stepSize = getStepSize(currentIndex);
    const nextIndex =
      direction === 'left'
        ? Math.max(0, currentIndex - stepSize)
        : Math.min(items.length - 1, currentIndex + stepSize);

    scrollToIndex(nextIndex);
  }, [getItems, getNearestIndex, getStepSize, scrollToIndex, showMobileControlsTemporarily]);

  const stopDragging = useCallback((pointerId = null) => {
    const element = trackRef.current;
    const dragState = dragStateRef.current;
    if (!dragState.active) return;

    if (
      element &&
      pointerId != null &&
      typeof element.hasPointerCapture === 'function' &&
      element.hasPointerCapture(pointerId)
    ) {
      element.releasePointerCapture(pointerId);
    }

    dragState.active = false;
    dragState.pointerId = null;
    setIsDragging(false);

    if (dragState.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }, []);

  const handlePointerDown = useCallback((event) => {
    const element = trackRef.current;
    if (!element) return;

    showMobileControlsTemporarily();

    if (event.pointerType !== 'mouse') return;
    if (event.button !== 0) return;
    if (isInteractiveTarget(event.target)) return;

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
      moved: false,
    };

    if (typeof element.setPointerCapture === 'function') {
      element.setPointerCapture(event.pointerId);
    }
  }, [isInteractiveTarget, showMobileControlsTemporarily]);

  const handlePointerMove = useCallback((event) => {
    const element = trackRef.current;
    const dragState = dragStateRef.current;
    if (!element || !dragState.active || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(deltaX) > 6) {
      dragState.moved = true;
      setIsDragging(true);
    }

    if (!dragState.moved) return;

    element.scrollLeft = dragState.startScrollLeft - deltaX;
    showMobileControlsTemporarily();
  }, [showMobileControlsTemporarily]);

  const handlePointerUp = useCallback((event) => {
    stopDragging(event.pointerId);
  }, [stopDragging]);

  const handlePointerCancel = useCallback((event) => {
    stopDragging(event.pointerId);
  }, [stopDragging]);

  const handleClickCapture = useCallback((event) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return undefined;

    updateState();

    const scheduleStateUpdate = () => {
      if (scrollFrameRef.current) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        updateState();
      });
    };

    const onScroll = () => {
      scheduleStateUpdate();
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', scheduleStateUpdate);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleStateUpdate);
      observer.observe(element);
    }

    return () => {
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      element.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', scheduleStateUpdate);
      observer?.disconnect();
    };
  }, [updateState]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(updateState);
    const timeoutId = window.setTimeout(updateState, 120);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [children, updateState]);

  useEffect(() => {
    lastNotifiedIndexRef.current = -1;
    updateState();
  }, [children, onActiveIndexChange, updateState]);

  useEffect(() => () => {
    if (mobileHideTimerRef.current) {
      window.clearTimeout(mobileHideTimerRef.current);
    }
    if (scrollFrameRef.current) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
    stopDragging();
  }, []);

  return (
    <div
      className={`list-page-horizontal-slider learn-horizontal-slider ${mobileControlsActive ? 'mobile-controls-active' : ''}`}
    >
      <button
        type="button"
        className={`list-page-slider-arrow learn-slider-arrow left ${canScrollLeft ? 'visible' : ''}`}
        onClick={() => scrollByStep('left')}
        aria-label={`Scroll ${ariaLabel} left`}
        disabled={!canScrollLeft}
      >
        <FiChevronLeft />
      </button>

      <div
        ref={trackRef}
        className={`list-page-slider-track learn-horizontal-slider-track learn-slider-track ${isDragging ? 'is-dragging' : ''}`}
        role="list"
        aria-label={ariaLabel}
        onTouchStart={showMobileControlsTemporarily}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      <button
        type="button"
        className={`list-page-slider-arrow learn-slider-arrow right ${canScrollRight ? 'visible' : ''}`}
        onClick={() => scrollByStep('right')}
        aria-label={`Scroll ${ariaLabel} right`}
        disabled={!canScrollRight}
      >
        <FiChevronRight />
      </button>
    </div>
  );
}
