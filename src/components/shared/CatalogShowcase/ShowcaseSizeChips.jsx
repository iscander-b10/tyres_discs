import React from 'react';
import { formatCatalogSizeDisplay } from '../catalogCopy';

/**
 * Чипы популярных размеров (шины / диски).
 * Клик вызывает существующий поиск через onChipClick(chip).
 */
const ShowcaseSizeChips = ({
  title,
  chips = [],
  onChipClick,
  ariaLabel,
  kind = 'tires',
}) => {
  if (!Array.isArray(chips) || chips.length === 0) return null;

  const isDiscs = kind === 'discs';
  const sectionClassName = isDiscs
    ? 'catalog-showcase__chips catalog-showcase__chips--discs'
    : 'catalog-showcase__chips catalog-showcase__chips--tires';

  return (
    <section className={sectionClassName} aria-label={ariaLabel || title}>
      {title ? <h3 className="catalog-showcase__chips-title">{title}</h3> : null}
      <div className="catalog-showcase__chips-flow">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={
              isDiscs
                ? 'catalog-showcase__chip catalog-showcase__chip--discs'
                : 'catalog-showcase__chip catalog-showcase__chip--tires'
            }
            aria-label={chip.label}
            onClick={() => onChipClick?.(chip)}
          >
            {isDiscs ? <DiscChipLabel chip={chip} /> : <TireChipLabel chip={chip} />}
          </button>
        ))}
      </div>
    </section>
  );
};

const TireChipLabel = ({ chip }) => {
  const size = formatCatalogSizeDisplay(chip);
  if (!size) return chip.label;

  return <span className="catalog-showcase__chip-primary">{size}</span>;
};

const DiscChipLabel = ({ chip }) => {
  if (!chip.diameter || chip.pn == null || chip.pcd == null || chip.cb == null) {
    return chip.label;
  }

  return (
    <>
      <span className="catalog-showcase__chip-primary">{chip.diameter}</span>
      <span className="catalog-showcase__chip-sep" aria-hidden="true">
        ·
      </span>
      <span className="catalog-showcase__chip-metric">
        {chip.pn}×{chip.pcd}
      </span>
      <span className="catalog-showcase__chip-sep" aria-hidden="true">
        ·
      </span>
      <span className="catalog-showcase__chip-metric">{chip.cb}</span>
    </>
  );
};

export default ShowcaseSizeChips;
