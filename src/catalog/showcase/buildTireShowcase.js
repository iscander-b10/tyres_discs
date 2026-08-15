import { SHOWCASE_CONFIG, getCatalogSeasonFromDate } from './showcaseConfig';
import { isStocked, pickTopDiverse, scoreCatalogItem } from './scoring';

const clampCount = ({ min, max }, available) => {
  if (available <= 0) return 0;
  return Math.min(max, Math.max(min, available));
};

/**
 * Зимняя полка: и шипованные, и фрикционные (без фильтра по spikes).
 * При наличии обоих типов — примерно поровну слотов, остаток добираем из другого пула.
 */
const pickWinterHits = (pool, limit) => {
  const withSpikes = pool.filter((item) => item.spikes === true);
  const withoutSpikes = pool.filter((item) => item.spikes !== true);

  if (withSpikes.length === 0 || withoutSpikes.length === 0) {
    return pickTopDiverse(pool, scoreCatalogItem, limit);
  }

  const spikesSlots = Math.ceil(limit / 2);
  const frictionSlots = limit - spikesSlots;
  const fromSpikes = pickTopDiverse(withSpikes, scoreCatalogItem, spikesSlots);
  const fromFriction = pickTopDiverse(withoutSpikes, scoreCatalogItem, frictionSlots);
  const mixed = [...fromSpikes, ...fromFriction];

  if (mixed.length >= limit) return mixed.slice(0, limit);

  const usedIds = new Set(mixed.map((item) => item.id).filter((id) => id != null));
  const remainder = pickTopDiverse(
    pool.filter((item) => item.id == null || !usedIds.has(item.id)),
    scoreCatalogItem,
    limit - mixed.length
  );
  return [...mixed, ...remainder];
};

/**
 * Чистые правила витрины шин (без JSX).
 * @param {{ candidates: object[], isEmpty: boolean, now?: Date }} input
 */
export const buildTireShowcase = ({
  candidates,
  isEmpty,
  now = new Date(),
}) => {
  const cfg = SHOWCASE_CONFIG.tires;
  const copy = SHOWCASE_CONFIG.copy;
  const season = getCatalogSeasonFromDate(now);

  if (isEmpty) {
    return {
      kind: 'tires',
      empty: true,
      season,
      chips: cfg.popularSizes,
      chipsTitle: copy.popularSizes,
      shelves: [],
    };
  }

  const stocked = candidates.filter((item) => isStocked(item, cfg.minAmount));
  const seasonPool = stocked.filter((item) => item.season === season);
  const pool = seasonPool.length > 0 ? seasonPool : stocked;

  const seasonHitsLimit = clampCount(cfg.seasonHitsCount, pool.length);
  const seasonHits =
    season === 'w'
      ? pickWinterHits(pool, seasonHitsLimit)
      : pickTopDiverse(pool, scoreCatalogItem, seasonHitsLimit);

  const shelves = [];

  if (seasonHits.length > 0) {
    shelves.push({
      id: 'season-hits',
      title: copy.seasonHits,
      items: seasonHits,
    });
  }

  return {
    kind: 'tires',
    empty: false,
    season,
    chips: cfg.popularSizes,
    chipsTitle: copy.popularSizes,
    shelves,
  };
};
