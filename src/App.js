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
  isDemoPath,
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
// Временно скрыто для скриншотов презентации — вернуть после съёмки.
// import DemoCatalogBanner from './components/DemoCatalogBanner/DemoCatalogBanner';
import { CatalogSyncHost } from './services/catalogSync/CatalogSyncHost';
import { DemoCatalogHost } from './services/demoCatalog/DemoCatalogHost';
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
  const { pathname } = useLocation();
  if (!canUseApp(isAuthenticated, pathname)) {
    return <LoginRedirect />;
  }
  return null;
}

function BasketGuard() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  if (!canUseApp(isAuthenticated, pathname)) {
    return <Navigate to={PATHS.home} replace />;
  }
  return null;
}

/** Auth users never reside on marketing `/` — app home is `/tyres`. */
function HomeRoute() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  if (canUseApp(isAuthenticated, pathname)) {
    return <Navigate to={DEFAULT_APP_HOME} replace />;
  }
  return null;
}

function UnmatchedRoute() {
  return <Navigate to={PATHS.home} replace />;
}

function UnmatchedDemoRoute() {
  return <Navigate to={PATHS.demoTyres} replace />;
}

function AppFrame({ appearance = 'light', onAppearanceChange }) {
  const { sessionResetKey, workspaceResetKey } = useAppShell();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const demo = isDemoPath(location.pathname);
  const appEnabled = canUseApp(isAuthenticated, location.pathname);
  const isLoginOpen = !demo && isLoginQueryOpen(searchParams);
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
                  {/* Временно скрыто для скриншотов презентации — вернуть после съёмки. */}
                  {/* {showCatalog && demo ? <DemoCatalogBanner /> : null} */}
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
                        <TiresSearchParameters
                          key={`tires-${workspaceResetKey}-${sessionResetKey}`}
                          isActive={backgroundPage === 'tyres'}
                        />
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
                        <DiscsSearchParameters
                          key={`discs-${workspaceResetKey}-${sessionResetKey}`}
                          isActive={backgroundPage === 'wheels'}
                        />
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
                      <BasketPage key={`basket-${workspaceResetKey}`} />
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

function WorkspaceHosts() {
  const { isWorkspaceReady, workspace } = useAuth();
  const { pathname } = useLocation();
  if (!isWorkspaceReady || !workspace) return null;

  const workspaceKey = `${workspace.accountId}:${workspace.storeId}`;
  const demo = isDemoPath(pathname);
  return (
    <React.Fragment key={workspaceKey}>
      {demo ? <DemoCatalogHost /> : <CatalogSyncHost />}
      <CartReconciliationHost />
    </React.Fragment>
  );
}

function AppReady({ children }) {
  const { isReady } = useAuth();
  const { pathname } = useLocation();
  if (!isReady && !isDemoPath(pathname)) return null;
  return children;
}

export function AppRoutes({ appearance = 'light', onAppearanceChange }) {
  return (
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
        <Route path="demo">
          <Route index element={<Navigate to={PATHS.demoTyres} replace />} />
          <Route path="tyres" element={null} />
          <Route path="wheels" element={null} />
          <Route path="basket" element={null} />
          <Route path="*" element={<UnmatchedDemoRoute />} />
        </Route>
      </Route>
      <Route path="*" element={<UnmatchedRoute />} />
    </Routes>
  );
}

function App({ appearance = 'light', onAppearanceChange }) {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AuthProvider>
        <AppShellProvider>
          <CartProvider>
            <WorkspaceHosts />
            <AppReady>
              <AppRoutes
                appearance={appearance}
                onAppearanceChange={onAppearanceChange}
              />
            </AppReady>
          </CartProvider>
        </AppShellProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
