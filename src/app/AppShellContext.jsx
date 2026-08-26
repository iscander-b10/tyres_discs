import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  DEFAULT_APP_HOME,
  PATHS,
  appHomePath,
  isDemoPath,
  pageFromPathname,
  toAppPath,
} from './paths';
import { subscribeCatalogApplied } from '../services/catalogSync/catalogSyncChannel';
import indexedDBService from '../services/indexedDBService';
import CatalogBootstrapOverlay from '../components/CatalogBootstrapOverlay/CatalogBootstrapOverlay';
import {
  CATALOG_BOOTSTRAP_IDLE,
  normalizeCatalogBootstrap,
} from './catalogBootstrap';

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

const AppShellContext = createContext(null);

export function AppShellProvider({ children }) {
  const { isAuthenticated, isReady, isWorkspaceReady, workspace } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [clientMode, setClientModeState] = useState(getInitialClientMode);
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);
  const [catalogSnapshotVersion, setCatalogSnapshotVersion] = useState('');
  const [sessionResetKey, setSessionResetKey] = useState(0);
  const [lastCatalogPath, setLastCatalogPath] = useState(DEFAULT_APP_HOME);
  const [lastBackgroundPath, setLastBackgroundPath] = useState(DEFAULT_APP_HOME);
  const lastAppliedVersionRef = useRef('');
  const catalogBootstrapRetryRef = useRef(null);
  const catalogSurfaceReadyRef = useRef(false);
  const workspaceResetKey = isWorkspaceReady
    ? `${workspace.accountId}:${workspace.storeId}`
    : 'guest';
  const activeWorkspaceRef = useRef(null);
  const [catalogBootstrap, setCatalogBootstrapState] = useState(
    CATALOG_BOOTSTRAP_IDLE
  );
  const [catalogSurfaceReady, setCatalogSurfaceReady] = useState(false);
  const [catalogSurfaceReleased, setCatalogSurfaceReleased] = useState(true);

  useLayoutEffect(() => {
    const currentWorkspace = isWorkspaceReady ? workspace : null;
    activeWorkspaceRef.current = currentWorkspace;
    lastAppliedVersionRef.current = '';
    catalogSurfaceReadyRef.current = false;
    setCatalogSnapshotVersion('');
    setCatalogDataVersion((version) => version + 1);
    setCatalogBootstrapState({ ...CATALOG_BOOTSTRAP_IDLE });
    setCatalogSurfaceReady(false);
    setCatalogSurfaceReleased(true);

    if (currentWorkspace?.storeId) {
      indexedDBService.setActiveStore(currentWorkspace.storeId);
    } else {
      indexedDBService.invalidateActiveStore();
    }

    return () => {
      if (
        currentWorkspace?.storeId &&
        activeWorkspaceRef.current === currentWorkspace
      ) {
        activeWorkspaceRef.current = null;
        indexedDBService.invalidateActiveStore(currentWorkspace.storeId);
      }
    };
  }, [isWorkspaceReady, workspace]);

  const demo = isDemoPath(pathname);

  useEffect(() => {
    const page = pageFromPathname(pathname);
    if (page === 'tyres' || page === 'wheels') {
      setLastCatalogPath(pathname);
      setLastBackgroundPath(pathname);
      return;
    }
    if (page === 'basket') {
      setLastBackgroundPath(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isReady || isAuthenticated || isDemoPath(pathname)) return;
    setClientModeState(true);
  }, [isAuthenticated, isReady, pathname]);

  useEffect(() => {
    if (!isReady) return;
    const stored = isAuthenticated || isDemoPath(pathname) ? clientMode : true;
    try {
      window.localStorage.setItem(CLIENT_MODE_STORAGE_KEY, String(stored));
    } catch {
      /* ignore */
    }
  }, [clientMode, isAuthenticated, isReady, pathname]);

  const setClientMode = useCallback(
    (value) => {
      if (!isAuthenticated && !isDemoPath(pathname)) {
        setClientModeState(true);
        return;
      }
      setClientModeState(value);
    },
    [isAuthenticated, pathname]
  );

  const continueSelection = useCallback(() => {
    const lastPage = pageFromPathname(lastCatalogPath);
    const staffPath = lastPage === 'wheels' ? PATHS.wheels : DEFAULT_APP_HOME;
    navigate(toAppPath(pathname, staffPath));
  }, [lastCatalogPath, navigate, pathname]);

  const handleBrandClick = useCallback(() => {
    setSessionResetKey((key) => key + 1);
    if (isDemoPath(pathname)) {
      const demoHome = appHomePath(pathname);
      setLastCatalogPath(demoHome);
      setLastBackgroundPath(demoHome);
      navigate(demoHome);
      return;
    }
    if (isAuthenticated) {
      setLastCatalogPath(DEFAULT_APP_HOME);
      setLastBackgroundPath(DEFAULT_APP_HOME);
      navigate(DEFAULT_APP_HOME);
      return;
    }
    navigate(PATHS.home);
  }, [isAuthenticated, navigate, pathname]);

  const bumpCatalogDataVersion = useCallback(() => {
    setCatalogDataVersion((version) => version + 1);
  }, []);

  const setCatalogBootstrap = useCallback((update) => {
    setCatalogBootstrapState((current) =>
      normalizeCatalogBootstrap(update, current)
    );
  }, []);

  const registerCatalogBootstrapRetry = useCallback((fn) => {
    catalogBootstrapRetryRef.current = typeof fn === 'function' ? fn : null;
    return () => {
      if (catalogBootstrapRetryRef.current === fn) {
        catalogBootstrapRetryRef.current = null;
      }
    };
  }, []);

  const retryCatalogBootstrap = useCallback(() => {
    catalogBootstrapRetryRef.current?.();
  }, []);

  const notifyCatalogSurfaceReady = useCallback(() => {
    if (catalogSurfaceReadyRef.current) return;
    catalogSurfaceReadyRef.current = true;
    setCatalogSurfaceReady(true);
  }, []);

  const releaseCatalogSurface = useCallback(() => {
    setCatalogSurfaceReleased(true);
  }, []);

  const notifyCatalogApplied = useCallback(
    (version, storeId = activeWorkspaceRef.current?.storeId) => {
      if (
        !version ||
        !activeWorkspaceRef.current ||
        activeWorkspaceRef.current.storeId !== storeId
      ) {
        return false;
      }
      if (version) {
        lastAppliedVersionRef.current = version;
        setCatalogSnapshotVersion((current) =>
          version > current ? version : current
        );
      }
      bumpCatalogDataVersion();
      return true;
    },
    [bumpCatalogDataVersion]
  );

  useEffect(() => {
    if (!isWorkspaceReady || !workspace?.storeId) return undefined;
    const subscribedWorkspace = workspace;
    return subscribeCatalogApplied((version) => {
      if (activeWorkspaceRef.current !== subscribedWorkspace) return;
      if (version && version === lastAppliedVersionRef.current) {
        return;
      }
      if (version) {
        lastAppliedVersionRef.current = version;
        setCatalogSnapshotVersion((current) =>
          version > current ? version : current
        );
      }
      bumpCatalogDataVersion();
    }, subscribedWorkspace.storeId);
  }, [bumpCatalogDataVersion, isWorkspaceReady, workspace]);

  useEffect(() => {
    const phase = catalogBootstrap.phase;
    if (phase === 'idle') {
      catalogSurfaceReadyRef.current = false;
      setCatalogSurfaceReady(false);
      setCatalogSurfaceReleased(true);
      return;
    }
    if (phase === 'blocking' && catalogBootstrap.waitForShowcase) {
      catalogSurfaceReadyRef.current = false;
      setCatalogSurfaceReady(false);
      setCatalogSurfaceReleased(false);
    }
  }, [catalogBootstrap.phase, catalogBootstrap.waitForShowcase]);

  const effectiveClientMode =
    isAuthenticated || demo ? clientMode : true;
  const catalogPage = pageFromPathname(pathname);
  const onCatalogPage = catalogPage === 'tyres' || catalogPage === 'wheels';
  const waitForShowcase = Boolean(catalogBootstrap.waitForShowcase);
  const holdUntilSurface =
    waitForShowcase &&
    catalogBootstrap.phase === 'ready' &&
    onCatalogPage &&
    !catalogSurfaceReady;
  const catalogSurfaceHold =
    waitForShowcase &&
    onCatalogPage &&
    !catalogSurfaceReleased &&
    (catalogBootstrap.phase === 'blocking' ||
      catalogBootstrap.phase === 'error' ||
      catalogBootstrap.phase === 'ready');

  const value = useMemo(
    () => ({
      clientMode: effectiveClientMode,
      setClientMode,
      continueSelection,
      handleBrandClick,
      catalogDataVersion,
      catalogSnapshotVersion,
      bumpCatalogDataVersion,
      notifyCatalogApplied,
      catalogBootstrapPhase: catalogBootstrap.phase,
      setCatalogBootstrap,
      registerCatalogBootstrapRetry,
      retryCatalogBootstrap,
      notifyCatalogSurfaceReady,
      catalogSurfaceHold,
      sessionResetKey,
      workspaceResetKey,
      lastBackgroundPath,
    }),
    [
      effectiveClientMode,
      setClientMode,
      continueSelection,
      handleBrandClick,
      catalogDataVersion,
      catalogSnapshotVersion,
      bumpCatalogDataVersion,
      notifyCatalogApplied,
      catalogBootstrap.phase,
      setCatalogBootstrap,
      registerCatalogBootstrapRetry,
      retryCatalogBootstrap,
      notifyCatalogSurfaceReady,
      catalogSurfaceHold,
      sessionResetKey,
      workspaceResetKey,
      lastBackgroundPath,
    ]
  );

  return (
    <AppShellContext.Provider value={value}>
      {children}
      <CatalogBootstrapOverlay
        catalogBootstrap={catalogBootstrap}
        retryCatalogBootstrap={retryCatalogBootstrap}
        holdUntilSurface={holdUntilSurface}
        onRevealSurface={releaseCatalogSurface}
      />
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }
  return ctx;
}
