import { useEffect } from 'react';
import {
  animateScrollTo,
  collectLandingSlides,
  durationFor,
  innerCanConsume,
  isTypingTarget,
  slideIndexFromScroll,
  slideScrollTop,
  syncSlideOverflow,
} from './landingSnap';

/**
 * Полноэкранный snap-скролл секций лендинга.
 * Референс: presentation/deck.js — один жест / один слайд, внутренний
 * overflow у высоких слайдов, без hijack при prefers-reduced-motion.
 */
export function useLandingSnap(deckRef) {
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return undefined;

    const reduceMotion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : {
            matches: false,
            addEventListener() {},
            removeEventListener() {},
          };
    const hasScrollEnd = 'onscrollend' in window;
    let slides = collectLandingSlides(deck);
    let index = 0;
    let programmatic = false;
    let wheelLock = false;
    let settleTimer = 0;
    let travelGen = 0;
    let touchY = 0;
    let unmounted = false;

    function prefersReduce() {
      return reduceMotion.matches;
    }

    function setSnap(on) {
      if (prefersReduce()) {
        deck.style.scrollSnapType = 'none';
        return;
      }
      deck.style.scrollSnapType = on ? '' : 'none';
    }

    function setSlideSize() {
      deck.style.setProperty('--landing-slide-size', `${deck.clientHeight}px`);
    }

    function refreshSlides() {
      slides = collectLandingSlides(deck);
      setSlideSize();
      syncSlideOverflow(slides);
    }

    function slideFromScroll() {
      return slideIndexFromScroll(deck, slides);
    }

    function intendedIndex() {
      return programmatic ? index : slideFromScroll();
    }

    function markActive(i) {
      slides.forEach((slide, n) => {
        slide.classList.toggle('is-active', n === i);
      });
    }

    function scrollToSlide(i, instant, fromIndex) {
      const top = slides[i] ? slideScrollTop(deck, slides[i]) : 0;
      if (instant || prefersReduce()) {
        setSnap(true);
        deck.scrollTo({ top, behavior: 'auto' });
        return Promise.resolve(travelGen);
      }

      const gen = (travelGen += 1);
      setSnap(false);
      return animateScrollTo(deck, top, durationFor(fromIndex, i), {
        shouldAbort: () => unmounted || gen !== travelGen,
      }).then(() => {
        if (gen === travelGen) setSnap(true);
        return gen;
      });
    }

    function go(next, { instant = false } = {}) {
      if (next < 0 || next >= slides.length) return;
      const here = slideFromScroll();
      if (next === here && !instant && !programmatic) {
        index = next;
        markActive(next);
        return;
      }

      index = next;
      markActive(next);
      programmatic = true;
      window.clearTimeout(settleTimer);

      const travel = scrollToSlide(next, instant, here);
      if (instant || prefersReduce()) {
        programmatic = false;
        return;
      }

      travel.then((gen) => {
        if (gen !== travelGen || unmounted) return;
        programmatic = false;
        index = slideFromScroll();
        markActive(index);
        wheelLock = true;
        window.setTimeout(() => {
          wheelLock = false;
        }, 160);
      });
    }

    function onScrollEnd() {
      if (programmatic || prefersReduce()) return;
      window.clearTimeout(settleTimer);
      const next = slideFromScroll();
      index = next;
      markActive(next);
    }

    function armScrollEnd() {
      if (programmatic) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(onScrollEnd, 90);
    }

    function onScroll() {
      if (!programmatic) {
        const i = slideFromScroll();
        if (i !== index) {
          index = i;
          markActive(i);
        }
      }
      if (!hasScrollEnd) armScrollEnd();
    }

    function isBlocked() {
      return Boolean(deck.closest('[inert]'));
    }

    function onKeyDown(e) {
      if (prefersReduce() || isBlocked()) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === ' ' && e.target.closest('a, button')) return;

      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageDown' ||
        e.key === ' '
      ) {
        e.preventDefault();
        go(intendedIndex() + 1);
      } else if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowLeft' ||
        e.key === 'PageUp'
      ) {
        e.preventDefault();
        go(intendedIndex() - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        go(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        go(slides.length - 1);
      }
    }

    function onWheel(e) {
      if (prefersReduce() || isBlocked()) return;
      const overflowSlide = e.target.closest('.is-overflow');
      if (innerCanConsume(overflowSlide, e.deltaY)) return;
      e.preventDefault();
      if (programmatic || wheelLock) return;
      if (Math.abs(e.deltaY) < 6) return;
      go(intendedIndex() + (e.deltaY > 0 ? 1 : -1));
    }

    function onTouchStart(e) {
      touchY = e.touches[0].clientY;
    }

    function onTouchMove(e) {
      if (prefersReduce() || isBlocked()) return;
      const dy = touchY - e.touches[0].clientY;
      const overflowSlide = e.target.closest('.is-overflow');
      if (!programmatic && innerCanConsume(overflowSlide, dy)) return;
      if (programmatic || Math.abs(dy) > 10) e.preventDefault();
    }

    function onTouchEnd(e) {
      if (prefersReduce() || programmatic || isBlocked()) return;
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 40) return;
      const overflowSlide = e.target.closest('.is-overflow');
      if (innerCanConsume(overflowSlide, dy)) return;
      go(intendedIndex() + (dy > 0 ? 1 : -1));
    }

    function onResize() {
      refreshSlides();
      go(slideFromScroll(), { instant: true });
    }

    refreshSlides();
    markActive(0);

    deck.addEventListener('scroll', onScroll, { passive: true });
    deck.addEventListener('scrollend', onScrollEnd);
    deck.addEventListener('wheel', onWheel, { passive: false });
    deck.addEventListener('touchstart', onTouchStart, { passive: true });
    deck.addEventListener('touchmove', onTouchMove, { passive: false });
    deck.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    reduceMotion.addEventListener('change', onResize);

    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            refreshSlides();
          })
        : null;
    if (resizeObserver) {
      resizeObserver.observe(deck);
      slides.forEach((slide) => resizeObserver.observe(slide));
    }

    return () => {
      unmounted = true;
      travelGen += 1;
      window.clearTimeout(settleTimer);
      setSnap(true);
      deck.removeEventListener('scroll', onScroll);
      deck.removeEventListener('scrollend', onScrollEnd);
      deck.removeEventListener('wheel', onWheel);
      deck.removeEventListener('touchstart', onTouchStart);
      deck.removeEventListener('touchmove', onTouchMove);
      deck.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      reduceMotion.removeEventListener('change', onResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [deckRef]);
}
