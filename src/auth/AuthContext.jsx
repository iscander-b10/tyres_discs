import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { login as loginSession, logout as logoutSession, restore } from './session';
import { createWorkspace } from './workspace';
import { DEMO_WORKSPACE } from '../app/demoWorkspace';
import { isDemoPath } from '../app/paths';
import { appLog } from '../utils/appLog';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const demo = isDemoPath(pathname);
  const [isReady, setIsReady] = useState(false);
  const [staffWorkspace, setStaffWorkspace] = useState(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;

    restore({ isCurrent })
      .then(async (session) => {
        if (!session || !isCurrent()) return;
        const restoredWorkspace = await createWorkspace(session.login);
        if (isCurrent()) setStaffWorkspace(restoredWorkspace);
      })
      .catch((error) => {
        appLog.error({
          code: 'auth.infra_failed',
          domain: 'auth',
          message: 'Auth restore path failed',
          error,
          context: { op: 'restore' },
        });
        if (isCurrent()) {
          logoutSession();
          setStaffWorkspace(null);
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

      setStaffWorkspace(nextWorkspace);
      setIsReady(true);
      return true;
    } catch (error) {
      appLog.error({
        code: 'auth.infra_failed',
        domain: 'auth',
        message: 'Auth signIn path failed',
        error,
        context: { op: 'signIn' },
      });
      if (isCurrent()) {
        logoutSession();
        setStaffWorkspace(null);
        setIsReady(true);
      }
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    generationRef.current += 1;
    logoutSession();
    setStaffWorkspace(null);
    setIsReady(true);
  }, []);

  const workspace = demo ? DEMO_WORKSPACE : staffWorkspace;
  const isAuthenticated = Boolean(staffWorkspace);
  const isWorkspaceReady = demo || (isReady && Boolean(staffWorkspace));

  const value = useMemo(
    () => ({
      isAuthenticated,
      workspace,
      login: workspace?.login ?? null,
      isReady,
      isWorkspaceReady,
      signIn,
      logout,
    }),
    [isAuthenticated, isReady, isWorkspaceReady, logout, signIn, workspace]
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
