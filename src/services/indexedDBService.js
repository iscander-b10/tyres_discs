import { mergePreferredShowcaseCandidates } from '../catalog/showcase/preferredCandidates';
import {
  getSafeCatalogStoreId,
  resolveCatalogStoreId,
} from './catalogSync/catalogStoreNamespace';

/** Единая схема каталога — единственный источник имён stores и metadata keys. */
export const CATALOG_DB_NAME = 'CatalogDatabase';
export const CATALOG_DB_VERSION = 1;
export const getCatalogDatabaseName = (storeId) =>
  `${CATALOG_DB_NAME}.${getSafeCatalogStoreId(storeId)}`;
export const CATALOG_STORES = {
  tires: 'tires',
  discs: 'discs',
  metadata: 'metadata',
};
export const CATALOG_METADATA_KEYS = {
  snapshotVersion: 'snapshotVersion',
  migrationMarker: 'migrationMarker',
  schemaVersion: 'schemaVersion',
};
export const LEGACY_DB_NAMES = {
  tires: 'TireDatabase',
  discs: 'DiscDatabase',
};
export const LEGACY_MIGRATION_MARKER = 'legacy-v1-completed';
export const CATALOG_SCHEMA_VERSION = 1;

const TIRE_INDEXES = [
  ['supplier', 'supplier'],
  ['brand', 'brand'],
  ['model', 'model'],
  ['title', 'title'],
  ['photoUrl', 'photoUrl'],
  ['width', 'width'],
  ['profile', 'profile'],
  ['diameter', 'diameter'],
  ['season', 'season'],
  ['spikes', 'spikes'],
  ['price', 'price'],
  ['amount', 'amount'],
];

const DISC_INDEXES = [
  ['supplier', 'supplier'],
  ['brand', 'brand'],
  ['model', 'model'],
  ['title', 'title'],
  ['photoUrl', 'photoUrl'],
  ['diameter', 'diameter'],
  ['width', 'width'],
  ['pcd', 'pcd'],
  ['et', 'et'],
  ['cb', 'cb'],
  ['pn', 'pn'],
  ['diskType', 'diskType'],
  ['price', 'price'],
  ['amount', 'amount'],
];

const ALL_CATALOG_STORES = [
  CATALOG_STORES.tires,
  CATALOG_STORES.discs,
  CATALOG_STORES.metadata,
];

const compareCatalogVersions = (left, right) => {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const readLegacyStore = (dbName, storeName) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction([storeName], 'readonly');
      const getAllRequest = tx.objectStore(storeName).getAll();
      getAllRequest.onsuccess = () => {
        db.close();
        resolve(getAllRequest.result || []);
      };
      getAllRequest.onerror = () => {
        db.close();
        reject(getAllRequest.error);
      };
    };
  });

const replaceSupplierItemsInStore = (store, supplier, items, onComplete, onError) => {
  const clearRequest = store.index('supplier').openCursor(IDBKeyRange.only(supplier));
  clearRequest.onerror = () => onError(clearRequest.error);
  clearRequest.onsuccess = () => {
    try {
      const cursor = clearRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }
      items.forEach((item) => store.put(item));
      onComplete();
    } catch (error) {
      onError(error);
    }
  };
};

const isActiveFilterValue = (value) => {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const matchesBrandFilter = (itemBrand, brandFilter) => {
  if (!isActiveFilterValue(brandFilter)) return true;
  if (Array.isArray(brandFilter)) return brandFilter.includes(itemBrand);
  return itemBrand === brandFilter;
};

const getSingleBrandForIndex = (brandFilter) => {
  if (Array.isArray(brandFilter)) {
    return brandFilter.length === 1 ? brandFilter[0] : null;
  }
  return brandFilter || null;
};

const normalizeNumericFieldValue = (value) => {
  const num = parseFloat(value);
  return Number.isNaN(num) ? null : num;
};

const sortDiameterValues = (values) =>
  [...values].sort((a, b) => {
    const strA = a.toString();
    const strB = b.toString();
    const numA = parseFloat(strA) || 0;
    const numB = parseFloat(strB) || 0;

    if (numA !== numB) {
      return numA - numB;
    }

    return strA.localeCompare(strB);
  });

const sortNumericValues = (values) => [...values].sort((a, b) => a - b);

const sortDiscDiameterValues = (values) =>
  [...values].sort((a, b) => {
    const strA = a.toString();
    const strB = b.toString();
    const numA = parseFloat(strA.replace(/[^\d.]/g, '')) || 0;
    const numB = parseFloat(strB.replace(/[^\d.]/g, '')) || 0;

    if (numA !== numB) {
      return numA - numB;
    }

    return strA.localeCompare(strB);
  });

const sortDiscNumericValues = (values) =>
  [...values].sort((a, b) => {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numA - numB;
  });

const isValidCatalogKey = (value) =>
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isFinite(value));

const isStructuredCloneableFallback = (value, seen = new Set()) => {
  if (
    value === null ||
    value === undefined ||
    ['string', 'number', 'boolean', 'bigint'].includes(typeof value)
  ) {
    return true;
  }
  if (['function', 'symbol'].includes(typeof value)) return false;
  if (seen.has(value)) return true;
  if (
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof Promise
  ) {
    return false;
  }

  seen.add(value);
  try {
    return Reflect.ownKeys(value).every(
      (key) =>
        typeof key !== 'symbol' &&
        isStructuredCloneableFallback(value[key], seen)
    );
  } catch {
    return false;
  }
};

const canBeStoredInIndexedDB = (value) => {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.structuredClone === 'function'
    ) {
      window.structuredClone(value);
      return true;
    }
    return isStructuredCloneableFallback(value);
  } catch {
    return false;
  }
};

const isValidCatalogItem = (item) =>
  item !== null &&
  typeof item === 'object' &&
  !Array.isArray(item) &&
  isValidCatalogKey(item.id) &&
  isValidCatalogKey(item.supplier) &&
  canBeStoredInIndexedDB(item);

export const validateCatalogItemsForSupplier = (
  items,
  supplier,
  entityName = 'товары'
) => {
  if (!isValidCatalogKey(supplier)) {
    throw new TypeError(`Поставщик для категории «${entityName}» обязателен`);
  }
  if (!Array.isArray(items)) {
    throw new TypeError(`Данные ${entityName} должны быть массивом`);
  }

  items.forEach((item, index) => {
    if (!isValidCatalogItem(item)) {
      throw new TypeError(
        `Некорректный товар ${entityName} с индексом ${index}`
      );
    }
    if (item.supplier !== supplier) {
      throw new Error(
        `Поставщик товара ${entityName} с индексом ${index} не совпадает с явным supplier`
      );
    }
  });
};

const prepareCatalogItems = (items, entityName) => {
  if (!Array.isArray(items)) {
    throw new TypeError(`Данные ${entityName} должны быть массивом`);
  }
  if (items.length === 0) {
    return { validItems: [], supplier: null, skipped: 0 };
  }

  const individuallyValid = items.filter(isValidCatalogItem);
  const supplier = individuallyValid[0]?.supplier;
  const validItems = individuallyValid.filter(
    (item) => item.supplier === supplier
  );

  if (validItems.length === 0) {
    throw new Error(`Все входные ${entityName} некорректны`);
  }

  return {
    validItems,
    supplier,
    skipped: items.length - validItems.length,
  };
};

const matchesTireDiameter = (itemDiameter, filterDiameter) => {
  if (!isActiveFilterValue(filterDiameter)) return true;
  return String(itemDiameter) === String(filterDiameter);
};

const matchesTireNumericField = (itemValue, filterValue) => {
  if (!isActiveFilterValue(filterValue)) return true;
  return Number(itemValue) === Number(filterValue);
};

const matchesTireParameterFilters = (item, filters = {}) => {
  if (!matchesTireNumericField(item.width, filters.width)) return false;
  if (!matchesTireNumericField(item.profile, filters.profile)) return false;
  if (!matchesTireDiameter(item.diameter, filters.diameter)) return false;
  if (filters.season && item.season !== filters.season) return false;
  return true;
};

const matchesDiscStringField = (itemValue, filterValue) => {
  if (!isActiveFilterValue(filterValue)) return true;
  return String(itemValue) === String(filterValue);
};

const matchesDiscRange = (itemValue, from, to) => {
  if (!isActiveFilterValue(from) && !isActiveFilterValue(to)) return true;
  const num = itemValue === undefined || itemValue === null ? NaN : Number(itemValue);
  if (Number.isNaN(num)) return false;
  if (isActiveFilterValue(from) && num < Number(from)) return false;
  if (isActiveFilterValue(to) && num > Number(to)) return false;
  return true;
};

const matchesDiscParameterFilters = (item, filters = {}) => {
  if (!matchesBrandFilter(item.brand, filters.brand)) return false;
  if (!matchesDiscStringField(item.supplier, filters.supplier)) return false;
  if (!matchesTireDiameter(item.diameter, filters.diameter)) return false;
  if (!matchesTireNumericField(item.pcd, filters.pcd)) return false;
  if (!matchesTireNumericField(item.pn, filters.pn)) return false;
  if (!matchesDiscStringField(item.diskType, filters.diskType)) return false;
  if (!matchesDiscRange(item.width, filters.widthFrom, filters.widthTo)) return false;
  if (!matchesDiscRange(item.cb, filters.cbFrom, filters.cbTo)) return false;
  if (!matchesDiscRange(item.et, filters.etFrom, filters.etTo)) return false;
  return true;
};

const addUniqueValue = (set, value) => {
  if (value != null) {
    set.add(value);
  }
};

/**
 * Общий сбор кандидатов витрины из object store (ранний лимит).
 *
 * `isEmpty: true` — весь store пуст (каталог не загружен).
 * Если store не пуст, но у `supplier` нет строк / in-stock кандидатов —
 * `isEmpty: false` и `candidates: []`: полки пустые, чипы остаются.
 * При переданном `supplier` обходим только индекс `supplier` (чужие не попадают в пул).
 *
 * `preferItem(item)` — позиции идут в приоритетный пул первым; при его наличии
 * курсор не обрывается на limit, пока не просмотрены все preferred (гарантия Ikon).
 */
const collectShowcaseCandidatesFromStore = (
  store,
  {
    candidateLimit = 480,
    minAmount = 1,
    supplier = null,
    preferItem = null,
  } = {}
) =>
  new Promise((resolve, reject) => {
    const countRequest = store.count();
    countRequest.onerror = () => reject(countRequest.error);

    countRequest.onsuccess = () => {
      const total = countRequest.result || 0;
      if (total === 0) {
        resolve({
          isEmpty: true,
          candidates: [],
        });
        return;
      }

      const preferred = [];
      const others = [];
      let settled = false;
      const hasPrefer = typeof preferItem === 'function';

      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      const considerItem = (item) => {
        if (supplier && item?.supplier !== supplier) return;

        const amount = Number(item?.amount);
        if (Number.isNaN(amount) || amount < minAmount) return;

        if (hasPrefer && preferItem(item)) {
          preferred.push(item);
          return;
        }

        if (others.length < candidateLimit) {
          others.push(item);
        }
      };

      const useSupplierIndex =
        Boolean(supplier) && store.indexNames.contains('supplier');
      const request = useSupplierIndex
        ? store.index('supplier').openCursor(IDBKeyRange.only(supplier))
        : store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          finish({
            isEmpty: false,
            candidates: hasPrefer
              ? mergePreferredShowcaseCandidates(
                  preferred,
                  others,
                  candidateLimit
                )
              : others.slice(0, candidateLimit),
          });
          return;
        }

        considerItem(cursor.value);

        // Без prefer — прежний ранний выход. С prefer — дочитываем store,
        // чтобы Ikon не отрезались лимитом 480 чужих SKU.
        if (!hasPrefer && others.length >= candidateLimit) {
          finish({ isEmpty: false, candidates: others.slice(0, candidateLimit) });
          return;
        }

        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    };
  });

class IndexedDBService {
  constructor() {
    this.activeStoreId = resolveCatalogStoreId();
    this._generation = 0;
    this.catalogDb = null;
    this._migrationComplete = false;
    this._ensurePromise = null;
    /** @deprecated тестовый shim */
    this.db = null;
    /** @deprecated тестовый shim */
    this.discDb = null;
  }

  setActiveStore(storeId) {
    const nextStoreId = resolveCatalogStoreId(storeId);
    if (nextStoreId === this.activeStoreId) {
      return this._generation;
    }

    this._generation += 1;
    this.activeStoreId = nextStoreId;
    this.catalogDb?.close?.();
    this.catalogDb = null;
    this.db = null;
    this.discDb = null;
    this._migrationComplete = false;
    this._ensurePromise = null;
    return this._generation;
  }

  invalidateActiveStore(storeId) {
    if (
      storeId &&
      this.activeStoreId &&
      resolveCatalogStoreId(storeId) !== this.activeStoreId
    ) {
      return false;
    }

    this._generation += 1;
    this.catalogDb?.close?.();
    this.activeStoreId = null;
    this.catalogDb = null;
    this.db = null;
    this.discDb = null;
    this._migrationComplete = false;
    this._ensurePromise = null;
    return true;
  }

  getActiveStore() {
    return {
      storeId: this.activeStoreId,
      generation: this._generation,
      databaseName: this.activeStoreId
        ? getCatalogDatabaseName(this.activeStoreId)
        : null,
    };
  }

  isActiveStore(storeId, generation) {
    return (
      Boolean(this.activeStoreId) &&
      resolveCatalogStoreId(storeId) === this.activeStoreId &&
      (generation === undefined || generation === this._generation)
    );
  }

  _createStaleStoreError() {
    const error = new Error('Результат IndexedDB относится к неактивному магазину');
    error.name = 'StaleCatalogStoreError';
    return error;
  }

  _assertActiveGeneration(generation) {
    if (generation !== this._generation) {
      throw this._createStaleStoreError();
    }
  }

  _resolveIfActive(resolve, reject, generation, value) {
    try {
      this._assertActiveGeneration(generation);
      resolve(value);
    } catch (error) {
      reject(error);
    }
  }

  async _getReadyContext() {
    const generation = this._generation;
    const database = await this.ensureCatalogReady(generation);
    this._assertActiveGeneration(generation);
    return { database, generation };
  }

  async ensureCatalogReady(expectedGeneration = this._generation) {
    this._assertActiveGeneration(expectedGeneration);
    if (this.catalogDb && this._migrationComplete) {
      return this.catalogDb;
    }
    if (!this._ensurePromise) {
      this._ensurePromise = this._doEnsureCatalogReady(expectedGeneration);
    }
    const ensurePromise = this._ensurePromise;
    try {
      const database = await ensurePromise;
      this._assertActiveGeneration(expectedGeneration);
      return database;
    } finally {
      if (this._ensurePromise === ensurePromise) {
        this._ensurePromise = null;
      }
    }
  }

  async _doEnsureCatalogReady(generation) {
    const database = await this.openCatalogDatabase(generation);
    if (!database) return null;

    const migrated = await this._isMigrationComplete(generation, database);
    this._assertActiveGeneration(generation);
    if (migrated) {
      this._migrationComplete = true;
      return database;
    }

    const shouldMigrateLegacy =
      this.activeStoreId === resolveCatalogStoreId(undefined);
    const legacySources = shouldMigrateLegacy
      ? await Promise.all([
          readLegacyStore(CATALOG_DB_NAME, CATALOG_STORES.tires),
          readLegacyStore(CATALOG_DB_NAME, CATALOG_STORES.discs),
          readLegacyStore(CATALOG_DB_NAME, CATALOG_STORES.metadata),
          readLegacyStore(LEGACY_DB_NAMES.tires, CATALOG_STORES.tires),
          readLegacyStore(LEGACY_DB_NAMES.discs, CATALOG_STORES.discs),
        ])
      : [[], [], [], [], []];
    const [
      unifiedTires,
      unifiedDiscs,
      unifiedMetadata,
      legacyTires,
      legacyDiscs,
    ] = legacySources;
    const legacyVersion =
      unifiedMetadata.find(
        (record) => record?.key === CATALOG_METADATA_KEYS.snapshotVersion
      )?.value || '';

    this._assertActiveGeneration(generation);
    await this._runLegacyMigrationTransaction(
      unifiedTires.length ? unifiedTires : legacyTires,
      unifiedDiscs.length ? unifiedDiscs : legacyDiscs,
      generation,
      database,
      legacyVersion
    );
    this._assertActiveGeneration(generation);
    this._migrationComplete = true;
    return database;
  }

  async openCatalogDatabase(expectedGeneration = this._generation) {
    this._assertActiveGeneration(expectedGeneration);
    if (this.catalogDb) {
      return this.catalogDb;
    }

    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
        resolve(null);
        return;
      }

      let request;
      try {
        request = indexedDB.open(
          getCatalogDatabaseName(this.activeStoreId),
          CATALOG_DB_VERSION
        );
      } catch {
        resolve(null);
        return;
      }

      request.onerror = () => resolve(null);

      request.onsuccess = () => {
        if (expectedGeneration !== this._generation) {
          request.result?.close?.();
          reject(this._createStaleStoreError());
          return;
        }
        this.catalogDb = request.result;
        this.db = this.catalogDb;
        this.discDb = this.catalogDb;
        resolve(this.catalogDb);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;

        const ensureStore = (storeName, keyPath, indexes) => {
          let store;
          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, { keyPath });
          } else {
            store = transaction.objectStore(storeName);
          }
          indexes.forEach(([name, keyPathValue]) => {
            if (!store.indexNames.contains(name)) {
              store.createIndex(name, keyPathValue, { unique: false });
            }
          });
          return store;
        };

        ensureStore(CATALOG_STORES.tires, 'id', TIRE_INDEXES);
        ensureStore(CATALOG_STORES.discs, 'id', DISC_INDEXES);
        if (!db.objectStoreNames.contains(CATALOG_STORES.metadata)) {
          db.createObjectStore(CATALOG_STORES.metadata, { keyPath: 'key' });
        }
      };
    });
  }

  /** @deprecated используйте ensureCatalogReady */
  async openDatabase() {
    return this.ensureCatalogReady();
  }

  /** @deprecated используйте ensureCatalogReady */
  async openDiscDatabase() {
    return this.ensureCatalogReady();
  }

  async _isMigrationComplete(
    generation = this._generation,
    database = this.catalogDb
  ) {
    this._assertActiveGeneration(generation);
    if (!database) return true;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [CATALOG_STORES.metadata],
        'readonly'
      );
      const request = transaction
        .objectStore(CATALOG_STORES.metadata)
        .get(CATALOG_METADATA_KEYS.migrationMarker);
      request.onsuccess = () => {
        try {
          this._assertActiveGeneration(generation);
          resolve(request.result?.value === LEGACY_MIGRATION_MARKER);
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async _runLegacyMigrationTransaction(
    legacyTires,
    legacyDiscs,
    generation = this._generation,
    database = this.catalogDb,
    migratedVersion = ''
  ) {
    this._assertActiveGeneration(generation);
    const legacyVersion =
      migratedVersion || this._readLegacyLocalStorageVersion();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        ALL_CATALOG_STORES,
        'readwrite'
      );
      const metadataStore = transaction.objectStore(CATALOG_STORES.metadata);
      const tiresStore = transaction.objectStore(CATALOG_STORES.tires);
      const discsStore = transaction.objectStore(CATALOG_STORES.discs);
      let abortCause = null;

      const abortTransaction = (error) => {
        abortCause = error;
        try {
          transaction.abort();
        } catch {
          /* ignore */
        }
      };

      transaction.oncomplete = () => {
        try {
          this._assertActiveGeneration(generation);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = () =>
        reject(
          abortCause ||
            transaction.error ||
            new Error('Миграция каталога отменена')
        );

      const markerRequest = metadataStore.get(
        CATALOG_METADATA_KEYS.migrationMarker
      );
      markerRequest.onerror = () => abortTransaction(markerRequest.error);
      markerRequest.onsuccess = () => {
        if (markerRequest.result?.value === LEGACY_MIGRATION_MARKER) {
          return;
        }

        try {
          legacyTires.forEach((item) => tiresStore.put(item));
          legacyDiscs.forEach((item) => discsStore.put(item));
          metadataStore.put({
            key: CATALOG_METADATA_KEYS.migrationMarker,
            value: LEGACY_MIGRATION_MARKER,
          });
          metadataStore.put({
            key: CATALOG_METADATA_KEYS.schemaVersion,
            value: CATALOG_SCHEMA_VERSION,
          });
          if (legacyVersion) {
            metadataStore.put({
              key: CATALOG_METADATA_KEYS.snapshotVersion,
              value: legacyVersion,
            });
          }
        } catch (error) {
          abortTransaction(error);
        }
      };
    });
  }

  _readLegacyLocalStorageVersion() {
    try {
      return window.localStorage.getItem('ivanor.catalog.cloudVersion') || '';
    } catch {
      return '';
    }
  }

  async getPersistedCatalogVersion() {
    const { database, generation } = await this._getReadyContext();
    if (!database) return '';
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [CATALOG_STORES.metadata],
        'readonly'
      );
      const request = transaction
        .objectStore(CATALOG_STORES.metadata)
        .get(CATALOG_METADATA_KEYS.snapshotVersion);
      request.onsuccess = () =>
        this._resolveIfActive(
          resolve,
          reject,
          generation,
          request.result?.value || ''
        );
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Reads the confirmed catalog version and all requested cart records from
   * one readonly transaction. Unknown-category references are checked in both
   * product stores for legacy cart migration.
   */
  async readCartCatalogItems(references) {
    const { database, generation } = await this._getReadyContext();
    const normalizedReferences = Array.isArray(references) ? references : [];
    const emptyResults = normalizedReferences.map((reference) => ({
      requestKey: reference.requestKey,
      matches: { tyres: null, discs: null },
    }));
    if (!database) {
      return { version: '', results: emptyResults };
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(ALL_CATALOG_STORES, 'readonly');
      const metadataStore = transaction.objectStore(CATALOG_STORES.metadata);
      const stores = {
        tyres: transaction.objectStore(CATALOG_STORES.tires),
        discs: transaction.objectStore(CATALOG_STORES.discs),
      };
      const results = normalizedReferences.map((reference) => ({
        requestKey: reference.requestKey,
        matches: { tyres: null, discs: null },
      }));
      let version = '';
      let abortCause = null;

      const abortTransaction = (error) => {
        abortCause = error;
        try {
          transaction.abort();
        } catch {
          reject(error);
        }
      };

      transaction.oncomplete = () =>
        this._resolveIfActive(resolve, reject, generation, { version, results });
      transaction.onabort = () =>
        reject(
          abortCause ||
            transaction.error ||
            new Error('Транзакция чтения корзины отменена')
        );

      const versionRequest = metadataStore.get(
        CATALOG_METADATA_KEYS.snapshotVersion
      );
      versionRequest.onsuccess = () => {
        version = versionRequest.result?.value || '';
      };
      versionRequest.onerror = () => abortTransaction(versionRequest.error);

      normalizedReferences.forEach((reference, index) => {
        const categories =
          reference.category === 'tyres' || reference.category === 'discs'
            ? [reference.category]
            : ['tyres', 'discs'];

        categories.forEach((category) => {
          const request = stores[category].get(reference.id);
          request.onsuccess = () => {
            results[index].matches[category] = request.result ?? null;
          };
          request.onerror = () => abortTransaction(request.error);
        });
      });
    });
  }

  async isCatalogEmpty() {
    const { database } = await this._getReadyContext();
    if (!database) return true;
    const [tires, discs] = await Promise.all([
      this.collectTireShowcaseCandidates({ candidateLimit: 1 }),
      this.collectDiscShowcaseCandidates({ candidateLimit: 1 }),
    ]);
    return Boolean(tires?.isEmpty && discs?.isEmpty);
  }

  /**
   * Атомарно применяет полный snapshot в одной readwrite-транзакции.
   * @param {Array<{ supplier: string, category: 'tyres'|'discs', action: string, items?: array }>} commands
   * @param {string} version
   */
  async applyCatalogSnapshot(commands, version) {
    const { database, generation } = await this._getReadyContext();
    if (!database) {
      throw new Error('IndexedDB недоступен для записи каталога');
    }

    const writes = commands
      .filter((command) => command.action !== 'keepPrevious')
      .map((command) => ({
        supplier: command.supplier,
        category: command.category,
        items: command.action === 'purge' ? [] : command.items,
      }));

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        ALL_CATALOG_STORES,
        'readwrite'
      );
      const tiresStore = transaction.objectStore(CATALOG_STORES.tires);
      const discsStore = transaction.objectStore(CATALOG_STORES.discs);
      const metadataStore = transaction.objectStore(CATALOG_STORES.metadata);
      let abortCause = null;
      let writeIndex = 0;
      let skippedDueToVersion = false;

      const abortTransaction = (error) => {
        abortCause = error;
        try {
          transaction.abort();
        } catch {
          /* ignore */
        }
      };

      transaction.oncomplete = () => {
        try {
          this._assertActiveGeneration(generation);
        } catch (error) {
          reject(error);
          return;
        }
        if (skippedDueToVersion) {
          resolve({ applied: false, writes: 0, skipped: true });
          return;
        }
        resolve({ applied: true, writes: writes.length, skipped: false });
      };
      transaction.onabort = () =>
        reject(
          abortCause ||
            transaction.error ||
            new Error('Транзакция snapshot каталога отменена')
        );

      const processNextWrite = () => {
        if (writeIndex >= writes.length) {
          try {
            metadataStore.put({
              key: CATALOG_METADATA_KEYS.snapshotVersion,
              value: version,
            });
          } catch (error) {
            abortTransaction(error);
          }
          return;
        }

        const write = writes[writeIndex];
        const store =
          write.category === CATALOG_STORES.discs ? discsStore : tiresStore;

        replaceSupplierItemsInStore(
          store,
          write.supplier,
          write.items,
          () => {
            writeIndex += 1;
            processNextWrite();
          },
          abortTransaction
        );
      };

      const versionRequest = metadataStore.get(
        CATALOG_METADATA_KEYS.snapshotVersion
      );
      versionRequest.onerror = () => abortTransaction(versionRequest.error);
      versionRequest.onsuccess = () => {
        const currentVersion = versionRequest.result?.value || '';
        if (compareCatalogVersions(version, currentVersion) <= 0) {
          skippedDueToVersion = true;
          return;
        }
        processNextWrite();
      };

    });
  }

  async saveTires(tires) {
    return this.saveCatalogItems({
      items: tires,
      storeName: CATALOG_STORES.tires,
      entityName: 'шины',
    });
  }

  async replaceTiresForSupplier(supplier, tires) {
    return this.replaceCatalogItems({
      supplier,
      items: tires,
      storeName: CATALOG_STORES.tires,
      entityName: 'шины',
    });
  }

  async saveDiscs(discs) {
    return this.saveCatalogItems({
      items: discs,
      storeName: CATALOG_STORES.discs,
      entityName: 'диски',
    });
  }

  async replaceDiscsForSupplier(supplier, discs) {
    return this.replaceCatalogItems({
      supplier,
      items: discs,
      storeName: CATALOG_STORES.discs,
      entityName: 'диски',
    });
  }

  async saveCatalogItems({ items, storeName, entityName }) {
    const { validItems, supplier, skipped } = prepareCatalogItems(
      items,
      entityName
    );
    if (validItems.length === 0) {
      return { saved: 0, skipped: 0 };
    }

    return this.replaceCatalogItems({
      supplier,
      items: validItems,
      skipped,
      storeName,
      entityName,
    });
  }

  async replaceCatalogItems({
    supplier,
    items,
    skipped = 0,
    storeName,
    entityName,
  }) {
    validateCatalogItemsForSupplier(items, supplier, entityName);
    const { database, generation } = await this._getReadyContext();
    if (!database) {
      throw new Error(`IndexedDB недоступен для записи: ${entityName}`);
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      let abortCause = null;

      const abortTransaction = (error) => {
        abortCause = error;
        try {
          transaction.abort();
        } catch {
          /* ignore */
        }
      };

      transaction.oncomplete = () =>
        this._resolveIfActive(resolve, reject, generation, {
          saved: items.length,
          skipped,
        });
      transaction.onabort = () =>
        reject(
          abortCause ||
            transaction.error ||
            new Error(`Транзакция IndexedDB для ${entityName} отменена`)
        );

      replaceSupplierItemsInStore(
        store,
        supplier,
        items,
        () => {},
        abortTransaction
      );
    });
  }

  async searchTires(filters) {
    const { database, generation } = await this._getReadyContext();
    if (!database) return [];

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [CATALOG_STORES.tires],
        'readonly'
      );
      const store = transaction.objectStore(CATALOG_STORES.tires);

      let request;
      const filterCount = Object.keys(filters).filter((key) =>
        isActiveFilterValue(filters[key])
      ).length;
      const singleBrand = getSingleBrandForIndex(filters.brand);

      if (filterCount === 0) {
        request = store.openCursor();
      } else if (isActiveFilterValue(filters.diameter)) {
        request = store
          .index('diameter')
          .openCursor(IDBKeyRange.only(filters.diameter));
      } else if (isActiveFilterValue(filters.season)) {
        request = store
          .index('season')
          .openCursor(IDBKeyRange.only(filters.season));
      } else if (singleBrand) {
        request = store.index('brand').openCursor(IDBKeyRange.only(singleBrand));
      } else if (isActiveFilterValue(filters.supplier)) {
        request = store
          .index('supplier')
          .openCursor(IDBKeyRange.only(filters.supplier));
      } else {
        request = store.openCursor();
      }

      const results = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const tire = cursor.value;
          const tireAmountNumber = Number(tire.amount);
          const minAmountNumber =
            filters.minAmount === undefined || filters.minAmount === null
              ? null
              : Number(filters.minAmount);

          const matches =
            matchesTireParameterFilters(tire, filters) &&
            matchesBrandFilter(tire.brand, filters.brand) &&
            (!filters.supplier || tire.supplier === filters.supplier) &&
            (filters.spikes === undefined || tire.spikes === filters.spikes) &&
            (filters.runflat !== true || tire.runflat === true) &&
            (minAmountNumber === null ||
              (!Number.isNaN(tireAmountNumber) &&
                tireAmountNumber >= minAmountNumber));

          if (matches) {
            results.push(tire);
          }

          cursor.continue();
        } else {
          this._resolveIfActive(resolve, reject, generation, results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAvailableParameterOptions(filters = {}) {
    const { database, generation } = await this._getReadyContext();
    if (!database) {
      return {
        widths: [],
        profiles: [],
        diameters: [],
        seasons: [],
        brands: [],
        suppliers: [],
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [CATALOG_STORES.tires],
        'readonly'
      );
      const store = transaction.objectStore(CATALOG_STORES.tires);
      const request = store.getAll();

      request.onsuccess = () => {
        const widths = new Set();
        const profiles = new Set();
        const diameters = new Set();
        const seasons = new Set();
        const brands = new Set();
        const suppliers = new Set();

        request.result.forEach((item) => {
          if (filters.season && item.season !== filters.season) return;

          const matchWidth = matchesTireNumericField(item.width, filters.width);
          const matchProfile = matchesTireNumericField(
            item.profile,
            filters.profile
          );
          const matchDiameter = matchesTireDiameter(
            item.diameter,
            filters.diameter
          );

          if (matchProfile && matchDiameter) {
            addUniqueValue(widths, normalizeNumericFieldValue(item.width));
          }
          if (matchWidth && matchDiameter) {
            addUniqueValue(profiles, normalizeNumericFieldValue(item.profile));
          }
          if (matchWidth && matchProfile) {
            addUniqueValue(diameters, item.diameter);
          }

          if (matchWidth && matchProfile && matchDiameter) {
            addUniqueValue(seasons, item.season);
            addUniqueValue(brands, item.brand);
            addUniqueValue(suppliers, item.supplier);
          }
        });

        this._resolveIfActive(resolve, reject, generation, {
          widths: sortNumericValues(widths),
          profiles: sortNumericValues(profiles),
          diameters: sortDiameterValues(diameters),
          seasons: Array.from(seasons).sort(),
          brands: Array.from(brands).sort(),
          suppliers: Array.from(suppliers).sort(),
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  async searchDiscs(filters) {
    const { database, generation } = await this._getReadyContext();
    if (!database) return [];

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [CATALOG_STORES.discs],
        'readonly'
      );
      const store = transaction.objectStore(CATALOG_STORES.discs);

      let request;
      const filterCount = Object.keys(filters).filter((key) =>
        isActiveFilterValue(filters[key])
      ).length;
      const singleBrand = getSingleBrandForIndex(filters.brand);

      if (filterCount === 0) {
        request = store.openCursor();
      } else if (isActiveFilterValue(filters.diameter)) {
        request = store
          .index('diameter')
          .openCursor(IDBKeyRange.only(filters.diameter));
      } else if (isActiveFilterValue(filters.diskType)) {
        request = store
          .index('diskType')
          .openCursor(IDBKeyRange.only(filters.diskType));
      } else if (singleBrand) {
        request = store.index('brand').openCursor(IDBKeyRange.only(singleBrand));
      } else if (isActiveFilterValue(filters.supplier)) {
        request = store
          .index('supplier')
          .openCursor(IDBKeyRange.only(filters.supplier));
      } else {
        request = store.openCursor();
      }

      const results = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const disc = cursor.value;
          const discAmountNumber = Number(disc.amount);
          const minAmountNumber =
            filters.minAmount === undefined || filters.minAmount === null
              ? null
              : Number(filters.minAmount);

          const matches =
            matchesDiscParameterFilters(disc, filters) &&
            (minAmountNumber === null ||
              (!Number.isNaN(discAmountNumber) &&
                discAmountNumber >= minAmountNumber));

          if (matches) {
            results.push(disc);
          }

          cursor.continue();
        } else {
          this._resolveIfActive(resolve, reject, generation, results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async collectTireShowcaseCandidates(options = {}) {
    const { database, generation } = await this._getReadyContext();
    if (!database) return { isEmpty: true, candidates: [] };
    const transaction = database.transaction(
      [CATALOG_STORES.tires],
      'readonly'
    );
    const result = await collectShowcaseCandidatesFromStore(
      transaction.objectStore(CATALOG_STORES.tires),
      options
    );
    this._assertActiveGeneration(generation);
    return result;
  }

  async collectDiscShowcaseCandidates(options = {}) {
    const { database, generation } = await this._getReadyContext();
    if (!database) return { isEmpty: true, candidates: [] };
    const transaction = database.transaction(
      [CATALOG_STORES.discs],
      'readonly'
    );
    const result = await collectShowcaseCandidatesFromStore(
      transaction.objectStore(CATALOG_STORES.discs),
      options
    );
    this._assertActiveGeneration(generation);
    return result;
  }

  async getAvailableDiscParameterOptions(filters = {}) {
    const { database, generation } = await this._getReadyContext();
    if (!database) {
      return {
        brands: [],
        suppliers: [],
        diameters: [],
        widths: [],
        cb: [],
        et: [],
        pcd: [],
        pn: [],
        diskTypes: [],
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [CATALOG_STORES.discs],
        'readonly'
      );
      const store = transaction.objectStore(CATALOG_STORES.discs);
      const request = store.getAll();

      request.onsuccess = () => {
        const brands = new Set();
        const suppliers = new Set();
        const diameters = new Set();
        const widths = new Set();
        const cbValues = new Set();
        const etValues = new Set();
        const pcdValues = new Set();
        const pnValues = new Set();
        const diskTypes = new Set();

        request.result.forEach((item) => {
          const matchSupplier = matchesDiscStringField(
            item.supplier,
            filters.supplier
          );
          const matchDiameter = matchesTireDiameter(
            item.diameter,
            filters.diameter
          );
          const matchPcd = matchesTireNumericField(item.pcd, filters.pcd);
          const matchPn = matchesTireNumericField(item.pn, filters.pn);
          const matchDiskType = matchesDiscStringField(
            item.diskType,
            filters.diskType
          );
          const matchWidth = matchesDiscRange(
            item.width,
            filters.widthFrom,
            filters.widthTo
          );
          const matchCb = matchesDiscRange(
            item.cb,
            filters.cbFrom,
            filters.cbTo
          );
          const matchEt = matchesDiscRange(
            item.et,
            filters.etFrom,
            filters.etTo
          );

          if (
            matchSupplier &&
            matchPcd &&
            matchPn &&
            matchDiskType &&
            matchWidth &&
            matchCb &&
            matchEt
          ) {
            addUniqueValue(diameters, item.diameter);
          }
          if (
            matchSupplier &&
            matchDiameter &&
            matchPcd &&
            matchDiskType &&
            matchWidth &&
            matchCb &&
            matchEt
          ) {
            addUniqueValue(pnValues, normalizeNumericFieldValue(item.pn));
          }
          if (
            matchSupplier &&
            matchDiameter &&
            matchPn &&
            matchDiskType &&
            matchWidth &&
            matchCb &&
            matchEt
          ) {
            addUniqueValue(pcdValues, normalizeNumericFieldValue(item.pcd));
          }
          if (
            matchSupplier &&
            matchDiameter &&
            matchPcd &&
            matchPn &&
            matchDiskType &&
            matchCb &&
            matchEt
          ) {
            addUniqueValue(widths, normalizeNumericFieldValue(item.width));
          }
          if (
            matchSupplier &&
            matchDiameter &&
            matchPcd &&
            matchPn &&
            matchDiskType &&
            matchWidth &&
            matchEt
          ) {
            addUniqueValue(cbValues, normalizeNumericFieldValue(item.cb));
          }
          if (
            matchSupplier &&
            matchDiameter &&
            matchPcd &&
            matchPn &&
            matchDiskType &&
            matchWidth &&
            matchCb
          ) {
            addUniqueValue(etValues, normalizeNumericFieldValue(item.et));
          }

          if (
            matchSupplier &&
            matchDiameter &&
            matchPcd &&
            matchPn &&
            matchDiskType &&
            matchWidth &&
            matchCb &&
            matchEt
          ) {
            addUniqueValue(brands, item.brand);
            addUniqueValue(suppliers, item.supplier);
            addUniqueValue(diskTypes, item.diskType);
          }
        });

        this._resolveIfActive(resolve, reject, generation, {
          brands: Array.from(brands).sort(),
          suppliers: Array.from(suppliers).sort(),
          diameters: sortDiscDiameterValues(diameters),
          widths: sortDiscNumericValues(widths),
          cb: sortDiscNumericValues(cbValues),
          et: sortDiscNumericValues(etValues),
          pcd: sortDiscNumericValues(pcdValues),
          pn: sortDiscNumericValues(pnValues),
          diskTypes: Array.from(diskTypes).sort(),
        });
      };

      request.onerror = () => reject(request.error);
    });
  }
}

const indexedDBService = new IndexedDBService();
export default indexedDBService;