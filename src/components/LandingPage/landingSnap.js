const OVERFLOW_PX = 2;
const SLIDE_MS = 720;
const SLIDE_MS_STEP = 70;
const SLIDE_MS_MAX = 1400;
const EASE_SLIDE = cubicBezier(0.4, 0, 0.6, 1);

export const LANDING_SLIDE_SELECTOR = '.landing-page__slide, .site-footer';

function cubicBezier(x1, y1, x2, y2) {
  function calc(t, a, b) {
    const mt = 1 - t;
    return 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t;
  }
  return function ease(x) {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const xEst = calc(t, x1, x2);
      const dx =
        3 * (1 - t) * (1 - t) * x1 +
        6 * (1 - t) * t * (x2 - x1) +
        3 * t * t * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      t = Math.max(0, Math.min(1, t - (xEst - x) / dx));
    }
    return calc(t, y1, y2);
  };
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function collectLandingSlides(deck) {
  if (!deck) return [];
  return Array.from(deck.querySelectorAll(LANDING_SLIDE_SELECTOR));
}

export function slideScrollTop(deck, slide) {
  return (
    slide.getBoundingClientRect().top -
    deck.getBoundingClientRect().top +
    deck.scrollTop
  );
}

export function slideIndexFromOffsets(scrollTop, offsets) {
  if (!offsets.length) return 0;
  let best = 0;
  let bestDist = Infinity;
  offsets.forEach((top, i) => {
    const dist = Math.abs(scrollTop - top);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

export function slideIndexFromScroll(deck, slides) {
  const offsets = slides.map((slide) => slideScrollTop(deck, slide));
  return slideIndexFromOffsets(deck.scrollTop, offsets);
}

export function durationFor(fromIndex, toIndex) {
  const steps = Math.max(1, Math.abs(toIndex - fromIndex));
  return Math.min(SLIDE_MS_MAX, SLIDE_MS + (steps - 1) * SLIDE_MS_STEP);
}

export function innerCanConsume(slide, dy) {
  if (!slide || !slide.classList.contains('is-overflow')) return false;
  const max = slide.scrollHeight - slide.clientHeight;
  if (max <= OVERFLOW_PX) return false;
  if (dy > 0) return slide.scrollTop < max - 1;
  if (dy < 0) return slide.scrollTop > 1;
  return false;
}

export function syncSlideOverflow(slides, overflowPx = OVERFLOW_PX) {
  slides.forEach((slide) => {
    const needs = slide.scrollHeight - slide.clientHeight > overflowPx;
    slide.classList.toggle('is-overflow', needs);
  });
}

export function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(el.isContentEditable);
}

export function animateScrollTo(deck, top, duration, { ease = EASE_SLIDE, shouldAbort } = {}) {
  const from = deck.scrollTop;
  if (Math.abs(from - top) < 1 || duration <= 0) {
    deck.scrollTop = top;
    return Promise.resolve();
  }

  const t0 = performance.now();
  let frame = 0;
  let settled = false;

  return new Promise((resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      if (frame) cancelAnimationFrame(frame);
      resolve();
    };
    const step = (now) => {
      if (shouldAbort && shouldAbort()) {
        finish();
        return;
      }
      const t = Math.min(1, (now - t0) / duration);
      deck.scrollTop = from + (top - from) * ease(t);
      if (t < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      deck.scrollTop = top;
      finish();
    };
    frame = requestAnimationFrame(step);
  });
}
