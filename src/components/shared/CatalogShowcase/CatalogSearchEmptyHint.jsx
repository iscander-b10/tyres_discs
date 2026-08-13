import React from 'react';
import { Empty } from 'antd';
import ShowcaseSizeChips from './ShowcaseSizeChips';
import { SHOWCASE_CONFIG } from '../../../catalog/showcase';
import './CatalogShowcase.scss';

/**
 * Empty поиска + чипы «попробуйте» (после неуспешного поиска).
 */
const CatalogSearchEmptyHint = ({
  kind = 'tires',
  emptyText,
  onChipClick,
}) => {
  const chips =
    kind === 'discs'
      ? SHOWCASE_CONFIG.discs.popularDiameters
      : SHOWCASE_CONFIG.tires.popularSizes;
  const chipsTitle =
    kind === 'discs'
      ? SHOWCASE_CONFIG.copy.tryDiameters
      : SHOWCASE_CONFIG.copy.trySizes;

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
