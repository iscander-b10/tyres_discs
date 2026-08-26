/**
 * Scroll the window to the top. Honours prefers-reduced-motion unless
 * `behavior` is passed explicitly.
 * @param {{ behavior?: ScrollBehavior }} [options]
 */
export function scrollWindowToTop({ behavior } = {}) {
  const resolvedBehavior =
    behavior ??
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth');
  window.scrollTo({ top: 0, behavior: resolvedBehavior });
}
