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
 * showChannelTable: equal B2B / Internet / store rows (optional override).
 */
function CatalogPriceStrip({
  item,
  isClientMode = false,
  showChannelTable = false,
  className = '',
}) {
  const cells = useMemo(
    () =>
      getCatalogPriceStripItems(item, {
        isClientMode: isClientMode && !showChannelTable,
        tableLabels: Boolean(showChannelTable),
      }),
    [item, isClientMode, showChannelTable]
  );

  if (!item || cells.length === 0) return null;

  const b2bCell = cells.find((cell) => cell.key === 'b2b');
  const websiteCell = cells.find((cell) => cell.key === 'website');
  const storeCell = cells.find((cell) => cell.key === 'selling');
  const modeClass =
    showChannelTable || !isClientMode
      ? 'catalog-price-strip--manager'
      : 'catalog-price-strip--client';
  const rootClassName = ['catalog-price-strip', modeClass, className]
    .filter(Boolean)
    .join(' ');

  // Store only: client mode (catalog, modal, basket).
  if (isClientMode && !showChannelTable && storeCell) {
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

  const channelAria = [b2bCell, websiteCell, storeCell]
    .filter(Boolean)
    .map((cell) => `${cell.label}: ${cell.value}`)
    .join(', ');

  return (
    <div
      className={rootClassName}
      role="group"
      aria-label={channelAria || 'Цены'}
    >
      {b2bCell ? (
        <PriceTile
          cell={{
            ...b2bCell,
            primary: showChannelTable ? false : b2bCell.primary,
          }}
        />
      ) : null}
      {websiteCell ? (
        <PriceTile
          cell={{
            ...websiteCell,
            primary: showChannelTable ? false : websiteCell.primary,
          }}
        />
      ) : null}
      {storeCell ? (
        <PriceTile
          cell={{
            ...storeCell,
            primary: showChannelTable ? false : storeCell.primary,
          }}
        />
      ) : null}
    </div>
  );
}

export default CatalogPriceStrip;
