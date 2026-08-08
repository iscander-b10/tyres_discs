import React, { useState } from 'react';
import { Flex, Layout } from 'antd';
import SiteHeader from './components/SiteHeader/SiteHeader';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import SideBar from './components/SideBar/SideBar';
import './App.scss';

function App({ appearance = 'light', onAppearanceChange }) {
  const [clientMode, setClientMode] = useState(true);
  const [activeKey, setActiveKey] = useState('tires');
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);

  return (
    <Layout className="app-layout">
      <SiteHeader
        appearance={appearance}
        onAppearanceChange={onAppearanceChange}
        activeKey={activeKey}
        onActiveKeyChange={setActiveKey}
      />

      <Layout className="app-content-layout">
        <Layout.Content className="app-content">
          <Flex className="app-content-wrapper" vertical>
            {activeKey === 'tires' ? (
              <TiresSearchParameters
                isClientMode={clientMode}
                catalogDataVersion={catalogDataVersion}
              />
            ) : (
              <DiscsSearchParameters
                isClientMode={clientMode}
                catalogDataVersion={catalogDataVersion}
              />
            )}
          </Flex>
        </Layout.Content>
      </Layout>

      <SideBar
        clientMode={clientMode}
        setClientMode={setClientMode}
        onCatalogDataLoaded={() => setCatalogDataVersion((v) => v + 1)}
      />
    </Layout>
  );
}

export default App;
