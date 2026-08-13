import React, { useRef } from 'react';

/**
 * Горизонтальная полка карточек (scroll-snap).
 * Общий рендерер для шин и дисков.
 */
const ShowcaseShelf = ({
  title,
  items = [],
  renderCard,
  isClientMode,
  skeleton = false,
  skeletonCount = 6,
}) => {
  const scrollerRef = useRef(null);

  if (!skeleton && (!Array.isArray(items) || items.length === 0)) {
    return null;
  }

  return (
    <section className="catalog-showcase__shelf" aria-label={title}>
      {title ? (
        <div className="catalog-showcase__shelf-header">
          <h3 className="catalog-showcase__shelf-title">{title}</h3>
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        className="catalog-showcase__row"
        tabIndex={0}
        aria-label={title}
      >
        {skeleton
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <div
                key={`sk-${index}`}
                className="catalog-showcase__slide catalog-showcase__slide--skeleton"
                aria-hidden="true"
              >
                <div className="catalog-showcase__skeleton-card" />
              </div>
            ))
          : items.map((item) => (
              <div key={item.id} className="catalog-showcase__slide">
                {renderCard(item, { isClientMode })}
              </div>
            ))}
      </div>
    </section>
  );
};

export default ShowcaseShelf;
