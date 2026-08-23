import {
  DEFAULT_APP_HOME,
  LOGIN_QUERY_PARAM,
  LOGIN_QUERY_VALUE,
  PATHS,
  buildHomeLoginPath,
  isAppPath,
  isLoginQueryOpen,
  isMarketingPath,
  isSafeRelativePath,
  loginLinkState,
  loginLinkTarget,
  resolveLoginDismissPath,
  resolvePostLoginPath,
  stripLoginQuery,
} from './paths';

describe('path helpers', () => {
  test('isMarketingPath / isAppPath', () => {
    expect(isMarketingPath(PATHS.home)).toBe(true);
    expect(isMarketingPath(PATHS.tyres)).toBe(false);
    expect(isAppPath(PATHS.tyres)).toBe(true);
    expect(isAppPath(PATHS.wheels)).toBe(true);
    expect(isAppPath(PATHS.basket)).toBe(true);
    expect(isAppPath(PATHS.home)).toBe(false);
    expect(isAppPath(PATHS.login)).toBe(false);
  });

  test('isSafeRelativePath rejects open redirects', () => {
    expect(isSafeRelativePath('/tyres')).toBe(true);
    expect(isSafeRelativePath('/wheels?x=1')).toBe(true);
    expect(isSafeRelativePath('//evil.example')).toBe(false);
    expect(isSafeRelativePath('https://evil.example')).toBe(false);
    expect(isSafeRelativePath('tyres')).toBe(false);
    expect(isSafeRelativePath(null)).toBe(false);
  });
});

describe('login query helpers', () => {
  test('isLoginQueryOpen', () => {
    expect(isLoginQueryOpen('login=1')).toBe(true);
    expect(isLoginQueryOpen(new URLSearchParams('login=1'))).toBe(true);
    expect(isLoginQueryOpen('login=0')).toBe(false);
    expect(isLoginQueryOpen('')).toBe(false);
    expect(isLoginQueryOpen('other=1')).toBe(false);
  });

  test('stripLoginQuery', () => {
    expect(stripLoginQuery('/', 'login=1')).toBe('/');
    expect(stripLoginQuery('/', 'login=1&x=2')).toBe('/?x=2');
    expect(stripLoginQuery('/tyres', 'login=1')).toBe('/tyres');
  });

  test('buildHomeLoginPath', () => {
    expect(buildHomeLoginPath()).toEqual({
      pathname: PATHS.home,
      search: `?${LOGIN_QUERY_PARAM}=${LOGIN_QUERY_VALUE}`,
    });
    expect(buildHomeLoginPath(PATHS.tyres)).toEqual({
      pathname: PATHS.home,
      search: `?${LOGIN_QUERY_PARAM}=${LOGIN_QUERY_VALUE}`,
      state: { from: PATHS.tyres },
    });
  });

  test('loginLinkTarget', () => {
    expect(loginLinkTarget({ pathname: PATHS.home, search: '' })).toEqual({
      pathname: PATHS.home,
      search: `?${LOGIN_QUERY_PARAM}=${LOGIN_QUERY_VALUE}`,
      state: { from: DEFAULT_APP_HOME },
    });
  });
});

describe('resolvePostLoginPath', () => {
  const loc = (from) => ({ state: from === undefined ? undefined : { from } });

  test.each([
    ['/', PATHS.tyres],
    [PATHS.tyres, PATHS.tyres],
    [PATHS.wheels, PATHS.wheels],
    [PATHS.basket, PATHS.basket],
    [undefined, PATHS.tyres],
    [PATHS.login, PATHS.tyres],
    ['/tyres?width=205', '/tyres?width=205'],
    ['/wheels?pcd=114.3', '/wheels?pcd=114.3'],
    ['//evil.example', PATHS.tyres],
    ['https://evil.example/phish', PATHS.tyres],
    ['/unknown', PATHS.tyres],
  ])('from %p → %p', (from, expected) => {
    expect(resolvePostLoginPath(loc(from))).toBe(expected);
  });

  test('fallback must stay an app path', () => {
    expect(resolvePostLoginPath(loc('/'), { fallback: PATHS.home })).toBe(
      DEFAULT_APP_HOME
    );
    expect(resolvePostLoginPath(loc('/'), { fallback: PATHS.wheels })).toBe(
      PATHS.wheels
    );
  });

  test('missing location → default app home', () => {
    expect(resolvePostLoginPath(undefined)).toBe(DEFAULT_APP_HOME);
    expect(resolvePostLoginPath({})).toBe(DEFAULT_APP_HOME);
  });
});

describe('resolveLoginDismissPath', () => {
  const loc = (from) => ({ state: { from } });

  test('guest-safe: home without login query', () => {
    expect(resolveLoginDismissPath(loc(PATHS.home))).toBe(PATHS.home);
    expect(resolveLoginDismissPath(loc(`${PATHS.home}?login=1`))).toBe(
      PATHS.home
    );
  });

  test('protected from → home, not catalog', () => {
    expect(resolveLoginDismissPath(loc(PATHS.tyres))).toBe(PATHS.home);
    expect(resolveLoginDismissPath(loc(PATHS.wheels))).toBe(PATHS.home);
    expect(resolveLoginDismissPath(loc(PATHS.login))).toBe(PATHS.home);
    expect(resolveLoginDismissPath(loc(PATHS.basket))).toBe(PATHS.home);
  });
});

describe('loginLinkState', () => {
  test('marketing home → default app home, not from /', () => {
    expect(loginLinkState({ pathname: PATHS.home, search: '' })).toEqual({
      from: DEFAULT_APP_HOME,
    });
  });

  test('app path preserves deep-link', () => {
    expect(
      loginLinkState({ pathname: PATHS.wheels, search: '?a=1' })
    ).toEqual({ from: `${PATHS.wheels}?a=1` });
  });

  test('home with login query preserves default intent', () => {
    expect(
      loginLinkState({ pathname: PATHS.home, search: '?login=1' })
    ).toEqual({ from: DEFAULT_APP_HOME });
  });
});
