import React, { useCallback, useEffect, useState } from 'react';
import { Flex, Layout } from 'antd';
import { CartProvider } from './cart/CartContext';
import SiteHeader from './components/SiteHeader/SiteHeader';
import SiteFooter from './components/SiteFooter/SiteFooter';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import BasketPage from './components/Basket/BasketPage';
import SideBar from './components/SideBar/SideBar';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import './App.scss';

const CLIENT_MODE_STORAGE_KEY = 'ivanor-client-mode';

/** @returns {boolean} true = client, false = manager. Default: manager. */
function getInitialClientMode() {
  try {
    const stored = window.localStorage.getItem(CLIENT_MODE_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    /* ignore */
  }
  return false;
}

function App({ appearance = 'light', onAppearanceChange }) {
  const [clientMode, setClientMode] = useState(getInitialClientMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLIENT_MODE_STORAGE_KEY, String(clientMode));
    } catch {
      /* ignore */
    }
  }, [clientMode]);
  const [activeKey, setActiveKey] = useState('tires');
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);
  const [sessionResetKey, setSessionResetKey] = useState(0);
  const [lastCatalogKey, setLastCatalogKey] = useState('tires');

  const handleBrandClick = () => {
    setSessionResetKey((key) => key + 1);
    setActiveKey('tires');
    setLastCatalogKey('tires');
  };

  const handleActiveKeyChange = (key) => {
    if (key === 'tires' || key === 'disks') {
      setLastCatalogKey(key);
    }
    setActiveKey(key);
  };

  const goToBasket = useCallback(() => {
    setActiveKey('basket');
  }, []);

  const continueSelection = () => {
    setActiveKey(lastCatalogKey === 'disks' ? 'disks' : 'tires');
  };

  return (
    <CartProvider onGoToBasket={goToBasket}>
      <Layout className="app-layout">
        <SiteHeader
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          activeKey={activeKey}
          onActiveKeyChange={handleActiveKeyChange}
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
              <div
                className="catalog-panel"
                hidden={activeKey !== 'basket'}
                inert={activeKey !== 'basket' ? true : undefined}
              >
                <BasketPage
                  isClientMode={clientMode}
                  onContinueSelection={continueSelection}
                  isActive={activeKey === 'basket'}
                />
              </div>
            </Flex>
          </Layout.Content>
        </Layout>

        <SiteFooter
          onActiveKeyChange={handleActiveKeyChange}
          onBrandClick={handleBrandClick}
        />

        <SideBar
          clientMode={clientMode}
          setClientMode={setClientMode}
          onCatalogDataLoaded={() => setCatalogDataVersion((v) => v + 1)}
        />

        <ScrollToTop />
      </Layout>
    </CartProvider>
  );
}

export default App;
