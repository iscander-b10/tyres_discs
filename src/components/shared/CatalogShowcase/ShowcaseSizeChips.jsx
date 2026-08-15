import React from 'react';

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

  const chipClassName =
    kind === 'discs'
      ? 'catalog-showcase__chip catalog-showcase__chip--discs'
      : 'catalog-showcase__chip';

  return (
    <section className="catalog-showcase__chips" aria-label={ariaLabel || title}>
      {title ? <h3 className="catalog-showcase__chips-title">{title}</h3> : null}
      <div className="catalog-showcase__chips-scroll">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={chipClassName}
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
