import React, { useState } from 'react';
import { Flex, Layout, Tabs } from 'antd';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import SideBar from './components/SideBar/SideBar';
import './App.scss';

function App() {
  const [clientMode, setClientMode] = useState(true);
  const [activeKey, setActiveKey] = useState('tires');
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);

  return (
    <Layout className="app-layout">
      <Layout className="app-content-layout">
        <Layout.Content className="app-content">
          <Flex className="app-content-wrapper" vertical>
            <Tabs
              className="catalog-tabs"
              activeKey={activeKey}
              onChange={setActiveKey}
              destroyOnHidden={false}
              tabBarExtraContent={{
                right: (
                  <SideBar
                    clientMode={clientMode}
                    setClientMode={setClientMode}
                    onCatalogDataLoaded={() => setCatalogDataVersion((v) => v + 1)}
                  />
                ),
              }}
              items={[
                {
                  key: 'tires',
                  label: 'Шины',
                  children: (
                    <TiresSearchParameters
                      isClientMode={clientMode}
                      catalogDataVersion={catalogDataVersion}
                    />
                  ),
                },
                {
                  key: 'disks',
                  label: 'Диски',
                  children: (
                    <DiscsSearchParameters
                      isClientMode={clientMode}
                      catalogDataVersion={catalogDataVersion}
                    />
                  ),
                },
              ]}
            />
          </Flex>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export default App;
