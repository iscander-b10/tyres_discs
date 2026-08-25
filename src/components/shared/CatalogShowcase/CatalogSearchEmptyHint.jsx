import React from 'react';
import CatalogSearchEmpty from './CatalogSearchEmpty';
import ShowcaseSizeChips from './ShowcaseSizeChips';
import { getShowcaseStaticChips } from './showcaseChips';
import './CatalogShowcase.scss';

/**
 * Empty поиска + чипы «попробуйте» (после неуспешного поиска).
 */
const CatalogSearchEmptyHint = ({
  kind = 'tires',
  onResetFilters,
  onChipClick,
}) => {
  const { chips, chipsTitle } = getShowcaseStaticChips(kind, { tryHint: true });

  return (
    <div className="catalog-showcase catalog-showcase--search-empty">
      <div className="catalog-showcase__search-empty-main">
        <CatalogSearchEmpty onResetFilters={onResetFilters} />
      </div>
      <ShowcaseSizeChips
        title={chipsTitle}
        chips={chips}
        kind={kind}
        onChipClick={onChipClick}
        ariaLabel={chipsTitle}
      />
    </div>
  );
};

export default CatalogSearchEmptyHint;
