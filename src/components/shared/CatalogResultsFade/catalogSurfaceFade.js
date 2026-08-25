export const CATALOG_SURFACE_FADE_MS = 50;

export function prefersCatalogSurfaceFadeInstant() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
