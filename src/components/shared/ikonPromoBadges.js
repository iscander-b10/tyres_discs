/** Promo badges for Ikon tyres — gift only (no warranty). */

import { isIkonBrand } from '../../catalog/core';

export { isIkonBrand };

export const IKON_PROMO_LABELS = {
  gift: 'Шиномонтаж в подарок',
};

const EMPTY_BADGES = Object.freeze({
  showGift: false,
});

/**
 * @returns {{ showGift: boolean }}
 */
export const resolveIkonPromoBadges = (item) => {
  if (!item || !isIkonBrand(item)) return EMPTY_BADGES;

  return { showGift: true };
};
