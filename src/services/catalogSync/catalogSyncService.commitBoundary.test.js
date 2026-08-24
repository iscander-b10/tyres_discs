import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import indexedDBService, { CATALOG_STORES } from '../indexedDBService';
import { getCatalogVersionKey } from './catalogStoreNamespace';
import * as catalogSyncChannel from './catalogSyncChannel';
import {
  applyCatalogSnapshot,
  checkAndSyncCatalog,
} from './catalogSyncService';

/**
 * Моки: fetch, postCatalogApplied.
 * Реально: catalogSyncService + indexedDBService + fake-indexeddb.
 * Риск: P0 — validation/abort не должны трогать IDB commit-boundary и localStorage.
 */

jest.mock('./catalogSyncChannel', () => ({
  postCatalogApplied: jest.fn(),
}));

const API_BASE_ENV = 'REACT_APP_CATALOG_API_BASE';
const STORE_ID_ENV = 'REACT_APP_STORE_ID';
const STORE_ID = 'commit-boundary-store';
const VERSION = '2026-08-24T10:00:00Z';
const VERSION_OLD = '2026-08-23T10:00:00Z';
const VERSION_KEY = getCatalogVersionKey(STORE_ID);

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

const replace = (items = []) => ({ action: 'replace', status: 'ok', items });
const purge = () => ({ action: 'purge', status: 'ok' });
const keepPrevious = () => ({ action: 'keepPrevious', status: 'keptPrevious' });

const tire = (over = {}) => ({
  id: 'tire-1',
  code: 'T1',
  supplier: 'Поставщик A',
  amount: 4,
  price: 1000,
  sellingPrice: 1200,
  sizeTitle: '205/55R16',
  width: 205,
  profile: 55,
  diameter: 'R16',
  season: 's',
  ...over,
});

const snapshotWith = ({
  tyres,
  discs,
  supplier = 'Поставщик A',
  version = VERSION,
  extraSuppliers = {},
} = {}) => ({
  version,
  schemaVersion: 1,
  suppliers: {
    'supplier-a': {
      supplier,
      tyres: tyres ?? replace([tire()]),
      discs: discs ?? purge(),
    },
    ...extraSuppliers,
  },
});

const resetService = () => {
  indexedDBService.catalogDb?.close?.();
  indexedDBService.catalogDb = null;
  indexedDBService.db = null;
  indexedDBService.discDb = null;
  indexedDBService._migrationComplete = false;
  indexedDBService._ensurePromise = null;
  indexedDBService.setActiveStore(STORE_ID);
};

describe('catalogSync commit-boundary (реальный IndexedDBService)', () => {
  const originalApiBase = process.env[API_BASE_ENV];
  const originalStoreId = process.env[STORE_ID_ENV];
  let originalIndexedDB;
  let originalKeyRange;

  beforeEach(() => {
    originalIndexedDB = global.indexedDB;
    originalKeyRange = global.IDBKeyRange;
    global.indexedDB = new FDBFactory();
    global.IDBKeyRange = FDBKeyRange;
    process.env[API_BASE_ENV] = 'https://catalog.example';
    process.env[STORE_ID_ENV] = STORE_ID;
    window.localStorage.clear();
    global.fetch = jest.fn();
    catalogSyncChannel.postCatalogApplied.mockClear();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetService();
  });

  afterEach(() => {
    indexedDBService.catalogDb?.close?.();
    global.indexedDB = originalIndexedDB;
    global.IDBKeyRange = originalKeyRange;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalApiBase === undefined) delete process.env[API_BASE_ENV];
    else process.env[API_BASE_ENV] = originalApiBase;
    if (originalStoreId === undefined) delete process.env[STORE_ID_ENV];
    else process.env[STORE_ID_ENV] = originalStoreId;
  });

  test('некорректный snapshot не пишет в IDB и не трогает localStorage/broadcast', async () => {
    window.localStorage.setItem(VERSION_KEY, VERSION_OLD);

    await expect(
      applyCatalogSnapshot(
        snapshotWith({
          tyres: replace([tire({ id: '' })]),
        }),
        { storeId: STORE_ID }
      )
    ).rejects.toThrow(/Некорректный snapshot/);

    expect(window.localStorage.getItem(VERSION_KEY)).toBe(VERSION_OLD);
    expect(catalogSyncChannel.postCatalogApplied).not.toHaveBeenCalled();
    await expect(indexedDBService.searchTires({})).resolves.toEqual([]);
    await expect(indexedDBService.getPersistedCatalogVersion()).resolves.toBe('');
  });

  test('неизвестная schemaVersion не вызывает apply в IDB', async () => {
    await expect(
      applyCatalogSnapshot(
        {
          version: VERSION,
          schemaVersion: 99,
          suppliers: {
            a: {
              supplier: 'Поставщик A',
              tyres: purge(),
              discs: purge(),
            },
          },
        },
        { storeId: STORE_ID }
      )
    ).rejects.toMatchObject({
      validationReport: expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ code: 'UNSUPPORTED_SCHEMA_VERSION' }),
        ]),
      }),
    });
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();
    expect(catalogSyncChannel.postCatalogApplied).not.toHaveBeenCalled();
  });

  test('purge пустого поставщика чистит только его строки; broadcast после commit', async () => {
    await applyCatalogSnapshot(
      snapshotWith({
        version: VERSION_OLD,
        extraSuppliers: {
          'supplier-b': {
            supplier: 'Поставщик B',
            tyres: replace([
              tire({
                id: 'tire-b',
                code: 'TB',
                supplier: 'Поставщик B',
              }),
            ]),
            discs: purge(),
          },
        },
      }),
      { storeId: STORE_ID }
    );
    catalogSyncChannel.postCatalogApplied.mockClear();
    window.localStorage.setItem(VERSION_KEY, VERSION_OLD);

    await applyCatalogSnapshot(
      snapshotWith({
        tyres: purge(),
        extraSuppliers: {
          'supplier-b': {
            supplier: 'Поставщик B',
            tyres: keepPrevious(),
            discs: keepPrevious(),
          },
        },
      }),
      { storeId: STORE_ID }
    );

    const tires = await indexedDBService.searchTires({});
    expect(tires.map((item) => item.id)).toEqual(['tire-b']);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe(VERSION);
    expect(catalogSyncChannel.postCatalogApplied).toHaveBeenCalledWith(
      VERSION,
      STORE_ID
    );
  });

  test('abort put не обновляет localStorage и не шлёт broadcast', async () => {
    await applyCatalogSnapshot(
      snapshotWith({ version: VERSION_OLD }),
      { storeId: STORE_ID }
    );
    window.localStorage.setItem(VERSION_KEY, VERSION_OLD);
    catalogSyncChannel.postCatalogApplied.mockClear();

    const database = indexedDBService.catalogDb;
    const originalTransaction = database.transaction.bind(database);
    database.transaction = function transaction(storeNames, mode) {
      const tx = originalTransaction(storeNames, mode);
      const originalObjectStore = tx.objectStore.bind(tx);
      tx.objectStore = function objectStore(name) {
        const store = originalObjectStore(name);
        if (name !== CATALOG_STORES.tires) return store;
        const originalPut = store.put.bind(store);
        store.put = function put(item) {
          if (item?.id === 'tire-boom') {
            throw Object.assign(new Error('IndexedDB transaction aborted'), {
              name: 'UnknownError',
            });
          }
          return originalPut(item);
        };
        return store;
      };
      return tx;
    };

    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        jsonResponse(
          snapshotWith({
            tyres: replace([tire({ id: 'tire-boom', code: 'TB' })]),
          })
        )
      );

    await expect(checkAndSyncCatalog({ force: true, storeId: STORE_ID })).resolves.toEqual({
      status: 'error',
      error: 'IndexedDB transaction aborted',
    });

    expect(window.localStorage.getItem(VERSION_KEY)).toBe(VERSION_OLD);
    expect(catalogSyncChannel.postCatalogApplied).not.toHaveBeenCalled();
    const tires = await indexedDBService.searchTires({});
    expect(tires.map((item) => item.id)).toEqual(['tire-1']);
  });
});
