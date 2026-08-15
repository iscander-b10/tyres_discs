import { SHOWCASE_CONFIG } from '../../../catalog/showcase';

/**
 * Static popular-size chips for showcase and search-empty.
 * @param {'tires' | 'discs'} kind
 * @param {{ tryHint?: boolean }} [options]
 */
export const getShowcaseStaticChips = (kind, { tryHint = false } = {}) => {
  const isDiscs = kind === 'discs';
  return {
    chips: isDiscs
      ? SHOWCASE_CONFIG.discs.popularSizes
      : SHOWCASE_CONFIG.tires.popularSizes,
    chipsTitle: tryHint
      ? SHOWCASE_CONFIG.copy.trySizes
      : SHOWCASE_CONFIG.copy.popularSizes,
  };
};
