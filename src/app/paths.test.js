import {
  DEFAULT_APP_HOME,
  PATHS,
  isAppPath,
  isMarketingPath,
  isSafeRelativePath,
  loginLinkState,
  resolveLoginDismissPath,
  resolvePostLoginPath,
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

  test('guest-safe: home and basket', () => {
    expect(resolveLoginDismissPath(loc(PATHS.home))).toBe(PATHS.home);
    expect(resolveLoginDismissPath(loc(`${PATHS.basket}?x=1`))).toBe(
      `${PATHS.basket}?x=1`
    );
  });

  test('protected from → home, not catalog', () => {
    expect(resolveLoginDismissPath(loc(PATHS.tyres))).toBe(PATHS.home);
    expect(resolveLoginDismissPath(loc(PATHS.wheels))).toBe(PATHS.home);
    expect(resolveLoginDismissPath(loc(PATHS.login))).toBe(PATHS.home);
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

  test('on login keeps existing state', () => {
    const state = { from: PATHS.wheels };
    expect(
      loginLinkState({ pathname: PATHS.login, search: '', state })
    ).toEqual(state);
  });
});
