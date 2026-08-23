import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DEFAULT_APP_HOME, PATHS } from './paths';
import { subscribeCatalogApplied } from '../services/catalogSync/catalogSyncChannel';

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
  const { isAuthenticated, isReady } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [clientMode, setClientModeState] = useState(getInitialClientMode);
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);
  const [sessionResetKey, setSessionResetKey] = useState(0);
  const [lastCatalogPath, setLastCatalogPath] = useState(DEFAULT_APP_HOME);
  const [lastBackgroundPath, setLastBackgroundPath] = useState(DEFAULT_APP_HOME);

  useEffect(() => {
    if (pathname === PATHS.tyres || pathname === PATHS.wheels) {
      setLastCatalogPath(pathname);
      setLastBackgroundPath(pathname);
      return;
    }
    if (pathname === PATHS.basket) {
      setLastBackgroundPath(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isReady || isAuthenticated) return;
    setClientModeState(true);
  }, [isAuthenticated, isReady]);

  useEffect(() => {
    if (!isReady) return;
    const stored = isAuthenticated ? clientMode : true;
    try {
      window.localStorage.setItem(CLIENT_MODE_STORAGE_KEY, String(stored));
    } catch {
      /* ignore */
    }
  }, [clientMode, isAuthenticated, isReady]);

  const setClientMode = useCallback(
    (value) => {
      if (!isAuthenticated) {
        setClientModeState(true);
        return;
      }
      setClientModeState(value);
    },
    [isAuthenticated]
  );

  const continueSelection = useCallback(() => {
    navigate(lastCatalogPath === PATHS.wheels ? PATHS.wheels : DEFAULT_APP_HOME);
  }, [lastCatalogPath, navigate]);

  const handleBrandClick = useCallback(() => {
    setSessionResetKey((key) => key + 1);
    if (isAuthenticated) {
      setLastCatalogPath(DEFAULT_APP_HOME);
      setLastBackgroundPath(DEFAULT_APP_HOME);
      navigate(DEFAULT_APP_HOME);
      return;
    }
    navigate(PATHS.home);
  }, [isAuthenticated, navigate]);

  const lastAppliedVersionRef = useRef('');

  const bumpCatalogDataVersion = useCallback(() => {
    setCatalogDataVersion((version) => version + 1);
  }, []);

  const notifyCatalogApplied = useCallback(
    (version) => {
      if (version) {
        lastAppliedVersionRef.current = version;
      }
      bumpCatalogDataVersion();
    },
    [bumpCatalogDataVersion]
  );

  useEffect(() => {
    return subscribeCatalogApplied((version) => {
      if (version && version === lastAppliedVersionRef.current) {
        return;
      }
      if (version) {
        lastAppliedVersionRef.current = version;
      }
      bumpCatalogDataVersion();
    });
  }, [bumpCatalogDataVersion]);

  const effectiveClientMode = isAuthenticated ? clientMode : true;

  const value = useMemo(
    () => ({
      clientMode: effectiveClientMode,
      setClientMode,
      continueSelection,
      handleBrandClick,
      catalogDataVersion,
      bumpCatalogDataVersion,
      notifyCatalogApplied,
      sessionResetKey,
      lastBackgroundPath,
    }),
    [
      effectiveClientMode,
      setClientMode,
      continueSelection,
      handleBrandClick,
      catalogDataVersion,
      bumpCatalogDataVersion,
      notifyCatalogApplied,
      sessionResetKey,
      lastBackgroundPath,
    ]
  );

  return (
    <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
  );
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }
  return ctx;
}
