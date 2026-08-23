import React from 'react';
import { Flex, Layout } from 'antd';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { AppShellProvider, useAppShell } from './app/AppShellContext';
import { canUseApp } from './app/appMode';
import {
  DEFAULT_APP_HOME,
  LOGIN_QUERY_PARAM,
  LOGIN_QUERY_VALUE,
  PATHS,
  ROUTER_BASENAME,
  isLoginQueryOpen,
  loginRedirectState,
  pageFromPathname,
} from './app/paths';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import { CartReconciliationHost } from './cart/CartReconciliationHost';
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

function LoginRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: PATHS.home,
        search: `?${LOGIN_QUERY_PARAM}=${LOGIN_QUERY_VALUE}`,
      }}
      replace
      state={loginRedirectState(location)}
    />
  );
}

function LoginRouteRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: PATHS.home,
        search: `?${LOGIN_QUERY_PARAM}=${LOGIN_QUERY_VALUE}`,
      }}
      replace
      state={location.state ?? loginRedirectState(location)}
    />
  );
}

function RequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!canUseApp(isAuthenticated)) {
    return <LoginRedirect />;
  }
  return null;
}

function BasketGuard() {
  const { isAuthenticated } = useAuth();
  if (!canUseApp(isAuthenticated)) {
    return <Navigate to={PATHS.home} replace />;
  }
  return null;
}

/** Auth users never reside on marketing `/` — app home is `/tyres`. */
function HomeRoute() {
  const { isAuthenticated } = useAuth();
  if (canUseApp(isAuthenticated)) {
    return <Navigate to={DEFAULT_APP_HOME} replace />;
  }
  return null;
}

function UnmatchedRoute() {
  return <Navigate to={PATHS.home} replace />;
}

function AppFrame({ appearance = 'light', onAppearanceChange }) {
  const { sessionResetKey } = useAppShell();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // TODO phase 3: isDemo from appMode — demo URL, JSON catalog
  const appEnabled = canUseApp(isAuthenticated);
  const isLoginOpen = isLoginQueryOpen(searchParams);
  const isHome = location.pathname === PATHS.home;
  const showLanding = !appEnabled && (isHome || isLoginOpen);
  const showCatalog = appEnabled && !showLanding;
  const backgroundPage = pageFromPathname(location.pathname);

  return (
    <>
      <Layout className="app-layout" inert={isLoginOpen ? true : undefined}>
        <SiteHeader
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
        />

        <Layout className="app-content-layout">
          <Layout.Content className="app-content">
            <Flex className="app-content-wrapper" vertical>
              {showLanding ? (
                <LandingPage />
              ) : (
                <>
                  {showCatalog ? (
                    <>
                      <div
                        className="catalog-panel"
                        hidden={backgroundPage !== 'tyres'}
                        inert={
                          isLoginOpen || backgroundPage !== 'tyres'
                            ? true
                            : undefined
                        }
                      >
                        <TiresSearchParameters key={`tires-${sessionResetKey}`} />
                      </div>
                      <div
                        className="catalog-panel"
                        hidden={backgroundPage !== 'wheels'}
                        inert={
                          isLoginOpen || backgroundPage !== 'wheels'
                            ? true
                            : undefined
                        }
                      >
                        <DiscsSearchParameters key={`discs-${sessionResetKey}`} />
                      </div>
                    </>
                  ) : null}
                  {showCatalog ? (
                    <div
                      className="catalog-panel"
                      hidden={backgroundPage !== 'basket'}
                      inert={
                        isLoginOpen || backgroundPage !== 'basket'
                          ? true
                          : undefined
                      }
                    >
                      <BasketPage />
                    </div>
                  ) : null}
                </>
              )}
            </Flex>
          </Layout.Content>
        </Layout>

        <SiteFooter />
        {appEnabled ? <ModeToggle /> : null}
        <ScrollToTop />
        <Outlet />
      </Layout>
      {isLoginOpen && !isAuthenticated ? <LoginPage /> : null}
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
            <CartReconciliationHost />
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
                  <Route path="basket" element={<BasketGuard />} />
                  <Route path="login" element={<LoginRouteRedirect />} />
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
