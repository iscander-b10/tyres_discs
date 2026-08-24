import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import indexedDBService, {
  CATALOG_DB_NAME,
  CATALOG_METADATA_KEYS,
  CATALOG_STORES,
  DEFAULT_CATALOG_STORE_ID,
  getCatalogDatabaseName,
  LEGACY_DB_NAMES,
  LEGACY_MIGRATION_MARKER,
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

const seedDatabase = (name, stores) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.entries(stores).forEach(([storeName, { keyPath, records }]) => {
        const store = db.createObjectStore(storeName, { keyPath });
        (records || []).forEach((record) => store.put(record));
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });

const readAllFromDb = (name, storeName) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const getAll = tx.objectStore(storeName).getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve(getAll.result || []);
      };
      getAll.onerror = () => {
        db.close();
        reject(getAll.error);
      };
    };
  });

const seedUnnamedCatalog = async () => {
  await seedDatabase(CATALOG_DB_NAME, {
    [CATALOG_STORES.tires]: {
      keyPath: 'id',
      records: [tire('legacy-unified')],
    },
    [CATALOG_STORES.discs]: {
      keyPath: 'id',
      records: [disc('legacy-unified-disc')],
    },
    [CATALOG_STORES.metadata]: {
      keyPath: 'key',
      records: [
        {
          key: CATALOG_METADATA_KEYS.snapshotVersion,
          value: 'legacy-unnamed-version',
        },
      ],
    },
  });
  await seedDatabase(LEGACY_DB_NAMES.tires, {
    [CATALOG_STORES.tires]: {
      keyPath: 'id',
      records: [tire('legacy-tires-only')],
    },
  });
  await seedDatabase(LEGACY_DB_NAMES.discs, {
    [CATALOG_STORES.discs]: {
      keyPath: 'id',
      records: [disc('legacy-discs-only')],
    },
  });
};

describe('legacy catalog isolation', () => {
  let originalIndexedDB;
  let originalKeyRange;
  let originalStoreEnv;

  beforeEach(() => {
    originalIndexedDB = global.indexedDB;
    originalKeyRange = global.IDBKeyRange;
    originalStoreEnv = process.env.REACT_APP_STORE_ID;
    global.indexedDB = new FDBFactory();
    global.IDBKeyRange = FDBKeyRange;
    window.localStorage.clear();
  });

  afterEach(() => {
    indexedDBService.catalogDb?.close?.();
    global.indexedDB = originalIndexedDB;
    global.IDBKeyRange = originalKeyRange;
    if (originalStoreEnv === undefined) {
      delete process.env.REACT_APP_STORE_ID;
    } else {
      process.env.REACT_APP_STORE_ID = originalStoreEnv;
    }
  });

  test('activeStore=AnotherStore при REACT_APP_STORE_ID=AnotherStore не копирует legacy CatalogDatabase', async () => {
    process.env.REACT_APP_STORE_ID = 'AnotherStore';
    await seedUnnamedCatalog();
    window.localStorage.setItem(
      'ivanor.catalog.cloudVersion',
      'should-not-become-another-store-version'
    );
    const opened = [];
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      opened.push(args[0]);
      return originalOpen(...args);
    };
    const deleted = [];
    const originalDelete = indexedDB.deleteDatabase.bind(indexedDB);
    indexedDB.deleteDatabase = (name) => {
      deleted.push(name);
      return originalDelete(name);
    };

    resetService('AnotherStore');
    await indexedDBService.ensureCatalogReady();

    expect(opened).not.toContain(CATALOG_DB_NAME);
    expect(opened).not.toContain(LEGACY_DB_NAMES.tires);
    expect(opened).not.toContain(LEGACY_DB_NAMES.discs);
    expect(await indexedDBService.searchTires({})).toEqual([]);
    expect(await indexedDBService.searchDiscs({})).toEqual([]);
    expect(await indexedDBService.getPersistedCatalogVersion()).toBe('');
    expect(
      window.localStorage.getItem('ivanor.catalog.cloudVersion')
    ).toBe('should-not-become-another-store-version');
    expect(deleted).not.toContain(CATALOG_DB_NAME);
    expect(deleted).not.toContain(getCatalogDatabaseName('AnotherStore'));
    expect(await readAllFromDb(CATALOG_DB_NAME, CATALOG_STORES.tires)).toEqual([
      tire('legacy-unified'),
    ]);
  });

  test('activeStore=ElistaIvanor копирует legacy и ставит маркер миграции', async () => {
    process.env.REACT_APP_STORE_ID = 'AnotherStore';
    await seedUnnamedCatalog();
    window.localStorage.setItem(
      'ivanor.catalog.cloudVersion',
      'legacy-ls-version'
    );

    resetService(DEFAULT_CATALOG_STORE_ID);
    await indexedDBService.ensureCatalogReady();

    expect((await indexedDBService.searchTires({})).map((item) => item.id)).toEqual(
      ['legacy-unified']
    );
    expect((await indexedDBService.searchDiscs({})).map((item) => item.id)).toEqual(
      ['legacy-unified-disc']
    );
    expect(await indexedDBService.getPersistedCatalogVersion()).toBe(
      'legacy-unnamed-version'
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
              .get(CATALOG_METADATA_KEYS.migrationMarker);
            req.onsuccess = () => resolve(req.result?.value);
            req.onerror = () => reject(req.error);
          })
        : null
    ).toBe(LEGACY_MIGRATION_MARKER);
  });

  test('после успешной Елиста-миграции удаляет только legacy-базы', async () => {
    process.env.REACT_APP_STORE_ID = 'AnotherStore';
    await seedUnnamedCatalog();
    await seedDatabase(getCatalogDatabaseName('AnotherStore'), {
      [CATALOG_STORES.tires]: {
        keyPath: 'id',
        records: [tire('another-store-keep')],
      },
      [CATALOG_STORES.discs]: { keyPath: 'id', records: [] },
      [CATALOG_STORES.metadata]: { keyPath: 'key', records: [] },
    });
    window.localStorage.setItem(
      'ivanor.catalog.cloudVersion',
      'legacy-ls-version'
    );

    const deleted = [];
    const originalDelete = indexedDB.deleteDatabase.bind(indexedDB);
    indexedDB.deleteDatabase = (name) => {
      deleted.push(name);
      return originalDelete(name);
    };

    resetService(DEFAULT_CATALOG_STORE_ID);
    await indexedDBService.ensureCatalogReady();

    expect(deleted).toEqual(
      expect.arrayContaining([
        LEGACY_DB_NAMES.tires,
        LEGACY_DB_NAMES.discs,
        CATALOG_DB_NAME,
      ])
    );
    expect(deleted).not.toContain(getCatalogDatabaseName('AnotherStore'));
    expect(window.localStorage.getItem('ivanor.catalog.cloudVersion')).toBeNull();
    expect(
      await readAllFromDb(
        getCatalogDatabaseName('AnotherStore'),
        CATALOG_STORES.tires
      )
    ).toEqual([tire('another-store-keep')]);
  });
});
