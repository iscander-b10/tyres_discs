import React, { useState } from 'react';
import { Flex, Layout } from 'antd';
import SiteHeader from './components/SiteHeader/SiteHeader';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import SideBar from './components/SideBar/SideBar';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import './App.scss';

function App({ appearance = 'light', onAppearanceChange }) {
  const [clientMode, setClientMode] = useState(true);
  const [activeKey, setActiveKey] = useState('tires');
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);
  const [sessionResetKey, setSessionResetKey] = useState(0);

  const handleBrandClick = () => {
    setSessionResetKey((key) => key + 1);
    setActiveKey('tires');
  };

  return (
    <Layout className="app-layout">
      <SiteHeader
        appearance={appearance}
        onAppearanceChange={onAppearanceChange}
        activeKey={activeKey}
        onActiveKeyChange={setActiveKey}
        onBrandClick={handleBrandClick}
      />

      <Layout className="app-content-layout">
        <Layout.Content className="app-content">
          <Flex className="app-content-wrapper" vertical>
            <div
              className="catalog-panel"
              hidden={activeKey !== 'tires'}
              inert={activeKey !== 'tires' ? true : undefined}
            >
              <TiresSearchParameters
                key={`tires-${sessionResetKey}`}
                isClientMode={clientMode}
                catalogDataVersion={catalogDataVersion}
              />
            </div>
            <div
              className="catalog-panel"
              hidden={activeKey !== 'disks'}
              inert={activeKey !== 'disks' ? true : undefined}
            >
              <DiscsSearchParameters
                key={`discs-${sessionResetKey}`}
                isClientMode={clientMode}
                catalogDataVersion={catalogDataVersion}
              />
            </div>
          </Flex>
        </Layout.Content>
      </Layout>

      <SideBar
        clientMode={clientMode}
        setClientMode={setClientMode}
        onCatalogDataLoaded={() => setCatalogDataVersion((v) => v + 1)}
      />

      <ScrollToTop />
    </Layout>
  );
}

export default App;
