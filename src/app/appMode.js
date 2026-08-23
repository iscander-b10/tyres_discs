/** Demo: phase 3 — /demo URL, JSON catalog, isDemo=true */
export const isDemo = false;

export function canUseApp(isAuthenticated) {
  return isAuthenticated || isDemo;
}
