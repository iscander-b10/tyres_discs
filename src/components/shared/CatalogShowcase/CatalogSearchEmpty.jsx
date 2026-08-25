import React from 'react';
import { Button } from 'antd';
import { FileSearchOutlined } from '@ant-design/icons';
import { ReactComponent as ResetIcon } from '../../../icons/Reset.svg';
import './CatalogSearchEmpty.scss';

const DEFAULT_TITLE = 'Ничего не найдено';
const DEFAULT_DESCRIPTION =
  'По этим фильтрам нет позиций. Сбросьте параметры или выберите другой размер ниже.';

const defaultActionIcon = (
  <ResetIcon className="catalog-search-empty__reset-icon" aria-hidden />
);

/**
 * Компактный empty после неуспешного поиска: иконка, заголовок, подсказка, CTA.
 */
const CatalogSearchEmpty = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onResetFilters,
  resetLabel = 'Сбросить фильтры',
  actionIcon = defaultActionIcon,
  className = '',
}) => {
  const rootClassName = ['catalog-search-empty', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} role="status">
      <div className="catalog-search-empty__icon" aria-hidden="true">
        <FileSearchOutlined className="catalog-search-empty__icon-glyph" />
      </div>
      <h2 className="catalog-search-empty__title">{title}</h2>
      <p className="catalog-search-empty__description">{description}</p>
      {typeof onResetFilters === 'function' ? (
        <Button
          type="default"
          htmlType="button"
          className="catalog-search-empty__reset"
          icon={actionIcon}
          onClick={onResetFilters}
        >
          {resetLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default CatalogSearchEmpty;
