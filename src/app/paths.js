export const PATHS = {
  home: '/',
  tyres: '/tyres',
  wheels: '/wheels',
  basket: '/basket',
  login: '/login',
};

export const ROUTER_BASENAME = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export function pageFromPathname(pathname) {
  if (pathname === PATHS.home) return 'home';
  if (pathname === PATHS.tyres) return 'tyres';
  if (pathname === PATHS.wheels) return 'wheels';
  if (pathname === PATHS.basket) return 'basket';
  if (pathname === PATHS.login) return 'login';
  return 'home';
}

function isSitePath(pathname) {
  return (
    pathname === PATHS.tyres ||
    pathname === PATHS.wheels ||
    pathname === PATHS.basket
  );
}

function pathnameFromHref(href) {
  if (typeof href !== 'string') return '';
  return href.split('?')[0];
}

export function loginReturnPath(location, fallbackPath = PATHS.tyres) {
  const from = location.state?.from;
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith(PATHS.login)) {
    return from;
  }
  return isSitePath(fallbackPath) ? fallbackPath : PATHS.tyres;
}

export function loginRedirectFrom(location) {
  return loginReturnPath(location);
}

export function loginDismissPath(location) {
  const from = location.state?.from;
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith(PATHS.login)) {
    if (from === PATHS.home || from === PATHS.basket) {
      return from;
    }
  }
  return PATHS.home;
}

export function canCloseLoginWithHistoryBack(location) {
  const from = location.state?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith(PATHS.login);
}

export function overlayBackgroundPage(location, lastBackgroundPath = PATHS.tyres) {
  if (location.pathname !== PATHS.login) {
    return pageFromPathname(location.pathname);
  }

  const fromPath = pathnameFromHref(location.state?.from);
  if (isSitePath(fromPath)) {
    return pageFromPathname(fromPath);
  }

  if (isSitePath(lastBackgroundPath)) {
    return pageFromPathname(lastBackgroundPath);
  }

  return 'tyres';
}
