import { SHOWCASE_CONFIG } from './showcaseConfig';

/**
 * Чистые правила витрины дисков (без JSX).
 * Полки карточек не строим — только чипы популярных диаметров.
 * @param {{ isEmpty: boolean }} input
 */
export const buildDiscShowcase = ({
  isEmpty,
}) => {
  const cfg = SHOWCASE_CONFIG.discs;
  const copy = SHOWCASE_CONFIG.copy;

  return {
    kind: 'discs',
    empty: Boolean(isEmpty),
    chips: cfg.popularDiameters,
    chipsTitle: copy.popularDiameters,
    shelves: [],
  };
};
