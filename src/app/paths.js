export const PATHS = {
  home: '/',
  tyres: '/tyres',
  wheels: '/wheels',
  basket: '/basket',
  login: '/login',
  demo: '/demo',
  demoTyres: '/demo/tyres',
  demoWheels: '/demo/wheels',
  demoBasket: '/demo/basket',
};

/** Рабочий «дом» после входа (каталог шин). */
export const DEFAULT_APP_HOME = PATHS.tyres;

/** Рабочий «дом» публичного демо. */
export const DEFAULT_DEMO_HOME = PATHS.demoTyres;

export const ROUTER_BASENAME = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export const LOGIN_QUERY_PARAM = 'login';
export const LOGIN_QUERY_VALUE = '1';

export function isLoginQueryOpen(searchParams) {
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || '');
  return params.get(LOGIN_QUERY_PARAM) === LOGIN_QUERY_VALUE;
}

export function stripLoginQuery(pathname, search = '') {
  const params = new URLSearchParams(search || '');
  params.delete(LOGIN_QUERY_PARAM);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Navigate target для «Войти» и RequireAuth: `/?login=1` + optional state.from.
 */
export function buildHomeLoginPath(fromHref) {
  const search = `?${LOGIN_QUERY_PARAM}=${LOGIN_QUERY_VALUE}`;
  if (typeof fromHref === 'string' && fromHref) {
    return { pathname: PATHS.home, search, state: { from: fromHref } };
  }
  return { pathname: PATHS.home, search };
}

export function isDemoPath(pathname) {
  return (
    typeof pathname === 'string' &&
    (pathname === PATHS.demo || pathname.startsWith(`${PATHS.demo}/`))
  );
}

function staffPageFromPathname(pathname) {
  if (pathname === PATHS.home) return 'home';
  if (pathname === PATHS.tyres) return 'tyres';
  if (pathname === PATHS.wheels) return 'wheels';
  if (pathname === PATHS.basket) return 'basket';
  if (pathname === PATHS.login) return 'login';
  return 'home';
}

export function pageFromPathname(pathname) {
  if (isDemoPath(pathname)) {
    const rest = pathname.slice(PATHS.demo.length) || '/';
    const page = staffPageFromPathname(rest);
    if (page === 'tyres' || page === 'wheels' || page === 'basket') {
      return page;
    }
    return 'tyres';
  }
  return staffPageFromPathname(pathname);
}

export function isMarketingPath(pathname) {
  return pathname === PATHS.home;
}

/** Staff catalog/cart surfaces only — post-login whitelist. */
export function isStaffAppPath(pathname) {
  return (
    pathname === PATHS.tyres ||
    pathname === PATHS.wheels ||
    pathname === PATHS.basket
  );
}

/** App surfaces: каталог и корзина (staff и /demo*), не маркетинг, не login. */
export function isAppPath(pathname) {
  const page = pageFromPathname(pathname);
  return page === 'tyres' || page === 'wheels' || page === 'basket';
}

export function appHomePath(pathname) {
  return isDemoPath(pathname) ? DEFAULT_DEMO_HOME : DEFAULT_APP_HOME;
}

/** Staff path → тот же экран в текущем дереве (demo или staff). */
export function toAppPath(pathname, staffPath) {
  if (!isDemoPath(pathname)) return staffPath;
  if (staffPath === PATHS.tyres) return PATHS.demoTyres;
  if (staffPath === PATHS.wheels) return PATHS.demoWheels;
  if (staffPath === PATHS.basket) return PATHS.demoBasket;
  return DEFAULT_DEMO_HOME;
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
  return isStaffAppPath(fallbackPath) ? fallbackPath : DEFAULT_APP_HOME;
}

/**
 * Куда вести после успешного входа.
 * Marketing/home/login/unknown/demo → DEFAULT_APP_HOME; staff app path → сохранить deep-link.
 * Никогда не возвращает `/`, `/login` или `/demo*`.
 */
export function resolvePostLoginPath(location, { fallback = DEFAULT_APP_HOME } = {}) {
  const from = location?.state?.from;
  const pathname = pathnameFromHref(from);
  const search = searchFromHref(from);

  if (isSafeRelativePath(pathname) && isStaffAppPath(pathname)) {
    return `${pathname}${search}`;
  }

  return normalizeAppFallback(fallback);
}

/**
 * Куда закрывать модалку логина без входа: guest-safe поверхности без login query.
 */
export function resolveLoginDismissPath(location) {
  const from = location?.state?.from;
  const pathname = pathnameFromHref(from);
  const search = searchFromHref(from);

  if (isSafeRelativePath(pathname) && isMarketingPath(pathname)) {
    return stripLoginQuery(pathname, search);
  }

  return PATHS.home;
}

/**
 * state для Link/NavLink на `/?login=1`: единый intent, без `from: '/'`.
 */
export function loginLinkState(location) {
  if (!location) {
    return { from: DEFAULT_APP_HOME };
  }

  const href = `${location.pathname}${location.search || ''}`;
  if (isStaffAppPath(location.pathname)) {
    return { from: href };
  }

  return { from: DEFAULT_APP_HOME };
}

/**
 * Полный to для NavLink «Войти»: pathname + search + state.
 */
export function loginLinkTarget(location) {
  const state = loginLinkState(location);
  return {
    pathname: PATHS.home,
    search: `?${LOGIN_QUERY_PARAM}=${LOGIN_QUERY_VALUE}`,
    state,
  };
}

/** state при редиректе RequireAuth → /?login=1 (deep-link на attempted path). */
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
