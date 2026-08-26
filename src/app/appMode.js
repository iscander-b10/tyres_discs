import { isDemoPath } from './paths';

/** Публичное демо: считается из pathname (`/demo` и `/demo/*`), не из env. */
export function isDemo(pathname) {
  return isDemoPath(pathname);
}

export function canUseApp(isAuthenticated, pathname) {
  return Boolean(isAuthenticated) || isDemo(pathname);
}
