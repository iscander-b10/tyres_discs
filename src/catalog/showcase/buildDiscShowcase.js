import { SHOWCASE_CONFIG } from './showcaseConfig';
import { isStocked } from './scoring';
import { shuffleItems } from './showcaseSeed';

const clampCount = ({ min, max }, available) => {
  if (available <= 0) return 0;
  return Math.min(max, Math.max(min, available));
};

/**
 * Чистые правила витрины дисков (без JSX).
 * Пул: все литые Шинсервиса с amount >= minAmount; на полку — seeded shuffle, первые N.
 * Без score-top / collapse brand+model / фильтра размера.
 * @param {{ candidates: object[], isEmpty: boolean, seed?: string|number }} input
 */
export const buildDiscShowcase = ({
  candidates,
  isEmpty,
  seed,
  showcaseSupplier = SHOWCASE_CONFIG.showcaseSupplier,
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
  // Только литые Шинсервиса: штампы и чужие поставщики на полку не выводим.
  const castPool = stocked.filter(
    (item) =>
      item.diskType === cfg.diskType &&
      item.supplier === showcaseSupplier
  );
  const popularLimit = clampCount(cfg.popularModelsCount, castPool.length);
  // Пул < лимита — показываем всё что есть, без добивки дублями/другими типами.
  const popularModels = shuffleItems(castPool, seed).slice(0, popularLimit);

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
