import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import indexedDBService, {
  CATALOG_METADATA_KEYS,
  CATALOG_STORES,
  getCatalogDatabaseName,
} from './indexedDBService';

/**
 * Моки: нет (кроме изоляции FDBFactory на тест).
 * Реально: indexedDBService + fake-indexeddb (IDB API: stores, indexes, abort).
 * Риск: P0 — custom fake расходится с реальной семантикой транзакций/схемы.
 */

const supplierA = 'Поставщик A';
const supplierB = 'Поставщик B';
const versionV1 = '2026-08-23T09:00:00Z';
const versionV2 = '2026-08-23T10:00:00Z';

const tire = (id, supplier = supplierA, extra = {}) => ({
  id,
  supplier,
  ...extra,
});
const disc = (id, supplier = supplierA) => ({ id, supplier });

const resetService = (storeId) => {
  indexedDBService.catalogDb?.close?.();
  indexedDBService.catalogDb = null;
  indexedDBService.db = null;
  indexedDBService.discDb = null;
  indexedDBService._migrationComplete = false;
  indexedDBService._ensurePromise = null;
  indexedDBService.setActiveStore(storeId);
};

const installFailingTirePut = (itemId) => {
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
        if (item?.id === itemId) {
          throw Object.assign(new Error('put failed'), { name: 'UnknownError' });
        }
        return originalPut(item);
      };
      return store;
    };
    return tx;
  };
};

describe('CatalogDatabase на fake-indexeddb', () => {
  let originalIndexedDB;
  let originalKeyRange;

  beforeEach(() => {
    originalIndexedDB = global.indexedDB;
    originalKeyRange = global.IDBKeyRange;
    global.indexedDB = new FDBFactory();
    global.IDBKeyRange = FDBKeyRange;
    window.localStorage.clear();
    resetService(`fake-idb-${Math.random()}`);
  });

  afterEach(() => {
    indexedDBService.catalogDb?.close?.();
    global.indexedDB = originalIndexedDB;
    global.IDBKeyRange = originalKeyRange;
  });

  test('создаёт stores и indexes схемы v1', async () => {
    const { database } = await indexedDBService._getReadyContext();
    expect([...database.objectStoreNames].sort()).toEqual(
      ['discs', 'metadata', 'tires'].sort()
    );

    const tires = database.transaction('tires').objectStore('tires');
    const discs = database.transaction('discs').objectStore('discs');
    expect([...tires.indexNames]).toEqual(
      expect.arrayContaining([
        'supplier',
        'brand',
        'diameter',
        'season',
        'spikes',
        'amount',
      ])
    );
    expect([...discs.indexNames]).toEqual(
      expect.arrayContaining([
        'supplier',
        'brand',
        'diameter',
        'diskType',
        'pcd',
        'amount',
      ])
    );
    expect(database.name).toBe(
      getCatalogDatabaseName(indexedDBService.getActiveStore().storeId)
    );
  });

  test('purge удаляет только строки выбранного поставщика', async () => {
    await indexedDBService.applyCatalogSnapshot(
      [
        {
          supplier: supplierA,
          category: CATALOG_STORES.tires,
          action: 'replace',
          items: [tire('a-1'), tire('a-2')],
        },
        {
          supplier: supplierB,
          category: CATALOG_STORES.tires,
          action: 'replace',
          items: [tire('b-1', supplierB)],
        },
        {
          supplier: supplierA,
          category: CATALOG_STORES.discs,
          action: 'replace',
          items: [disc('da-1')],
        },
        {
          supplier: supplierB,
          category: CATALOG_STORES.discs,
          action: 'keepPrevious',
        },
      ],
      versionV1
    );

    await indexedDBService.applyCatalogSnapshot(
      [
        {
          supplier: supplierA,
          category: CATALOG_STORES.tires,
          action: 'purge',
        },
        {
          supplier: supplierB,
          category: CATALOG_STORES.tires,
          action: 'keepPrevious',
        },
        {
          supplier: supplierA,
          category: CATALOG_STORES.discs,
          action: 'keepPrevious',
        },
        {
          supplier: supplierB,
          category: CATALOG_STORES.discs,
          action: 'keepPrevious',
        },
      ],
      versionV2
    );

    const remainingTires = await indexedDBService.searchTires({});
    const remainingDiscs = await indexedDBService.searchDiscs({});
    expect(remainingTires.map((item) => item.id).sort()).toEqual(['b-1']);
    expect(remainingDiscs.map((item) => item.id)).toEqual(['da-1']);
    await expect(indexedDBService.getPersistedCatalogVersion()).resolves.toBe(
      versionV2
    );
  });

  test('ошибка put откатывает транзакцию и не меняет metadata version', async () => {
    await indexedDBService.applyCatalogSnapshot(
      [
        {
          supplier: supplierA,
          category: CATALOG_STORES.tires,
          action: 'replace',
          items: [tire('old-a')],
        },
        {
          supplier: supplierA,
          category: CATALOG_STORES.discs,
          action: 'replace',
          items: [disc('old-d')],
        },
      ],
      versionV1
    );

    installFailingTirePut('new-fail');

    await expect(
      indexedDBService.applyCatalogSnapshot(
        [
          {
            supplier: supplierA,
            category: CATALOG_STORES.tires,
            action: 'replace',
            items: [tire('new-ok'), tire('new-fail')],
          },
          {
            supplier: supplierA,
            category: CATALOG_STORES.discs,
            action: 'replace',
            items: [disc('new-d')],
          },
        ],
        versionV2
      )
    ).rejects.toThrow('put failed');

    const tires = await indexedDBService.searchTires({});
    const discs = await indexedDBService.searchDiscs({});
    expect(tires.map((item) => item.id)).toEqual(['old-a']);
    expect(discs.map((item) => item.id)).toEqual(['old-d']);
    await expect(indexedDBService.getPersistedCatalogVersion()).resolves.toBe(
      versionV1
    );
    expect(
      indexedDBService.catalogDb
        ? await new Promise((resolve, reject) => {
            const tx = indexedDBService.catalogDb.transaction(
              CATALOG_STORES.metadata,
              'readonly'
            );
            const req = tx
              .objectStore(CATALOG_STORES.metadata)
              .get(CATALOG_METADATA_KEYS.snapshotVersion);
            req.onsuccess = () => resolve(req.result?.value);
            req.onerror = () => reject(req.error);
          })
        : null
    ).toBe(versionV1);
  });
});
