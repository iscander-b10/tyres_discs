import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { login as loginSession, logout as logoutSession, restore } from './session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [loginName, setLoginName] = useState(null);

  useEffect(() => {
    let cancelled = false;

    restore()
      .then((session) => {
        if (cancelled) return;
        setLoginName(session?.login ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoginName(null);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const session = await loginSession(email, password);
    if (!session) return false;
    setLoginName(session.login);
    return true;
  }, []);

  const logout = useCallback(() => {
    logoutSession();
    setLoginName(null);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(loginName),
      login: loginName,
      isReady,
      signIn: login,
      logout,
    }),
    [isReady, login, loginName, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
