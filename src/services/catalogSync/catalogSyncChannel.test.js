import {
  CATALOG_SYNC_EVENT_KEY,
  postCatalogApplied,
  subscribeCatalogApplied,
} from './catalogSyncChannel';

describe('catalogSyncChannel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  test('post/subscribe roundtrip через BroadcastChannel', () => {
    const listeners = [];
    global.BroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn((payload) => {
        listeners.forEach((listener) => listener({ data: payload }));
      }),
      addEventListener: jest.fn((event, handler) => {
        if (event === 'message') listeners.push(handler);
      }),
      removeEventListener: jest.fn((event, handler) => {
        if (event === 'message') {
          const index = listeners.indexOf(handler);
          if (index >= 0) listeners.splice(index, 1);
        }
      }),
    }));

    const handler = jest.fn();
    const unsubscribe = subscribeCatalogApplied(handler);
    postCatalogApplied('2026-08-23T10:00:00Z');

    expect(handler).toHaveBeenCalledWith('2026-08-23T10:00:00Z');
    unsubscribe();
  });

  test('fallback storage event не ломает основную работу', () => {
    delete global.BroadcastChannel;
    const handler = jest.fn();
    subscribeCatalogApplied(handler);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'ivanor.catalog.cloudVersion.ElistaIvanor',
        newValue: '2026-08-23T11:00:00Z',
      })
    );

    expect(handler).toHaveBeenCalledWith('2026-08-23T11:00:00Z');
  });

  test('не доставляет событие другого storeId', () => {
    const handler = jest.fn();
    const unsubscribe = subscribeCatalogApplied(handler, 'store-a');

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'ivanor.catalog.cloudVersion.store-b',
        newValue: 'version-b',
      })
    );
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'ivanor.catalog.cloudVersion.store-a',
        newValue: 'version-a',
      })
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('version-a');
    unsubscribe();
  });

  test('LS-ping срабатывает без смены cloudVersion', () => {
    delete global.BroadcastChannel;
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem');
    const handler = jest.fn();
    const unsubscribe = subscribeCatalogApplied(handler, 'store-a');

    postCatalogApplied('same-version', 'store-a');

    expect(setItem).toHaveBeenCalledWith(
      CATALOG_SYNC_EVENT_KEY,
      JSON.stringify({
        type: 'catalog-applied',
        storeId: 'store-a',
        version: 'same-version',
      })
    );
    expect(removeItem).toHaveBeenCalledWith(CATALOG_SYNC_EVENT_KEY);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: CATALOG_SYNC_EVENT_KEY,
        newValue: JSON.stringify({
          type: 'catalog-applied',
          storeId: 'store-a',
          version: 'same-version',
        }),
      })
    );

    expect(handler).toHaveBeenCalledWith('same-version');
    unsubscribe();
  });

  test('LS-ping фильтрует чужой storeId', () => {
    delete global.BroadcastChannel;
    const handler = jest.fn();
    const unsubscribe = subscribeCatalogApplied(handler, 'store-a');

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: CATALOG_SYNC_EVENT_KEY,
        newValue: JSON.stringify({
          type: 'catalog-applied',
          storeId: 'store-b',
          version: 'v-b',
        }),
      })
    );

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });
});
