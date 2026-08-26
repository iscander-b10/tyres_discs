/**
 * Frozen demo snapshot: meta.bytes задаёт %, apply в store demo, без live /v2.
 */

import { DEMO_STORE_ID } from '../../app/demoWorkspace';
import { getCartStorageKey } from '../../cart/cartStorage';
import { getCatalogDatabaseName } from '../catalogIdb/catalogSchema';
import {
  applyCatalogSnapshot,
  fetchCatalogSnapshot,
} from '../catalogSync/catalogSyncService';
import indexedDBService from '../indexedDBService';
import {
  formatDemoCatalogDate,
  loadFrozenDemoCatalog,
  resolveDemoMetaUrl,
  resolveDemoSnapshotUrl,
} from './demoCatalogService';

jest.mock('../indexedDBService', () => ({
  __esModule: true,
  default: {
    setActiveStore: jest.fn(() => 1),
    isActiveStore: jest.fn(() => true),
  },
}));

jest.mock('../catalogSync/catalogSyncLock', () => ({
  withCatalogSyncLock: async (_storeId, fn) => fn(),
}));

jest.mock('../catalogSync/catalogSyncService', () => ({
  __esModule: true,
  applyCatalogSnapshot: jest.fn(),
  fetchCatalogSnapshot: jest.fn(),
}));

describe('demoCatalogService', () => {
  const snapshot = {
    schemaVersion: 1,
    version: '2026-08-25T15:10:00+03:00',
    suppliers: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    indexedDBService.setActiveStore.mockImplementation(() => 1);
    indexedDBService.isActiveStore.mockReturnValue(true);
    global.fetch = jest.fn();
    applyCatalogSnapshot.mockResolvedValue({
      applied: true,
      writes: 1,
      skipped: false,
    });
    fetchCatalogSnapshot.mockResolvedValue(snapshot);
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('formatDemoCatalogDate из version/frozenAt', () => {
    expect(formatDemoCatalogDate('2026-08-25T15:10:00+03:00')).toBe(
      '25.08.2026'
    );
    expect(formatDemoCatalogDate('2026-08-25')).toBe('25.08.2026');
    expect(formatDemoCatalogDate('')).toBe('');
  });

  test('URL по умолчанию — PUBLIC_URL/demo, не live catalog API', () => {
    expect(resolveDemoSnapshotUrl()).toMatch(/\/demo\/snapshot\.json$/);
    expect(resolveDemoMetaUrl()).toMatch(/\/demo\/meta\.json$/);
    expect(resolveDemoSnapshotUrl()).not.toMatch(/\/v2\/catalog\//);
  });

  test('пустой IDB: fetch static snapshot + apply, progress от meta.bytes', async () => {
    const onProgress = jest.fn();
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bytes: 48_000_000,
        version: snapshot.version,
        frozenAt: '2026-08-25',
      }),
    });
    fetchCatalogSnapshot.mockImplementation(async (_url, { onDownloadProgress }) => {
      onDownloadProgress?.({
        receivedBytes: 12_000_000,
        totalBytes: null,
        complete: false,
      });
      onDownloadProgress?.({
        receivedBytes: 48_000_000,
        totalBytes: null,
        complete: true,
      });
      return snapshot;
    });

    await expect(
      loadFrozenDemoCatalog({ storeId: DEMO_STORE_ID, onProgress })
    ).resolves.toEqual({
      status: 'applied',
      version: snapshot.version,
      frozenAt: '2026-08-25',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/demo\/meta\.json$/),
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(fetchCatalogSnapshot).toHaveBeenCalledWith(
      expect.stringMatching(/\/demo\/snapshot\.json$/),
      expect.any(Object)
    );
    expect(applyCatalogSnapshot).toHaveBeenCalledWith(snapshot, {
      storeId: DEMO_STORE_ID,
      generation: 1,
    });
    expect(indexedDBService.setActiveStore).toHaveBeenCalledWith(DEMO_STORE_ID);

    const downloadEvents = onProgress.mock.calls
      .map(([event]) => event)
      .filter((event) => event.phase === 'download');
    expect(downloadEvents.some((event) => event.totalBytes === 48_000_000)).toBe(
      true
    );
    expect(downloadEvents.some((event) => event.progress > 0)).toBe(true);
    expect(JSON.stringify(onProgress.mock.calls)).not.toMatch(/МБ/);
  });

  test('storeId demo изолирован от live IDB и корзины', () => {
    expect(getCatalogDatabaseName('demo')).toBe('CatalogDatabase.demo');
    expect(getCatalogDatabaseName('ElistaIvanor')).toBe(
      `CatalogDatabase.${encodeURIComponent('ElistaIvanor')}`
    );
    expect(getCatalogDatabaseName('demo')).not.toBe(
      getCatalogDatabaseName('ElistaIvanor')
    );
    expect(getCartStorageKey('demo', 'demo')).toBe('cart.staff.v3.demo.demo');
    expect(getCartStorageKey('account-a', 'ElistaIvanor')).not.toBe(
      getCartStorageKey('demo', 'demo')
    );
  });
});
