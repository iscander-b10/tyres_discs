import { useEffect, useState } from 'react';

/**
 * Extra bottom inset equal to the on-screen keyboard overlap
 * (`innerHeight` vs `visualViewport`). Used by brand sheet and stacked
 * search filters so sticky chrome stays above iOS IME.
 *
 * @param {boolean} active
 * @returns {number}
 */
export function useVisualViewportBottomInset(active) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return undefined;
    }

    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const update = () => {
      const keyboard = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      setInset(keyboard);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [active]);

  return inset;
}
