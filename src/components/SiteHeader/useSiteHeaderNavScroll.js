import { useCallback, useEffect, useRef, useState } from 'react';

const EDGE_EPS = 2;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function getScrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

/**
 * Горизонтальный overflow для category nav в шапке:
 * fade по краям, стрелки на fine-pointer, wheel → scrollLeft, focus в зону видимости.
 */
export function useSiteHeaderNavScroll(activeKey) {
  const listRef = useRef(null);
  const canPrevRef = useRef(false);
  const canNextRef = useRef(false);
  const hasOverflowRef = useRef(false);
  const rafRef = useRef(0);

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const syncScrollState = useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextOverflow = maxScroll > EDGE_EPS;
    const nextPrev = el.scrollLeft > EDGE_EPS;
    const nextNext = el.scrollLeft < maxScroll - EDGE_EPS;

    if (nextOverflow !== hasOverflowRef.current) {
      hasOverflowRef.current = nextOverflow;
      setHasOverflow(nextOverflow);
    }
    if (nextPrev !== canPrevRef.current) {
      canPrevRef.current = nextPrev;
      setCanPrev(nextPrev);
    }
    if (nextNext !== canNextRef.current) {
      canNextRef.current = nextNext;
      setCanNext(nextNext);
    }
  }, []);

  const scheduleSync = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      syncScrollState();
    });
  }, [syncScrollState]);

  const scrollByDir = useCallback((dir) => {
    const el = listRef.current;
    if (!el) return;
    const amount = Math.max(120, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: dir * amount, behavior: getScrollBehavior() });
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;

    syncScrollState();

    const onScroll = () => scheduleSync();
    el.addEventListener('scroll', onScroll, { passive: true });

    const onWheel = (event) => {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (maxScroll <= EDGE_EPS) return;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absX < 1 && absY < 1) return;

      // Trackpad уже даёт deltaX — не перехватываем вертикаль страницы.
      if (absX >= absY) return;

      const next = el.scrollLeft + event.deltaY;
      const clamped = Math.max(0, Math.min(maxScroll, next));
      if (clamped === el.scrollLeft) return;

      event.preventDefault();
      el.scrollLeft = clamped;
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    const onFocusIn = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!el.contains(target)) return;
      target.scrollIntoView({
        inline: 'nearest',
        block: 'nearest',
        behavior: getScrollBehavior(),
      });
    };
    el.addEventListener('focusin', onFocusIn);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncScrollState();
      });
      resizeObserver.observe(el);
    }

    const onWindowResize = () => syncScrollState();
    window.addEventListener('resize', onWindowResize);

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('focusin', onFocusIn);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onWindowResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [scheduleSync, syncScrollState]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const active = el.querySelector('.site-nav-item.is-active');
    if (active instanceof HTMLElement) {
      active.scrollIntoView({
        inline: 'nearest',
        block: 'nearest',
        behavior: 'auto',
      });
    }
    syncScrollState();
  }, [activeKey, syncScrollState]);

  return {
    listRef,
    canPrev,
    canNext,
    hasOverflow,
    scrollByDir,
  };
}
