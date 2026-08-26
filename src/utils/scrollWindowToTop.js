/**
 * @param {ScrollBehavior | undefined} behavior
 * @returns {ScrollBehavior}
 */
function resolveScrollBehavior(behavior) {
  return (
    behavior ??
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth')
  );
}

/**
 * Scroll the window to the top. Honours prefers-reduced-motion unless
 * `behavior` is passed explicitly.
 * @param {{ behavior?: ScrollBehavior }} [options]
 */
export function scrollWindowToTop({ behavior } = {}) {
  window.scrollTo({ top: 0, behavior: resolveScrollBehavior(behavior) });
}

/**
 * Scroll an element into view after an optional delay (e.g. CatalogResultsFade
 * swap). Honours prefers-reduced-motion unless `behavior` is passed explicitly.
 * Returns a cancel function for the pending timeout.
 *
 * @param {Element | null | undefined} element
 * @param {{
 *   behavior?: ScrollBehavior,
 *   block?: ScrollLogicalPosition,
 *   inline?: ScrollLogicalPosition,
 *   delayMs?: number,
 * }} [options]
 * @returns {() => void}
 */
export function scheduleScrollIntoView(
  element,
  { behavior, block = 'start', inline = 'nearest', delayMs = 0 } = {}
) {
  if (!element || typeof element.scrollIntoView !== 'function') {
    return () => {};
  }

  const run = () => {
    element.scrollIntoView({
      behavior: resolveScrollBehavior(behavior),
      block,
      inline,
    });
  };

  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    run();
    return () => {};
  }

  const timerId = window.setTimeout(run, delayMs);
  return () => window.clearTimeout(timerId);
}
