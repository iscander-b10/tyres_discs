import React from 'react';
import { Flex, Layout } from 'antd';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShellProvider, useAppShell } from './app/AppShellContext';
import { PATHS, ROUTER_BASENAME, overlayBackgroundPage } from './app/paths';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import SiteHeader from './components/SiteHeader/SiteHeader';
import SiteFooter from './components/SiteFooter/SiteFooter';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import BasketPage from './components/Basket/BasketPage';
import LoginPage from './components/LoginPage/LoginPage';
import LandingPage from './components/LandingPage/LandingPage';
import ModeToggle from './components/ModeToggle/ModeToggle';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { CatalogSyncHost } from './services/catalogSync/CatalogSyncHost';
import './App.scss';

function loginRedirectState(location) {
  return { from: `${location.pathname}${location.search}` };
}

function LoginRedirect() {
  const location = useLocation();
  return <Navigate to={PATHS.login} replace state={loginRedirectState(location)} />;
}

function RequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <LoginRedirect />;
  }
  return null;
}

function HomeRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={PATHS.tyres} replace />;
  }
  return null;
}

function UnmatchedRoute() {
  return <Navigate to={PATHS.home} replace />;
}

function AppFrame({ appearance = 'light', onAppearanceChange }) {
  const { lastBackgroundPath, sessionResetKey } = useAppShell();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === PATHS.login;
  const isHome = location.pathname === PATHS.home;
  const backgroundPage = overlayBackgroundPage(location, lastBackgroundPath);

  return (
    <>
      <Layout className="app-layout" inert={isLogin ? true : undefined}>
        <SiteHeader
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
        />

        <Layout className="app-content-layout">
          <Layout.Content className="app-content">
            <Flex className="app-content-wrapper" vertical>
              {isHome && !isAuthenticated ? (
                <LandingPage />
              ) : (
                <>
                  {isAuthenticated ? (
                    <>
                      <div
                        className="catalog-panel"
                        hidden={backgroundPage !== 'tyres'}
                        inert={isLogin || backgroundPage !== 'tyres' ? true : undefined}
                      >
                        <TiresSearchParameters key={`tires-${sessionResetKey}`} />
                      </div>
                      <div
                        className="catalog-panel"
                        hidden={backgroundPage !== 'wheels'}
                        inert={isLogin || backgroundPage !== 'wheels' ? true : undefined}
                      >
                        <DiscsSearchParameters key={`discs-${sessionResetKey}`} />
                      </div>
                    </>
                  ) : null}
                  <div
                    className="catalog-panel"
                    hidden={backgroundPage !== 'basket'}
                    inert={isLogin || backgroundPage !== 'basket' ? true : undefined}
                  >
                    <BasketPage />
                  </div>
                </>
              )}
            </Flex>
          </Layout.Content>
        </Layout>

        <SiteFooter />
        {isAuthenticated ? <ModeToggle /> : null}
        <ScrollToTop />
        <Outlet />
      </Layout>
      {isLogin ? <LoginPage /> : null}
    </>
  );
}

function AppReady({ children }) {
  const { isReady } = useAuth();
  if (!isReady) return null;
  return children;
}

function App({ appearance = 'light', onAppearanceChange }) {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AuthProvider>
        <AppShellProvider>
          <CartProvider>
            <CatalogSyncHost />
            <AppReady>
              <Routes>
                <Route
                  element={
                    <AppFrame
                      appearance={appearance}
                      onAppearanceChange={onAppearanceChange}
                    />
                  }
                >
                  <Route index element={<HomeRoute />} />
                  <Route path="tyres" element={<RequireAuth />} />
                  <Route path="wheels" element={<RequireAuth />} />
                  <Route path="basket" element={<></>} />
                  <Route path="login" element={<></>} />
                </Route>
                <Route path="*" element={<UnmatchedRoute />} />
              </Routes>
            </AppReady>
          </CartProvider>
        </AppShellProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
