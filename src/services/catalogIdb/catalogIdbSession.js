import {
  DEFAULT_CATALOG_STORE_ID,
  resolveCatalogStoreId,
} from '../catalogSync/catalogStoreNamespace';
import {
  collectDiscFacetOptions,
  collectTireFacetOptions,
  createEmptyDiscFacetOptions,
  createEmptyTireFacetOptions,
} from './catalogFacetOptions';
import {
  collectShowcaseCandidatesFromItems,
  DISC_SEARCH_INDEX_HINTS,
  replaceSupplierItemsInStore,
  TIRE_SEARCH_INDEX_HINTS,
} from './catalogIdbQueries';
import { createCategoryMemory, filterIndexedItems } from './catalogIdbMemory';
import {
  IDB_OPEN_TIMEOUT_MS,
  IDB_READ_TIMEOUT_MS,
  createCatalogTimeoutError,
} from './catalogIdbTimeout';
import {
  prepareCatalogItems,
  validateCatalogItemsForSupplier,
} from './catalogItemValidation';
import {
  ALL_CATALOG_STORES,
  CATALOG_DB_NAME,
  CATALOG_DB_VERSION,
  CATALOG_METADATA_KEYS,
  CATALOG_SCHEMA_VERSION,
  CATALOG_STORES,
  DISC_INDEXES,
  getCatalogDatabaseName,
  LEGACY_DB_NAMES,
  LEGACY_MIGRATION_MARKER,
  TIRE_INDEXES,
} from './catalogSchema';
import {
  matchesDiscSearchFilters,
  matchesTireSearchFilters,
} from './catalogSearchFilters';
import { appLog } from '../../utils/appLog';

const LEGACY_CATALOG_VERSION_KEY = 'ivanor.catalog.cloudVersion';

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
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn(value);
    };

    const timeoutId = setTimeout(() => {
      appLog.error({
        code: 'idb.timeout',
        domain: 'idb',
        message: 'Legacy IndexedDB open timed out',
        context: { op: 'legacy-open' },
      });
      finish(reject, createCatalogTimeoutError());
    }, IDB_OPEN_TIMEOUT_MS);

    let request;
    try {
      request = indexedDB.open(dbName);
    } catch {
      finish(resolve, []);
      return;
    }
    request.onerror = () => finish(resolve, []);
    request.onblocked = () => {
      appLog.warn({
        code: 'idb.blocked',
        domain: 'idb',
        message: 'Legacy IndexedDB open blocked',
        context: { op: 'legacy-open' },
      });
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        finish(resolve, []);
        return;
      }
      const tx = db.transaction([storeName], 'readonly');
      const getAllRequest = tx.objectStore(storeName).getAll();
      getAllRequest.onsuccess = () => {
        db.close();
        finish(resolve, getAllRequest.result || []);
      };
      getAllRequest.onerror = () => {
        db.close();
        finish(reject, getAllRequest.error);
      };
    };
  });

const deleteLegacyDatabase = (dbName) =>
  new Promise((resolve) => {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.deleteDatabase !== 'function') {
      resolve();
      return;
    }
    try {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });

class CatalogIdbSession {
  constructor() {
    this.activeStoreId = resolveCatalogStoreId();
    this._generation = 0;
    this.catalogDb = null;
    this._migrationComplete = false;
    this._ensurePromise = null;
    this._dataRevision = 0;
    this._readCache = null;
    this._readCacheHydrate = Object.create(null);
    this._readStoreGetAllCount = 0;
    /** @deprecated тестовый shim */
    this.db = null;
    /** @deprecated тестовый shim */
    this.discDb = null;
  }

  _invalidateReadCache() {
    this._dataRevision += 1;
    this._readCache = null;
    this._readCacheHydrate = Object.create(null);
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
    this._invalidateReadCache();
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
    this._invalidateReadCache();
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

  _readStoreAll(database, storeName, generation) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn(value);
      };
      const settleResolve = (value) => settle(resolve, value);
      const settleReject = (error) => settle(reject, error);

      const timeoutId = setTimeout(() => {
        appLog.error({
          code: 'idb.timeout',
          domain: 'idb',
          message: 'IndexedDB getAll timed out',
          context: { op: 'getAll', storeName },
        });
        settleReject(createCatalogTimeoutError());
      }, IDB_READ_TIMEOUT_MS);

      let request;
      let transaction;
      try {
        transaction = database.transaction([storeName], 'readonly');
        request = transaction.objectStore(storeName).getAll();
      } catch (error) {
        settleReject(error);
        return;
      }

      this._readStoreGetAllCount += 1;
      request.onsuccess = () => {
        this._resolveIfActive(
          settleResolve,
          settleReject,
          generation,
          request.result || []
        );
      };
      request.onerror = () => settleReject(request.error);
      transaction.onabort = () => {
        const abortError = transaction.error;
        if (abortError) {
          settleReject(abortError);
          return;
        }
        const error = new Error('IndexedDB transaction aborted');
        error.name = 'AbortError';
        settleReject(error);
      };
      transaction.oncomplete = () => {
        if (settled) return;
        this._resolveIfActive(
          settleResolve,
          settleReject,
          generation,
          request.result || []
        );
      };
    });
  }

  async _ensureReadCache(storeName) {
    const { database, generation } = await this._getReadyContext();
    if (!database) return null;

    const cache = this._readCache;
    if (
      cache &&
      cache.generation === generation &&
      cache.revision === this._dataRevision &&
      cache.storeId === this.activeStoreId &&
      cache[storeName]
    ) {
      return cache[storeName];
    }

    const inflightKey = `${storeName}:${generation}:${this._dataRevision}`;
    if (this._readCacheHydrate[inflightKey]) {
      return this._readCacheHydrate[inflightKey];
    }

    const hydrate = this._hydrateReadCache(database, generation, storeName);
    this._readCacheHydrate[inflightKey] = hydrate;
    try {
      return await hydrate;
    } finally {
      if (this._readCacheHydrate[inflightKey] === hydrate) {
        delete this._readCacheHydrate[inflightKey];
      }
    }
  }

  async _hydrateReadCache(database, generation, storeName, attempt = 0) {
    const revision = this._dataRevision;
    const storeId = this.activeStoreId;
    const readStarted = performance.now();
    const items = await this._readStoreAll(database, storeName, generation);
    const readMs = Math.round(performance.now() - readStarted);
    this._assertActiveGeneration(generation);

    if (revision !== this._dataRevision || storeId !== this.activeStoreId) {
      if (attempt >= 2) {
        throw this._createStaleStoreError();
      }
      const { database: nextDatabase, generation: nextGeneration } =
        await this._getReadyContext();
      if (!nextDatabase) return null;
      return this._hydrateReadCache(
        nextDatabase,
        nextGeneration,
        storeName,
        attempt + 1
      );
    }

    const kind = storeName === CATALOG_STORES.discs ? 'discs' : 'tires';
    const cpuStarted = performance.now();
    const categoryMemory = createCategoryMemory(items, kind);
    const cpuMs = Math.round(performance.now() - cpuStarted);
    const durationMs = readMs + cpuMs;
    if (durationMs >= 20) {
      appLog.warn({
        code: 'idb.hydrate',
        domain: 'idb',
        message: 'Catalog RAM cache hydrated',
        context: {
          storeName,
          itemCount: items.length,
          readMs,
          cpuMs,
          durationMs,
        },
      });
    }
    if (
      !this._readCache ||
      this._readCache.generation !== generation ||
      this._readCache.revision !== revision ||
      this._readCache.storeId !== storeId
    ) {
      this._readCache = {
        generation,
        revision,
        storeId,
        tires: null,
        discs: null,
      };
    }
    this._readCache[storeName] = categoryMemory;
    return categoryMemory;
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

    // Безымянные CatalogDatabase / TireDatabase / DiscDatabase исторически
    // принадлежат только ElistaIvanor — не переносим их в другой storeId.
    const shouldMigrateLegacy =
      this.activeStoreId === DEFAULT_CATALOG_STORE_ID;
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
    const legacyVersion = shouldMigrateLegacy
      ? unifiedMetadata.find(
          (record) => record?.key === CATALOG_METADATA_KEYS.snapshotVersion
        )?.value || this._readLegacyLocalStorageVersion()
      : '';

    this._assertActiveGeneration(generation);
    await this._runLegacyMigrationTransaction(
      unifiedTires.length ? unifiedTires : legacyTires,
      unifiedDiscs.length ? unifiedDiscs : legacyDiscs,
      generation,
      database,
      legacyVersion
    );
    this._assertActiveGeneration(generation);
    this._invalidateReadCache();
    if (shouldMigrateLegacy) {
      await this._cleanupLegacyCatalogSources();
      this._assertActiveGeneration(generation);
    }
    this._migrationComplete = true;
    return database;
  }

  async openCatalogDatabase(expectedGeneration = this._generation) {
    this._assertActiveGeneration(expectedGeneration);
    if (this.catalogDb) {
      return this.catalogDb;
    }

    return new Promise((resolve, reject) => {
      const resolveUnavailable = () => {
        appLog.error({
          code: 'idb.unavailable',
          domain: 'idb',
          message: 'IndexedDB open returned null',
          context: { op: 'open', storeId: this.activeStoreId },
        });
        finish(resolve, null);
      };

      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn(value);
      };

      const timeoutId = setTimeout(() => {
        appLog.error({
          code: 'idb.timeout',
          domain: 'idb',
          message: 'IndexedDB open timed out',
          context: { op: 'open' },
        });
        finish(reject, createCatalogTimeoutError());
      }, IDB_OPEN_TIMEOUT_MS);

      if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
        resolveUnavailable();
        return;
      }

      let request;
      try {
        request = indexedDB.open(
          getCatalogDatabaseName(this.activeStoreId),
          CATALOG_DB_VERSION
        );
      } catch (error) {
        appLog.error({
          code: 'idb.unavailable',
          domain: 'idb',
          message: 'IndexedDB open failed',
          error,
          context: { op: 'open', storeId: this.activeStoreId },
        });
        finish(resolve, null);
        return;
      }

      request.onerror = () => resolveUnavailable();
      request.onblocked = () => {
        appLog.warn({
          code: 'idb.blocked',
          domain: 'idb',
          message: 'IndexedDB open blocked by another connection',
          context: { op: 'open' },
        });
      };

      request.onsuccess = () => {
        if (settled) {
          request.result?.close?.();
          return;
        }
        if (expectedGeneration !== this._generation) {
          request.result?.close?.();
          finish(reject, this._createStaleStoreError());
          return;
        }
        this.catalogDb = request.result;
        this.db = this.catalogDb;
        this.discDb = this.catalogDb;
        finish(resolve, this.catalogDb);
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
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn(value);
      };
      const timeoutId = setTimeout(() => {
        appLog.error({
          code: 'idb.timeout',
          domain: 'idb',
          message: 'IndexedDB migration marker read timed out',
          context: { op: 'migration-marker' },
        });
        finish(reject, createCatalogTimeoutError());
      }, IDB_READ_TIMEOUT_MS);

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
          finish(resolve, request.result?.value === LEGACY_MIGRATION_MARKER);
        } catch (error) {
          finish(reject, error);
        }
      };
      request.onerror = () => finish(reject, request.error);
      transaction.onabort = () => {
        const error = transaction.error || new Error('IndexedDB transaction aborted');
        if (!transaction.error) error.name = 'AbortError';
        finish(reject, error);
      };
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
    const legacyVersion = migratedVersion || '';

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
      return window.localStorage.getItem(LEGACY_CATALOG_VERSION_KEY) || '';
    } catch {
      return '';
    }
  }

  _removeLegacyLocalStorageVersion() {
    try {
      window.localStorage.removeItem(LEGACY_CATALOG_VERSION_KEY);
    } catch {
      /* ignore */
    }
  }

  async _cleanupLegacyCatalogSources() {
    await Promise.all([
      deleteLegacyDatabase(LEGACY_DB_NAMES.tires),
      deleteLegacyDatabase(LEGACY_DB_NAMES.discs),
      deleteLegacyDatabase(CATALOG_DB_NAME),
    ]);
    this._removeLegacyLocalStorageVersion();
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
      this._countStore(database, CATALOG_STORES.tires),
      this._countStore(database, CATALOG_STORES.discs),
    ]);
    return tires === 0 && discs === 0;
  }

  _countStore(database, storeName) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn(value);
      };
      const timeoutId = setTimeout(() => {
        appLog.error({
          code: 'idb.timeout',
          domain: 'idb',
          message: 'IndexedDB count timed out',
          context: { op: 'count', storeName },
        });
        finish(reject, createCatalogTimeoutError());
      }, IDB_READ_TIMEOUT_MS);

      let request;
      let transaction;
      try {
        transaction = database.transaction([storeName], 'readonly');
        request = transaction.objectStore(storeName).count();
      } catch (error) {
        finish(reject, error);
        return;
      }
      request.onsuccess = () => finish(resolve, request.result || 0);
      request.onerror = () => finish(reject, request.error);
      transaction.onabort = () => {
        const error = transaction.error || new Error('IndexedDB transaction aborted');
        if (!transaction.error) error.name = 'AbortError';
        finish(reject, error);
      };
    });
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
        this._invalidateReadCache();
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

      transaction.oncomplete = () => {
        this._invalidateReadCache();
        this._resolveIfActive(resolve, reject, generation, {
          saved: items.length,
          skipped,
        });
      };
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

  async searchTires(filters = {}) {
    const started = performance.now();
    const memory = await this._ensureReadCache(CATALOG_STORES.tires);
    if (!memory) return [];
    const results = filterIndexedItems(
      memory.items,
      memory.indexMaps,
      filters,
      TIRE_SEARCH_INDEX_HINTS,
      matchesTireSearchFilters
    );
    const durationMs = Math.round(performance.now() - started);
    if (durationMs >= 50) {
      appLog.warn({
        code: 'search.timing',
        domain: 'search',
        message: 'Tire search finished',
        context: { durationMs, resultCount: results.length },
      });
    }
    return results;
  }

  async getAvailableParameterOptions(filters = {}) {
    const memory = await this._ensureReadCache(CATALOG_STORES.tires);
    if (!memory) {
      return createEmptyTireFacetOptions();
    }
    return collectTireFacetOptions(memory.facetRows, filters);
  }

  async searchDiscs(filters = {}) {
    const started = performance.now();
    const memory = await this._ensureReadCache(CATALOG_STORES.discs);
    if (!memory) return [];
    const results = filterIndexedItems(
      memory.items,
      memory.indexMaps,
      filters,
      DISC_SEARCH_INDEX_HINTS,
      matchesDiscSearchFilters
    );
    const durationMs = Math.round(performance.now() - started);
    if (durationMs >= 50) {
      appLog.warn({
        code: 'search.timing',
        domain: 'search',
        message: 'Disc search finished',
        context: { durationMs, resultCount: results.length },
      });
    }
    return results;
  }

  async collectTireShowcaseCandidates(options = {}) {
    const started = performance.now();
    const memory = await this._ensureReadCache(CATALOG_STORES.tires);
    if (!memory) return { isEmpty: true, candidates: [] };
    const payload = collectShowcaseCandidatesFromItems(memory.items, options);
    const durationMs = Math.round(performance.now() - started);
    if (durationMs >= 50) {
      appLog.warn({
        code: 'showcase.timing',
        domain: 'showcase',
        message: 'Tire showcase candidates from RAM',
        context: { durationMs, candidateCount: payload.candidates.length },
      });
    }
    return payload;
  }

  async collectDiscShowcaseCandidates(options = {}) {
    const started = performance.now();
    const memory = await this._ensureReadCache(CATALOG_STORES.discs);
    if (!memory) return { isEmpty: true, candidates: [] };
    const payload = collectShowcaseCandidatesFromItems(memory.items, options);
    const durationMs = Math.round(performance.now() - started);
    if (durationMs >= 50) {
      appLog.warn({
        code: 'showcase.timing',
        domain: 'showcase',
        message: 'Disc showcase candidates from RAM',
        context: { durationMs, candidateCount: payload.candidates.length },
      });
    }
    return payload;
  }

  async getAvailableDiscParameterOptions(filters = {}) {
    const memory = await this._ensureReadCache(CATALOG_STORES.discs);
    if (!memory) {
      return createEmptyDiscFacetOptions();
    }
    return collectDiscFacetOptions(memory.facetRows, filters);
  }
}

const catalogIdbSession = new CatalogIdbSession();
export default catalogIdbSession;
