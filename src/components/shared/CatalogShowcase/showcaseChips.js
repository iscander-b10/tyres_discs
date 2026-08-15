import { SHOWCASE_CONFIG } from '../../../catalog/showcase';

/**
 * Static popular-size / diameter chips for showcase and search-empty.
 * @param {'tires' | 'discs'} kind
 * @param {{ tryHint?: boolean }} [options]
 */
export const getShowcaseStaticChips = (kind, { tryHint = false } = {}) => {
  const isDiscs = kind === 'discs';
  return {
    chips: isDiscs
      ? SHOWCASE_CONFIG.discs.popularDiameters
      : SHOWCASE_CONFIG.tires.popularSizes,
    chipsTitle: tryHint
      ? isDiscs
        ? SHOWCASE_CONFIG.copy.tryDiameters
        : SHOWCASE_CONFIG.copy.trySizes
      : isDiscs
        ? SHOWCASE_CONFIG.copy.popularDiameters
        : SHOWCASE_CONFIG.copy.popularSizes,
  };
};
