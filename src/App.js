import React from 'react';
import { Flex, Layout } from 'antd';
import { AppShellProvider, useAppShell } from './app/AppShellContext';
import { CartProvider } from './cart/CartContext';
import SiteHeader from './components/SiteHeader/SiteHeader';
import SiteFooter from './components/SiteFooter/SiteFooter';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import BasketPage from './components/Basket/BasketPage';
import SideBar from './components/SideBar/SideBar';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import './App.scss';

function AppLayout({ appearance = 'light', onAppearanceChange }) {
  const { activeKey, sessionResetKey } = useAppShell();

  return (
    <Layout className="app-layout">
      <SiteHeader
        appearance={appearance}
        onAppearanceChange={onAppearanceChange}
      />

      <Layout className="app-content-layout">
        <Layout.Content className="app-content">
          <Flex className="app-content-wrapper" vertical>
            <div
              className="catalog-panel"
              hidden={activeKey !== 'tires'}
              inert={activeKey !== 'tires' ? true : undefined}
            >
              <TiresSearchParameters key={`tires-${sessionResetKey}`} />
            </div>
            <div
              className="catalog-panel"
              hidden={activeKey !== 'disks'}
              inert={activeKey !== 'disks' ? true : undefined}
            >
              <DiscsSearchParameters key={`discs-${sessionResetKey}`} />
            </div>
            <div
              className="catalog-panel"
              hidden={activeKey !== 'basket'}
              inert={activeKey !== 'basket' ? true : undefined}
            >
              <BasketPage />
            </div>
          </Flex>
        </Layout.Content>
      </Layout>

      <SiteFooter />
      <SideBar />
      <ScrollToTop />
    </Layout>
  );
}

function App({ appearance = 'light', onAppearanceChange }) {
  return (
    <AppShellProvider>
      <CartProvider>
        <AppLayout
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
        />
      </CartProvider>
    </AppShellProvider>
  );
}

export default App;
