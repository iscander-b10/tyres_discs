import React from 'react';
import { Flex, Switch, Tooltip } from 'antd';
import LoadingData from '../LoadingData/LoadingData';
import './SideBar.scss';

function SideBar({ clientMode, setClientMode, onCatalogDataLoaded }) {
  return (
    <Flex className="header-controls" align="center" gap={8}>
      <Tooltip title="Загрузить данные" placement="bottom">
        <Flex className="control-button" align="center" justify="center">
          <LoadingData onDataLoaded={onCatalogDataLoaded} />
        </Flex>
      </Tooltip>

      <Tooltip title={clientMode ? 'Режим клиента' : 'Режим менеджера'} placement="bottom">
        <Switch
          className="client-mode-switch"
          checked={clientMode}
          onChange={setClientMode}
        />
      </Tooltip>
    </Flex>
  );
}

export default SideBar;