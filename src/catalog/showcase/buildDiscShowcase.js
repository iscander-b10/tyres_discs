import { SHOWCASE_CONFIG } from './showcaseConfig';
import { isStocked, pickTopDiverse, scoreCatalogItem } from './scoring';

const clampCount = ({ min, max }, available) => {
  if (available <= 0) return 0;
  return Math.min(max, Math.max(min, available));
};

/**
 * Чистые правила витрины дисков (без JSX).
 * Зеркало полки «Сейчас в сезоне» у шин — без фильтра сезона.
 * @param {{ candidates: object[], isEmpty: boolean }} input
 */
export const buildDiscShowcase = ({
  candidates,
  isEmpty,
}) => {
  const cfg = SHOWCASE_CONFIG.discs;
  const copy = SHOWCASE_CONFIG.copy;

  if (isEmpty) {
    return {
      kind: 'discs',
      empty: true,
      chips: cfg.popularSizes,
      chipsTitle: copy.popularSizes,
      shelves: [],
    };
  }

  const stocked = candidates.filter((item) => isStocked(item, cfg.minAmount));
  // Только литые: штампы на полку «Литые диски в наличии» не выводим.
  const castPool = stocked.filter((item) => item.diskType === 'Литой');
  const popularLimit = clampCount(cfg.popularModelsCount, castPool.length);
  const popularModels = pickTopDiverse(
    castPool,
    scoreCatalogItem,
    popularLimit
  );

  const shelves = [];

  if (popularModels.length > 0) {
    shelves.push({
      id: 'popular-models',
      title: copy.popularModels,
      items: popularModels,
    });
  }

  return {
    kind: 'discs',
    empty: false,
    chips: cfg.popularSizes,
    chipsTitle: copy.popularSizes,
    shelves,
  };
};
