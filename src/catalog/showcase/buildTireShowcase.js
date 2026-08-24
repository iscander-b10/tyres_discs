import { SHOWCASE_CONFIG, getCatalogSeasonFromDate } from './showcaseConfig';
import { isStocked } from './scoring';
import { pickMixedSeasonHits } from './ikonSeasonHits';

const clampCount = ({ min, max }, available) => {
  if (available <= 0) return 0;
  return Math.min(max, Math.max(min, available));
};

/**
 * Чистые правила витрины шин (без JSX).
 * Полка «Сейчас в сезоне»: уникальные Ikon (whitelist) + остальные (Шинсервис), до 30.
 * Порядок — seeded shuffle (один seed на snapshot.version).
 * @param {{ candidates: object[], isEmpty: boolean, now?: Date, seed?: string|number }} input
 */
export const buildTireShowcase = ({
  candidates,
  isEmpty,
  now = new Date(),
  seed,
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
  const whitelist =
    season === 'w' ? cfg.ikonSeasonModelsWinter : cfg.ikonSeasonModelsSummer;

  const seasonHits = pickMixedSeasonHits({
    pool,
    season,
    limit: seasonHitsLimit,
    whitelist,
    seed,
  });

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
