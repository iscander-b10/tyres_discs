import React, { useMemo } from 'react';
import { ReactComponent as TireFittingGiftIcon } from '../../../icons/TireFittingGift.svg';
import HoverTooltip from '../HoverTooltip';
import {
  IKON_PROMO_LABELS,
  resolveIkonPromoBadges,
} from '../ikonPromoBadges';
import './CatalogItemPromoBadges.scss';

/**
 * Promo overlays for catalog photo frames (card + modal). Not used in basket.
 * Gift only for Ikon brand — no warranty badges.
 * @param {'card' | 'modal'} variant
 */
const CatalogItemPromoBadges = ({ item, variant = 'card' }) => {
  const badges = useMemo(() => resolveIkonPromoBadges(item), [item]);

  if (!badges.showGift) return null;

  return (
    <div className={`catalog-promo-badges catalog-promo-badges--${variant}`}>
      <HoverTooltip title={IKON_PROMO_LABELS.gift} placement="left">
        <span
          className="catalog-promo-badges__badge catalog-promo-badges__gift"
          role="img"
          aria-label={IKON_PROMO_LABELS.gift}
        >
          <TireFittingGiftIcon
            className="catalog-promo-badges__icon"
            aria-hidden="true"
            focusable="false"
          />
        </span>
      </HoverTooltip>
    </div>
  );
};

export default CatalogItemPromoBadges;
