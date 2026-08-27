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
