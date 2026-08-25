import React from 'react';
import { Spin } from 'antd';

/**
 * Явный статус под формой, пока foreground-поиск не settle.
 * Витрина / прошлые результаты при этом остаются на экране.
 */
const CatalogSearchStatus = ({ loading = false }) => {
  if (!loading) return null;

  return (
    <div
      className="catalog-search-status"
      role="status"
      aria-live="polite"
      aria-label="Ищем…"
      data-testid="catalog-search-status"
    >
      <Spin size="small" />
      <span>Ищем…</span>
    </div>
  );
};

export default CatalogSearchStatus;
