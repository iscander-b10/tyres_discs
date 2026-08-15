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
 * Manager (default): three stacked rows — B2B / Internet / store.
 * Client: store price only.
 */
function CatalogPriceStrip({ item, isClientMode = false, className = '' }) {
  const cells = useMemo(
    () => getCatalogPriceStripItems(item, { isClientMode }),
    [item, isClientMode]
  );

  if (!item || cells.length === 0) return null;

  const modeClass = isClientMode
    ? 'catalog-price-strip--client'
    : 'catalog-price-strip--manager';
  const rootClassName = ['catalog-price-strip', modeClass, className]
    .filter(Boolean)
    .join(' ');
  const groupAria =
    cells.length === 1
      ? `${cells[0].label}: ${cells[0].value}`
      : cells.map((cell) => `${cell.label}: ${cell.value}`).join(', ') || 'Цены';

  return (
    <div className={rootClassName} role="group" aria-label={groupAria}>
      {cells.map((cell) => (
        <PriceTile key={cell.key} cell={cell} />
      ))}
    </div>
  );
}

export default CatalogPriceStrip;
