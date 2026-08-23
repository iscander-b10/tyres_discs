import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { login as loginSession, logout as logoutSession, restore } from './session';
import { createWorkspace } from './workspace';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;

    restore({ isCurrent })
      .then(async (session) => {
        if (!session || !isCurrent()) return;
        const restoredWorkspace = await createWorkspace(session.login);
        if (isCurrent()) setWorkspace(restoredWorkspace);
      })
      .catch(() => {
        if (isCurrent()) {
          logoutSession();
          setWorkspace(null);
        }
      })
      .finally(() => {
        if (isCurrent()) setIsReady(true);
      });

    return () => {
      if (isCurrent()) generationRef.current += 1;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;

    try {
      const session = await loginSession(email, password, { isCurrent });
      if (!session || !isCurrent()) {
        if (isCurrent()) setIsReady(true);
        return false;
      }

      const nextWorkspace = await createWorkspace(session.login);
      if (!isCurrent()) return false;

      setWorkspace(nextWorkspace);
      setIsReady(true);
      return true;
    } catch {
      if (isCurrent()) {
        logoutSession();
        setWorkspace(null);
        setIsReady(true);
      }
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    generationRef.current += 1;
    logoutSession();
    setWorkspace(null);
    setIsReady(true);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(workspace),
      workspace,
      login: workspace?.login ?? null,
      isReady,
      isWorkspaceReady: isReady && Boolean(workspace),
      signIn,
      logout,
    }),
    [isReady, logout, signIn, workspace]
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
