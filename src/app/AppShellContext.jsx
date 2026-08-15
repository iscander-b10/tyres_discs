import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
  const [clientMode, setClientMode] = useState(getInitialClientMode);
  const [activeKey, setActiveKeyState] = useState('tires');
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);
  const [sessionResetKey, setSessionResetKey] = useState(0);
  const [lastCatalogKey, setLastCatalogKey] = useState('tires');

  useEffect(() => {
    try {
      window.localStorage.setItem(CLIENT_MODE_STORAGE_KEY, String(clientMode));
    } catch {
      /* ignore */
    }
  }, [clientMode]);

  const setActiveKey = useCallback((key) => {
    if (key === 'tires' || key === 'disks') {
      setLastCatalogKey(key);
    }
    setActiveKeyState(key);
  }, []);

  const goToBasket = useCallback(() => {
    setActiveKeyState('basket');
  }, []);

  const continueSelection = useCallback(() => {
    setActiveKeyState(lastCatalogKey === 'disks' ? 'disks' : 'tires');
  }, [lastCatalogKey]);

  const handleBrandClick = useCallback(() => {
    setSessionResetKey((key) => key + 1);
    setActiveKeyState('tires');
    setLastCatalogKey('tires');
  }, []);

  const bumpCatalogDataVersion = useCallback(() => {
    setCatalogDataVersion((version) => version + 1);
  }, []);

  const value = useMemo(
    () => ({
      clientMode,
      setClientMode,
      activeKey,
      setActiveKey,
      goToBasket,
      continueSelection,
      handleBrandClick,
      catalogDataVersion,
      bumpCatalogDataVersion,
      sessionResetKey,
    }),
    [
      clientMode,
      activeKey,
      setActiveKey,
      goToBasket,
      continueSelection,
      handleBrandClick,
      catalogDataVersion,
      bumpCatalogDataVersion,
      sessionResetKey,
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
