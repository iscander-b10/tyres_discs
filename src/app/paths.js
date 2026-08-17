export const PATHS = {
  tyres: '/tyres',
  wheels: '/wheels',
  basket: '/basket',
  login: '/login',
};

export const ROUTER_BASENAME = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export function pageFromPathname(pathname) {
  if (pathname === PATHS.wheels) return 'wheels';
  if (pathname === PATHS.basket) return 'basket';
  if (pathname === PATHS.login) return 'login';
  return 'tyres';
}

export function loginRedirectFrom(location) {
  const from = location.state?.from;
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith(PATHS.login)) {
    return from;
  }
  return PATHS.tyres;
}
