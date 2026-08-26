import React from 'react';
import { Alert } from 'antd';
import { useAppShell } from '../../app/AppShellContext';
import { formatDemoCatalogDate } from '../../services/demoCatalog/demoCatalogService';
import './DemoCatalogBanner.scss';

function DemoCatalogBanner() {
  const { catalogSnapshotVersion } = useAppShell();
  const date = formatDemoCatalogDate(catalogSnapshotVersion);
  const message = date
    ? `Демо. Каталог на ${date}, остатки и цены не обновляются.`
    : 'Демо. Остатки и цены не обновляются.';

  return (
    <Alert
      className="demo-catalog-banner"
      type="info"
      showIcon
      banner
      message={message}
    />
  );
}

export default DemoCatalogBanner;
