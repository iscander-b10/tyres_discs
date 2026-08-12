import React, { useMemo } from 'react';
import { ReactComponent as B2BIcon } from '../../../icons/B2B.svg';
import { ReactComponent as WebsiteIcon } from '../../../icons/Website.svg';
import HoverTooltip from '../HoverTooltip';
import {
  CATALOG_PRICE_TOOLTIPS,
  getCatalogPriceStripItems,
} from '../catalogCopy';
import './CatalogPriceStrip.scss';

const CHANNEL_ICONS = {
  b2b: B2BIcon,
  website: WebsiteIcon,
};

const PriceTile = ({ cell, showTooltip = false, showCaption = false }) => {
  const Icon = CHANNEL_ICONS[cell.key];
  const isPrimary = Boolean(cell.primary);
  const tooltipTitle = CATALOG_PRICE_TOOLTIPS[cell.key] ?? cell.label;
  const caption = showCaption ? `${cell.label}:` : null;

  const tile = (
    <div
      className={[
        'catalog-price-strip__tile',
        isPrimary
          ? 'catalog-price-strip__tile--primary'
          : 'catalog-price-strip__tile--channel',
        caption ? 'catalog-price-strip__tile--with-caption' : null,
        `catalog-price-strip__tile--${cell.key}`,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${tooltipTitle}: ${cell.value}`}
    >
      {caption ? (
        <span className="catalog-price-strip__caption" aria-hidden="true">
          {caption}
        </span>
      ) : null}
      {Icon ? (
        <span className="catalog-price-strip__icon" aria-hidden="true">
          <Icon
            className="catalog-price-strip__icon-svg"
            focusable="false"
          />
        </span>
      ) : null}
      <span className="catalog-price-strip__value" aria-hidden="true">
        {cell.value}
      </span>
    </div>
  );

  if (!showTooltip) return tile;

  return (
    <HoverTooltip title={tooltipTitle} placement="top">
      {tile}
    </HoverTooltip>
  );
};

/**
 * Compact price presentation for catalog card, modal, and basket.
 * Manager: soft price tiles (B2B + website) + store tile.
 * Client: same store tile styles with «Цена:» + our selling price.
 */
function CatalogPriceStrip({
  item,
  isClientMode = false,
  className = '',
}) {
  const cells = useMemo(
    () => getCatalogPriceStripItems(item, { isClientMode }),
    [item, isClientMode]
  );

  if (!item || cells.length === 0) return null;

  const b2bCell = cells.find((cell) => cell.key === 'b2b');
  const websiteCell = cells.find((cell) => cell.key === 'website');
  const storeCell = cells.find((cell) => cell.key === 'selling');
  const channelCells = [b2bCell, websiteCell].filter(Boolean);
  const modeClass = isClientMode
    ? 'catalog-price-strip--client'
    : 'catalog-price-strip--manager';
  const rootClassName = ['catalog-price-strip', modeClass, className]
    .filter(Boolean)
    .join(' ');

  if (isClientMode && storeCell) {
    return (
      <div
        className={rootClassName}
        role="group"
        aria-label={`${storeCell.label}: ${storeCell.value}`}
      >
        <PriceTile cell={storeCell} showCaption />
      </div>
    );
  }

  return (
    <div className={rootClassName} role="group" aria-label="Цены">
      {channelCells.length > 0 ? (
        <div className="catalog-price-strip__channels">
          {b2bCell ? (
            <div className="catalog-price-strip__channel">
              <PriceTile cell={b2bCell} showTooltip />
            </div>
          ) : null}
          {websiteCell ? (
            <div className="catalog-price-strip__channel">
              <PriceTile cell={websiteCell} showTooltip />
            </div>
          ) : null}
        </div>
      ) : null}
      {storeCell ? <PriceTile cell={storeCell} /> : null}
    </div>
  );
}

export default CatalogPriceStrip;
