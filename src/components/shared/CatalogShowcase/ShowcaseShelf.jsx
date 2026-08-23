import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

const EDGE_EPS = 2;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getScrollBehavior = () =>
  prefersReducedMotion() ? 'auto' : 'smooth';

/**
 * Горизонтальная полка карточек (scroll-snap) со стрелками и progress.
 * Общий рендерер для шин и дисков.
 *
 * @param {'default' | 'featured'} variant — featured: крупнее заголовок и слайды
 */
const ShowcaseShelf = ({
  title,
  items = [],
  renderCard,
  isClientMode,
  skeleton = false,
  skeletonCount = 6,
  variant = 'default',
  viewAllLabel,
  onViewAll,
}) => {
  const rowRef = useRef(null);
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const dragRef = useRef(null);
  const canPrevRef = useRef(false);
  const canNextRef = useRef(false);
  const hasOverflowRef = useRef(false);
  const metricsRef = useRef({
    scrollLeft: 0,
    maxScroll: 0,
    clientWidth: 0,
    scrollWidth: 0,
  });
  const rafRef = useRef(0);
  const metaTimerRef = useRef(0);
  const sliderId = useId();

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [sliderMeta, setSliderMeta] = useState({
    value: 0,
    max: 0,
    positionIndex: 1,
  });

  const slideCount = skeleton ? skeletonCount : items.length;
  const isFeatured = variant === 'featured';
  /* Кнопки всегда в разметке при товарах — без скачка ширины ряда */
  const reserveNav = !skeleton && slideCount > 1;
  const showProgress = !skeleton && hasOverflow;

  const updateThumbDom = useCallback((metrics) => {
    const thumb = thumbRef.current;
    if (!thumb) return;

    const { scrollLeft, maxScroll, clientWidth, scrollWidth } = metrics;
    const rawRatio =
      scrollWidth > 0 ? Math.min(1, clientWidth / scrollWidth) : 1;
    const thumbRatio = Math.min(1, Math.max(0.14, rawRatio));
    const thumbTravel = Math.max(0, 1 - thumbRatio);
    const thumbOffset =
      maxScroll > 0 ? (scrollLeft / maxScroll) * thumbTravel : 0;

    thumb.style.width = `${thumbRatio * 100}%`;
    thumb.style.left = `${thumbOffset * 100}%`;
  }, []);

  const readMetrics = useCallback(() => {
    const el = rowRef.current;
    if (!el) {
      return {
        scrollLeft: 0,
        maxScroll: 0,
        clientWidth: 0,
        scrollWidth: 0,
      };
    }
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    return {
      scrollLeft: el.scrollLeft,
      maxScroll,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    };
  }, []);

  const publishSliderMeta = useCallback(
    (metrics) => {
      const positionIndex =
        slideCount <= 1
          ? 1
          : Math.min(
              slideCount,
              Math.max(
                1,
                Math.round(
                  (metrics.scrollLeft / Math.max(metrics.maxScroll, 1)) *
                    (slideCount - 1)
                ) + 1
              )
            );

      setSliderMeta((prev) => {
        const value = Math.round(metrics.scrollLeft);
        const max = Math.max(0, Math.round(metrics.maxScroll));
        if (
          prev.value === value &&
          prev.max === max &&
          prev.positionIndex === positionIndex
        ) {
          return prev;
        }
        return { value, max, positionIndex };
      });
    },
    [slideCount]
  );

  const syncScrollState = useCallback(
    ({ forceMeta = false } = {}) => {
      const metrics = readMetrics();
      metricsRef.current = metrics;

      const nextOverflow = metrics.maxScroll > EDGE_EPS;
      const nextPrev = metrics.scrollLeft > EDGE_EPS;
      const nextNext = metrics.scrollLeft < metrics.maxScroll - EDGE_EPS;

      updateThumbDom(metrics);

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

      if (forceMeta) {
        if (metaTimerRef.current) {
          window.clearTimeout(metaTimerRef.current);
          metaTimerRef.current = 0;
        }
        publishSliderMeta(metrics);
        return;
      }

      if (!nextOverflow) return;

      if (metaTimerRef.current) {
        window.clearTimeout(metaTimerRef.current);
      }
      metaTimerRef.current = window.setTimeout(() => {
        metaTimerRef.current = 0;
        publishSliderMeta(metricsRef.current);
      }, 120);
    },
    [publishSliderMeta, readMetrics, updateThumbDom]
  );

  const scheduleSync = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      syncScrollState();
    });
  }, [syncScrollState]);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return undefined;

    syncScrollState({ forceMeta: true });

    const onScroll = () => {
      scheduleSync();
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncScrollState({ forceMeta: true });
      });
      resizeObserver.observe(el);
    }

    const onWindowResize = () => {
      syncScrollState({ forceMeta: true });
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onWindowResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (metaTimerRef.current) {
        window.clearTimeout(metaTimerRef.current);
        metaTimerRef.current = 0;
      }
    };
  }, [scheduleSync, syncScrollState, slideCount, skeleton, variant]);

  useLayoutEffect(() => {
    if (!showProgress) return;
    updateThumbDom(metricsRef.current);
  }, [showProgress, updateThumbDom]);

  const getSlideTargets = useCallback(() => {
    const el = rowRef.current;
    if (!el) return [];

    const rowLeft = el.getBoundingClientRect().left;
    const scrollLeft = el.scrollLeft;

    return Array.from(el.querySelectorAll('.catalog-showcase__slide')).map(
      (slide) =>
        slide.getBoundingClientRect().left - rowLeft + scrollLeft
    );
  }, []);

  const scrollByDir = useCallback(
    (dir) => {
      const el = rowRef.current;
      if (!el) return;

      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (maxScroll <= EDGE_EPS) return;

      const targets = getSlideTargets();
      const current = el.scrollLeft;
      let target = current;

      if (dir > 0) {
        const next = targets.find((left) => left > current + EDGE_EPS);
        target = next != null ? next : maxScroll;
      } else {
        const prev = [...targets]
          .reverse()
          .find((left) => left < current - EDGE_EPS);
        target = prev != null ? prev : 0;
      }

      /* Fallback, если позиции слайдов выродились */
      if (Math.abs(target - current) <= EDGE_EPS) {
        const slide = el.querySelector('.catalog-showcase__slide');
        const styles = getComputedStyle(el);
        const gap = parseFloat(styles.columnGap || styles.gap) || 0;
        const step = slide
          ? slide.getBoundingClientRect().width + gap
          : el.clientWidth * 0.85;
        target = current + dir * step;
      }

      target = Math.min(maxScroll, Math.max(0, target));
      if (Math.abs(target - current) <= EDGE_EPS) return;

      el.scrollTo({ left: target, behavior: getScrollBehavior() });
    },
    [getSlideTargets]
  );

  const scrollToRatio = useCallback((ratio, behavior = 'auto') => {
    const el = rowRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const next = Math.min(max, Math.max(0, ratio * max));
    el.scrollTo({ left: next, behavior });
  }, []);

  const handleRowKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByDir(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByDir(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      rowRef.current?.scrollTo({ left: 0, behavior: getScrollBehavior() });
    } else if (event.key === 'End') {
      event.preventDefault();
      const el = rowRef.current;
      if (!el) return;
      el.scrollTo({
        left: Math.max(0, el.scrollWidth - el.clientWidth),
        behavior: getScrollBehavior(),
      });
    }
  };

  const ratioFromClientX = (clientX) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleTrackPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    const track = trackRef.current;
    if (!track || !hasOverflow) return;

    event.preventDefault();
    scrollToRatio(ratioFromClientX(event.clientX), 'auto');

    dragRef.current = { pointerId: event.pointerId };
    track.setPointerCapture(event.pointerId);
  };

  const handleTrackPointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    scrollToRatio(ratioFromClientX(event.clientX), 'auto');
  };

  const endTrackDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    try {
      trackRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const handleSliderKeyDown = (event) => {
    if (!hasOverflow) return;
    const { maxScroll, clientWidth } = metricsRef.current;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      scrollByDir(-1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      scrollByDir(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      rowRef.current?.scrollTo({ left: 0, behavior: getScrollBehavior() });
    } else if (event.key === 'End') {
      event.preventDefault();
      rowRef.current?.scrollTo({
        left: maxScroll,
        behavior: getScrollBehavior(),
      });
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      rowRef.current?.scrollBy({
        left: -clientWidth * 0.85,
        behavior: getScrollBehavior(),
      });
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      rowRef.current?.scrollBy({
        left: clientWidth * 0.85,
        behavior: getScrollBehavior(),
      });
    }
  };

  if (!skeleton && (!Array.isArray(items) || items.length === 0)) {
    return null;
  }

  const shelfClassName = [
    'catalog-showcase__shelf',
    isFeatured ? 'catalog-showcase__shelf--featured' : '',
    isFeatured ? 'catalog-showcase__shelf--hits' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={shelfClassName} aria-label={title}>
      {title || (viewAllLabel && onViewAll) ? (
        <div className="catalog-showcase__shelf-header">
          {title ? (
            <h3 className="catalog-showcase__shelf-title">{title}</h3>
          ) : (
            <span />
          )}
          {viewAllLabel && typeof onViewAll === 'function' ? (
            <button
              type="button"
              className="catalog-showcase__shelf-all"
              onClick={onViewAll}
            >
              {viewAllLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="catalog-showcase__viewport">
        {reserveNav ? (
          <button
            type="button"
            className="catalog-showcase__nav catalog-showcase__nav--prev"
            aria-label="Предыдущие позиции"
            disabled={!canPrev || !hasOverflow}
            aria-hidden={!hasOverflow ? true : undefined}
            tabIndex={hasOverflow ? 0 : -1}
            onClick={() => scrollByDir(-1)}
          >
            <LeftOutlined aria-hidden="true" />
          </button>
        ) : null}

        <div
          ref={rowRef}
          className={[
            'catalog-showcase__row',
            canPrev ? 'catalog-showcase__row--fade-start' : '',
            canNext ? 'catalog-showcase__row--fade-end' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          tabIndex={0}
          aria-label={title}
          onKeyDown={handleRowKeyDown}
        >
          {skeleton
            ? Array.from({ length: skeletonCount }, (_, index) => (
                <div
                  key={`sk-${index}`}
                  className="catalog-showcase__slide catalog-showcase__slide--skeleton"
                  aria-hidden="true"
                >
                  <div className="catalog-showcase__skeleton-card" />
                </div>
              ))
            : items.map((item) => (
                <div key={item.id} className="catalog-showcase__slide">
                  {renderCard(item, { isClientMode })}
                </div>
              ))}
        </div>

        {reserveNav ? (
          <button
            type="button"
            className="catalog-showcase__nav catalog-showcase__nav--next"
            aria-label="Следующие позиции"
            disabled={!canNext || !hasOverflow}
            aria-hidden={!hasOverflow ? true : undefined}
            tabIndex={hasOverflow ? 0 : -1}
            onClick={() => scrollByDir(1)}
          >
            <RightOutlined aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {showProgress ? (
        <div className="catalog-showcase__progress">
          <div
            ref={trackRef}
            id={sliderId}
            className="catalog-showcase__progress-track"
            role="slider"
            tabIndex={0}
            aria-label={
              title ? `Позиция в полке «${title}»` : 'Позиция в полке'
            }
            aria-valuemin={0}
            aria-valuemax={sliderMeta.max}
            aria-valuenow={sliderMeta.value}
            aria-valuetext={`${sliderMeta.positionIndex} из ${slideCount}`}
            onKeyDown={handleSliderKeyDown}
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={endTrackDrag}
            onPointerCancel={endTrackDrag}
          >
            <span
              ref={thumbRef}
              className="catalog-showcase__progress-thumb"
              aria-hidden="true"
            />
          </div>
          <span className="catalog-showcase__sr-only" aria-live="polite">
            {sliderMeta.positionIndex} из {slideCount}
          </span>
        </div>
      ) : null}
    </section>
  );
};

export default ShowcaseShelf;
