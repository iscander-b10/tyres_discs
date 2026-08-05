import React from 'react';
import { Flex, Switch } from 'antd';
import LoadingData from '../LoadingData/LoadingData';
import HoverTooltip from '../shared/HoverTooltip';
import './SideBar.scss';

function SideBar({ clientMode, setClientMode, onCatalogDataLoaded }) {
  return (
    <aside className="floating-sidebar" aria-label="Служебные инструменты">
      <Flex className="header-controls" align="center" gap={8}>
        <Flex className="control-button" align="center" justify="center">
          <LoadingData onDataLoaded={onCatalogDataLoaded} />
        </Flex>

        <HoverTooltip
          title={clientMode ? 'Режим клиента' : 'Режим менеджера'}
          placement="top"
        >
          <Switch
            className="client-mode-switch"
            checked={clientMode}
            onChange={setClientMode}
            aria-label={clientMode ? 'Режим клиента' : 'Режим менеджера'}
          />
        </HoverTooltip>
      </Flex>
    </aside>
  );
}

export default SideBar;
