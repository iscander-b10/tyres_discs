import { SHOWCASE_CONFIG, getCatalogSeasonFromDate } from './showcaseConfig';
import { isStocked, pickTopDiverse, scoreCatalogItem } from './scoring';

const clampCount = ({ min, max }, available) => {
  if (available <= 0) return 0;
  return Math.min(max, Math.max(min, available));
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

  const seasonHitsLimit = clampCount(cfg.seasonHitsCount, seasonPool.length || stocked.length);
  const seasonHits = pickTopDiverse(
    seasonPool.length > 0 ? seasonPool : stocked,
    scoreCatalogItem,
    seasonHitsLimit
  );

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
