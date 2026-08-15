import React from 'react';
import { Empty } from 'antd';
import ShowcaseSizeChips from './ShowcaseSizeChips';
import { getShowcaseStaticChips } from './showcaseChips';
import './CatalogShowcase.scss';

/**
 * Empty поиска + чипы «попробуйте» (после неуспешного поиска).
 */
const CatalogSearchEmptyHint = ({
  kind = 'tires',
  emptyText,
  onChipClick,
}) => {
  const { chips, chipsTitle } = getShowcaseStaticChips(kind, { tryHint: true });

  return (
    <div className="catalog-showcase catalog-showcase--search-empty">
      <div className="catalog-showcase__search-empty-main">
        <Empty description={emptyText} />
      </div>
      <ShowcaseSizeChips
        title={chipsTitle}
        chips={chips}
        onChipClick={onChipClick}
        ariaLabel={chipsTitle}
      />
    </div>
  );
};

export default CatalogSearchEmptyHint;
