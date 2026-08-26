import { useLayoutEffect, useState } from 'react';

/**
 * Layout modes for catalog search panels (tires / discs).
 *
 * - horizontal — toolbar above catalog, max ~2 wrapped rows
 * - sidebar — vertical form left (sticky) + catalog right
 * - stacked — vertical form above catalog (mobile)
 *
 * Breakpoint is calibrated on the denser discs form: below
 * CATALOG_SEARCH_HORIZONTAL_MIN_PX the discs toolbar needs a 3rd row.
 */
export const CATALOG_SEARCH_LAYOUT = {
  HORIZONTAL: 'horizontal',
  SIDEBAR: 'sidebar',
  STACKED: 'stacked',
};

/** Panel width at/above which a 2-row horizontal discs toolbar fits. */
export const CATALOG_SEARCH_HORIZONTAL_MIN_PX = 960;

/** Inclusive max width for stacked (mobile) layout. */
export const CATALOG_SEARCH_MOBILE_MAX_PX = 768;

/**
 * @param {number} panelWidthPx
 * @returns {'horizontal' | 'sidebar' | 'stacked'}
 */
export function resolveCatalogSearchFormLayout(panelWidthPx) {
  const width = Number(panelWidthPx);
  if (!Number.isFinite(width) || width <= CATALOG_SEARCH_MOBILE_MAX_PX) {
    return CATALOG_SEARCH_LAYOUT.STACKED;
  }
  if (width < CATALOG_SEARCH_HORIZONTAL_MIN_PX) {
    return CATALOG_SEARCH_LAYOUT.SIDEBAR;
  }
  return CATALOG_SEARCH_LAYOUT.HORIZONTAL;
}

/**
 * Tracks panel width and returns the catalog search layout mode.
 * @param {React.RefObject<HTMLElement | null>} rootRef
 * @returns {'horizontal' | 'sidebar' | 'stacked'}
 */
export function useCatalogSearchFormLayout(rootRef) {
  const [layout, setLayout] = useState(CATALOG_SEARCH_LAYOUT.HORIZONTAL);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const update = () => {
      setLayout(resolveCatalogSearchFormLayout(root.getBoundingClientRect().width));
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [rootRef]);

  return layout;
}
