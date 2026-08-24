import {
  appLog,
  isExpectedOperationalError,
  isQuotaExceededError,
  sanitizeLogContext,
} from './appLog';

describe('appLog', () => {
  let errorSpy;
  let warnSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('error пишет стабильный объект с code/domain/level/expected', () => {
    const err = new Error('boom');
    err.name = 'TypeError';

    const entry = appLog.error({
      code: 'search.failed',
      domain: 'search',
      message: 'Search failed',
      error: err,
      context: { kind: 'tires', background: false },
    });

    expect(entry).toMatchObject({
      code: 'search.failed',
      domain: 'search',
      level: 'error',
      expected: false,
      message: 'Search failed',
      errorName: 'TypeError',
      errorMessage: 'boom',
      context: { kind: 'tires', background: false },
    });
    expect(errorSpy).toHaveBeenCalledWith('[app]', entry);
  });

  test('sanitizeLogContext вырезает секреты и тяжёлые поля', () => {
    expect(
      sanitizeLogContext({
        storeId: 'store-a',
        password: 'secret',
        fingerprint: 'fp',
        secret: 'x',
        snapshot: { version: 1 },
        commands: [],
        items: [{ id: 1 }],
        op: 'open',
      })
    ).toEqual({ storeId: 'store-a', op: 'open' });
  });

  test('isExpectedOperationalError для Abort/Stale', () => {
    expect(isExpectedOperationalError({ name: 'AbortError' })).toBe(true);
    expect(isExpectedOperationalError({ name: 'StaleCatalogStoreError' })).toBe(
      true
    );
    expect(isExpectedOperationalError({ name: 'Error' })).toBe(false);
  });

  test('isQuotaExceededError', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError({ message: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaExceededError({ message: 'other' })).toBe(false);
  });

  test('warn пишет в console.warn', () => {
    const entry = appLog.warn({
      code: 'search.options_failed',
      domain: 'search',
      message: 'Options failed',
    });
    expect(entry.level).toBe('warn');
    expect(warnSpy).toHaveBeenCalledWith('[app]', entry);
  });
});
