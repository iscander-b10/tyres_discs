import React from 'react';

/**
 * Чипы популярных размеров / диаметров.
 * Клик вызывает существующий поиск через onChipClick(chip).
 */
const ShowcaseSizeChips = ({
  title,
  chips = [],
  onChipClick,
  ariaLabel,
}) => {
  if (!Array.isArray(chips) || chips.length === 0) return null;

  return (
    <section className="catalog-showcase__chips" aria-label={ariaLabel || title}>
      {title ? <h3 className="catalog-showcase__chips-title">{title}</h3> : null}
      <div className="catalog-showcase__chips-scroll">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="catalog-showcase__chip"
            onClick={() => onChipClick?.(chip)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
};

export default ShowcaseSizeChips;
