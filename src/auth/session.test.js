const AUTH_KEYS = [
  'auth.login.v1',
  'auth.secret.v1',
  'ivanor-auth-login',
  'ivanor-auth-secret',
];

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function loadSession(overrides = {}) {
  const crypto = {
    hmacLogin: jest.fn().mockResolvedValue('valid-digest'),
    normalizeLogin: (login) => String(login ?? '').trim().toLowerCase(),
    unwrapPassword: jest.fn().mockResolvedValue('password'),
    wrapPassword: jest.fn().mockResolvedValue('wrapped-password'),
    ...overrides,
  };
  jest.doMock('./crypto', () => crypto);
  jest.doMock('./fingerprint', () => ({
    getDeviceFingerprint: jest.fn(() => 'device'),
  }));

  return { session: require('./session'), crypto };
}

describe('auth session race guards and logout keys', () => {
  const originalVerifier = process.env.REACT_APP_AUTH_VERIFIER;

  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
    process.env.REACT_APP_AUTH_VERIFIER = 'valid-digest';
  });

  afterAll(() => {
    if (originalVerifier === undefined) {
      delete process.env.REACT_APP_AUTH_VERIFIER;
    } else {
      process.env.REACT_APP_AUTH_VERIFIER = originalVerifier;
    }
  });

  test('logout удаляет текущие и legacy auth keys', () => {
    const { session } = loadSession();
    AUTH_KEYS.forEach((key) => window.localStorage.setItem(key, 'value'));

    session.logout();

    AUTH_KEYS.forEach((key) => {
      expect(window.localStorage.getItem(key)).toBeNull();
    });
  });

  test('поздний login не записывает ключи после logout-инвалидации', async () => {
    const pendingWrap = deferred();
    const { session, crypto } = loadSession({
      wrapPassword: jest.fn(() => pendingWrap.promise),
    });
    let current = true;

    const loginPromise = session.login(' User@Example.COM ', 'password', {
      isCurrent: () => current,
    });
    await Promise.resolve();
    expect(crypto.hmacLogin).toHaveBeenCalledWith(
      'user@example.com',
      'password'
    );
    await Promise.resolve();
    current = false;
    session.logout();
    pendingWrap.resolve('late-secret');

    await expect(loginPromise).resolves.toBe(false);
    AUTH_KEYS.forEach((key) => {
      expect(window.localStorage.getItem(key)).toBeNull();
    });
  });

  test('устаревший restore не удаляет ключи более новой сессии', async () => {
    const pendingUnwrap = deferred();
    const { session } = loadSession({
      unwrapPassword: jest.fn(() => pendingUnwrap.promise),
    });
    window.localStorage.setItem('auth.login.v1', 'old@example.com');
    window.localStorage.setItem('auth.secret.v1', 'old-secret');
    let current = true;

    const restorePromise = session.restore({
      isCurrent: () => current,
    });
    window.localStorage.setItem('auth.login.v1', 'new@example.com');
    window.localStorage.setItem('auth.secret.v1', 'new-secret');
    current = false;
    pendingUnwrap.resolve('old-password');

    await expect(restorePromise).resolves.toBeNull();
    expect(window.localStorage.getItem('auth.login.v1')).toBe(
      'new@example.com'
    );
    expect(window.localStorage.getItem('auth.secret.v1')).toBe('new-secret');
  });
});
