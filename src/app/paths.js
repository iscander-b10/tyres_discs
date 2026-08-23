export const PATHS = {
  home: '/',
  tyres: '/tyres',
  wheels: '/wheels',
  basket: '/basket',
  login: '/login',
};

/** Рабочий «дом» после входа (каталог шин). */
export const DEFAULT_APP_HOME = PATHS.tyres;

export const ROUTER_BASENAME = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export function pageFromPathname(pathname) {
  if (pathname === PATHS.home) return 'home';
  if (pathname === PATHS.tyres) return 'tyres';
  if (pathname === PATHS.wheels) return 'wheels';
  if (pathname === PATHS.basket) return 'basket';
  if (pathname === PATHS.login) return 'login';
  return 'home';
}

export function isMarketingPath(pathname) {
  return pathname === PATHS.home;
}

/** App surfaces: каталог и корзина (не маркетинг, не login). */
export function isAppPath(pathname) {
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

function searchFromHref(href) {
  if (typeof href !== 'string') return '';
  const q = href.indexOf('?');
  return q >= 0 ? href.slice(q) : '';
}

/**
 * Same-origin relative path only: starts with `/`, rejects `//` / protocol-relative.
 */
export function isSafeRelativePath(pathname) {
  return (
    typeof pathname === 'string' &&
    pathname.startsWith('/') &&
    !pathname.startsWith('//')
  );
}

function normalizeAppFallback(fallbackPath) {
  return isAppPath(fallbackPath) ? fallbackPath : DEFAULT_APP_HOME;
}

/**
 * Куда вести после успешного входа.
 * Marketing/home/login/unknown → DEFAULT_APP_HOME; app path → сохранить deep-link.
 * Никогда не возвращает `/` или `/login`.
 */
export function resolvePostLoginPath(location, { fallback = DEFAULT_APP_HOME } = {}) {
  const from = location?.state?.from;
  const pathname = pathnameFromHref(from);
  const search = searchFromHref(from);

  if (isSafeRelativePath(pathname) && isAppPath(pathname)) {
    return `${pathname}${search}`;
  }

  return normalizeAppFallback(fallback);
}

/**
 * Куда закрывать модалку логина без входа: только guest-safe поверхности.
 */
export function resolveLoginDismissPath(location) {
  const from = location?.state?.from;
  const pathname = pathnameFromHref(from);
  const search = searchFromHref(from);

  if (
    isSafeRelativePath(pathname) &&
    (isMarketingPath(pathname) || pathname === PATHS.basket)
  ) {
    return `${pathname}${search}`;
  }

  return PATHS.home;
}

/**
 * state для Link/NavLink на `/login`: единый intent, без `from: '/'`.
 */
export function loginLinkState(location) {
  if (!location || location.pathname === PATHS.login) {
    return location?.state ?? { from: DEFAULT_APP_HOME };
  }

  const href = `${location.pathname}${location.search || ''}`;
  if (isAppPath(location.pathname)) {
    return { from: href };
  }

  return { from: DEFAULT_APP_HOME };
}

/** state при редиректе RequireAuth → login (deep-link на attempted path). */
export function loginRedirectState(location) {
  return { from: `${location.pathname}${location.search || ''}` };
}

/** @deprecated Используйте resolvePostLoginPath */
export function loginReturnPath(location, fallbackPath = DEFAULT_APP_HOME) {
  return resolvePostLoginPath(location, { fallback: fallbackPath });
}

/** @deprecated Используйте resolvePostLoginPath */
export function loginRedirectFrom(location) {
  return resolvePostLoginPath(location);
}

/** @deprecated Используйте resolveLoginDismissPath */
export function loginDismissPath(location) {
  return resolveLoginDismissPath(location);
}

export function canCloseLoginWithHistoryBack(location) {
  const from = location?.state?.from;
  const pathname = pathnameFromHref(from);
  return isSafeRelativePath(pathname) && pathname !== PATHS.login;
}

export function overlayBackgroundPage(location, lastBackgroundPath = DEFAULT_APP_HOME) {
  if (location.pathname !== PATHS.login) {
    return pageFromPathname(location.pathname);
  }

  const fromPath = pathnameFromHref(location.state?.from);
  if (isAppPath(fromPath)) {
    return pageFromPathname(fromPath);
  }

  if (isAppPath(lastBackgroundPath)) {
    return pageFromPathname(lastBackgroundPath);
  }

  return 'tyres';
}
