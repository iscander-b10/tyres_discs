import React, { useMemo } from 'react';
import { getCatalogPriceStripItems } from '../catalogCopy';
import './CatalogPriceStrip.scss';

const PriceTile = ({ cell }) => {
  const isPrimary = Boolean(cell.primary);

  return (
    <div
      className={[
        'catalog-price-strip__tile',
        isPrimary
          ? 'catalog-price-strip__tile--primary'
          : 'catalog-price-strip__tile--channel',
        `catalog-price-strip__tile--${cell.key}`,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${cell.label}: ${cell.value}`}
    >
      <span className="catalog-price-strip__caption" aria-hidden="true">
        {cell.label}
      </span>
      <span className="catalog-price-strip__value" aria-hidden="true">
        {cell.value}
      </span>
    </div>
  );
};

/**
 * Compact price presentation for catalog card, modal, and basket.
 * Manager: three stacked rows — label left, price right.
 * Client: «Цена» + our selling price.
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
        <PriceTile cell={storeCell} />
      </div>
    );
  }

  return (
    <div className={rootClassName} role="group" aria-label="Цены">
      {b2bCell ? <PriceTile cell={b2bCell} /> : null}
      {websiteCell ? <PriceTile cell={websiteCell} /> : null}
      {storeCell ? <PriceTile cell={storeCell} /> : null}
    </div>
  );
}

export default CatalogPriceStrip;
