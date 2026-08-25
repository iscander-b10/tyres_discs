import indexedDBService from '../indexedDBService';

/**
 * Моки: IDB transaction без onsuccess.
 * Реально: CatalogIdbSession._readStoreAll обязан settle Promise.
 * Риск: P0 — abort без request.onerror оставляет «Найти» в вечном loading.
 */

describe('CatalogIdbSession._readStoreAll', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  test('abort без request.onsuccess отклоняет Promise (AbortError)', async () => {
    let onAbort = null;
    const request = {};
    const transaction = {
      objectStore: () => ({ getAll: () => request }),
      error: null,
      set onabort(fn) {
        onAbort = fn;
      },
      get onabort() {
        return onAbort;
      },
      oncomplete: null,
    };
    const database = {
      transaction: () => transaction,
    };

    const promise = indexedDBService._readStoreAll(
      database,
      'tires',
      indexedDBService._generation
    );
    expect(typeof onAbort).toBe('function');
    onAbort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('getAll без onsuccess отклоняет Promise по timeout', async () => {
    jest.useFakeTimers();
    const request = {};
    const transaction = {
      objectStore: () => ({ getAll: () => request }),
      error: null,
      onabort: null,
      oncomplete: null,
    };
    const database = {
      transaction: () => transaction,
    };

    const promise = indexedDBService._readStoreAll(
      database,
      'tires',
      indexedDBService._generation
    );
    jest.advanceTimersByTime(30_000);
    await expect(promise).rejects.toMatchObject({ name: 'TimeoutError' });
    jest.useRealTimers();
  });
});
