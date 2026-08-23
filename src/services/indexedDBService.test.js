import indexedDBService, {
  CATALOG_METADATA_KEYS,
  CATALOG_STORES,
  LEGACY_MIGRATION_MARKER,
  validateCatalogItemsForSupplier,
} from './indexedDBService';

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)])
    );
  }
  return value;
};

const makeError = (name, message = name) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const metadataRecord = (key, value) => ({ key, value });

function createFakeCatalogDatabase(initialState = {}, failure = null) {
  let committedState = {
    tires: clone(initialState.tires || []),
    discs: clone(initialState.discs || []),
    metadata: clone(initialState.metadata || {}),
  };
  let transactionCount = 0;
  let completedCount = 0;

  const database = {
    get transactionCount() {
      return transactionCount;
    },
    get completedCount() {
      return completedCount;
    },
    getTires() {
      return clone(committedState.tires);
    },
    getDiscs() {
      return clone(committedState.discs);
    },
    getMetadata(key) {
      return committedState.metadata[key];
    },
    transaction(storeNames, mode = 'readwrite') {
      transactionCount += 1;
      const hasMetadataWrite = storeNames.includes(CATALOG_STORES.metadata);
      const stagedTires = new Map(
        committedState.tires.map((item) => [item.id, clone(item)])
      );
      const stagedDiscs = new Map(
        committedState.discs.map((item) => [item.id, clone(item)])
      );
      const stagedMetadata = { ...committedState.metadata };
      let done = false;
      let pendingError = null;
      let putIndex = 0;
      let writeIndex = 0;
      let writesStarted = false;

      const abort = (error) => {
        if (done) return;
        done = true;
        transaction.error = error || transaction.error;
        setTimeout(() => transaction.onabort?.());
      };

      const tryComplete = () => {
        if (done || pendingError) {
          return;
        }
        done = true;
        committedState = {
          tires: Array.from(stagedTires.values()),
          discs: Array.from(stagedDiscs.values()),
          metadata: { ...stagedMetadata },
        };
        completedCount += 1;
        setTimeout(() => transaction.oncomplete?.());
      };

      const transaction = {
        error: null,
        onabort: null,
        oncomplete: null,
        abort: () => abort(transaction.error || makeError('AbortError')),
        objectStore: (storeName) => {
          if (storeName === CATALOG_STORES.metadata) {
            return {
              get: (key) => {
                const request = { result: undefined, onsuccess: null, onerror: null };
                if (failure?.type === 'metadata-get') {
                  queueMicrotask(() => abort(failure.error));
                  return request;
                }
                request.result = stagedMetadata[key]
                  ? metadataRecord(key, stagedMetadata[key])
                  : undefined;
                queueMicrotask(() => {
                  request.onsuccess?.();
                  queueMicrotask(() => {
                    if (!done && hasMetadataWrite && !writesStarted) {
                      tryComplete();
                    }
                  });
                });
                return request;
              },
              put: (record) => {
                if (failure?.type === 'metadata-put') {
                  pendingError = failure.error;
                  abort(failure.error);
                  return {};
                }
                stagedMetadata[record.key] = record.value;
                queueMicrotask(tryComplete);
                return {};
              },
            };
          }

          const stagedMap =
            storeName === CATALOG_STORES.discs ? stagedDiscs : stagedTires;

          return {
            index: () => ({
              openCursor: (supplier) => {
                writesStarted = true;
                const request = { result: null, onsuccess: null, onerror: null };
                let cursorIndex = 0;
                const currentWriteIndex = writeIndex;
                writeIndex += 1;

                const deliverCursor = () => {
                  if (done) return;
                  const matchingIds = Array.from(stagedMap.values())
                    .filter((item) => item.supplier === supplier)
                    .map((item) => item.id);
                  const id = matchingIds[cursorIndex];
                  if (id === undefined) {
                    request.result = null;
                    cursorIndex = 0;
                    queueMicrotask(() => {
                      request.onsuccess?.();
                      if (!hasMetadataWrite) {
                        tryComplete();
                      }
                    });
                    return;
                  }

                  request.result = {
                    delete: () => {
                      if (
                        failure?.type === 'delete' &&
                        failure.writeIndex === currentWriteIndex
                      ) {
                        throw failure.error;
                      }
                      stagedMap.delete(id);
                      return {};
                    },
                    continue: () => {
                      cursorIndex += 1;
                      deliverCursor();
                    },
                  };
                  queueMicrotask(() => request.onsuccess?.());
                };

                deliverCursor();
                return request;
              },
            }),
            put: (item) => {
              const currentPutIndex = putIndex;
              putIndex += 1;
              if (failure?.type === 'put' && failure.putIndex === currentPutIndex) {
                pendingError = failure.error;
                abort(failure.error);
                return {};
              }
              stagedMap.set(item.id, clone(item));
              return {};
            },
          };
        },
      };

      return transaction;
    },
  };

  return database;
}

const mountCatalogDb = (database) => {
  indexedDBService.catalogDb = database;
  indexedDBService.db = database;
  indexedDBService.discDb = database;
  indexedDBService._migrationComplete = true;
};

const supplierA = 'Поставщик A';
const supplierB = 'Поставщик B';

const tire = (id, supplier = supplierA) => ({ id, supplier });
const disc = (id, supplier = supplierA) => ({ id, supplier });

describe('CatalogDatabase: replace по supplier', () => {
  beforeAll(() => {
    global.IDBKeyRange = { only: (value) => value };
  });

  beforeEach(() => {
    indexedDBService.catalogDb = null;
    indexedDBService._migrationComplete = false;
    indexedDBService._ensurePromise = null;
  });

  test('полный успех заменяет данные поставщика', async () => {
    const database = createFakeCatalogDatabase({
      tires: [tire('old-a'), tire('old-b', supplierB)],
    });
    mountCatalogDb(database);

    await expect(
      indexedDBService.replaceTiresForSupplier(supplierA, [tire('new-1'), tire('new-2')])
    ).resolves.toEqual({ saved: 2, skipped: 0 });

    expect(database.getTires()).toEqual(
      expect.arrayContaining([tire('new-1'), tire('new-2'), tire('old-b', supplierB)])
    );
  });

  test('ошибка первого put отменяет транзакцию', async () => {
    const error = makeError('UnknownError', 'put failed');
    const database = createFakeCatalogDatabase(
      { tires: [tire('old-a'), tire('old-b', supplierB)] },
      { type: 'put', putIndex: 0, error }
    );
    mountCatalogDb(database);

    await expect(
      indexedDBService.replaceTiresForSupplier(supplierA, [tire('new-1')])
    ).rejects.toBe(error);
    expect(database.getTires()).toEqual([tire('old-a'), tire('old-b', supplierB)]);
  });
});

describe('CatalogDatabase: applyCatalogSnapshot', () => {
  const versionV1 = '2026-08-23T09:00:00Z';
  const versionV2 = '2026-08-23T10:00:00Z';

  beforeAll(() => {
    global.IDBKeyRange = { only: (value) => value };
  });

  beforeEach(() => {
    indexedDBService.catalogDb = null;
    indexedDBService._migrationComplete = false;
    indexedDBService._ensurePromise = null;
  });

  const baseCommands = () => [
    {
      supplier: supplierA,
      category: CATALOG_STORES.tires,
      action: 'replace',
      items: [tire('tire-a-new')],
    },
    {
      supplier: supplierA,
      category: CATALOG_STORES.discs,
      action: 'replace',
      items: [disc('disc-a-new')],
    },
  ];

  test('полный успешный snapshot обновляет шины, диски и metadata', async () => {
    const database = createFakeCatalogDatabase({
      tires: [tire('tire-a-old')],
      discs: [disc('disc-a-old')],
      metadata: {
        [CATALOG_METADATA_KEYS.snapshotVersion]: versionV1,
      },
    });
    mountCatalogDb(database);

    await expect(
      indexedDBService.applyCatalogSnapshot(baseCommands(), versionV2)
    ).resolves.toEqual({ applied: true, writes: 2, skipped: false });

    expect(database.getTires()).toEqual([tire('tire-a-new')]);
    expect(database.getDiscs()).toEqual([disc('disc-a-new')]);
    expect(database.getMetadata(CATALOG_METADATA_KEYS.snapshotVersion)).toBe(
      versionV2
    );
  });

  test('ошибка шин откатывает диски', async () => {
    const error = makeError('UnknownError', 'tire put failed');
    const database = createFakeCatalogDatabase(
      {
        tires: [tire('tire-a-old')],
        discs: [disc('disc-a-old')],
        metadata: { [CATALOG_METADATA_KEYS.snapshotVersion]: versionV1 },
      },
      { type: 'put', putIndex: 0, error }
    );
    mountCatalogDb(database);

    await expect(
      indexedDBService.applyCatalogSnapshot(baseCommands(), versionV2)
    ).rejects.toBe(error);

    expect(database.getTires()).toEqual([tire('tire-a-old')]);
    expect(database.getDiscs()).toEqual([disc('disc-a-old')]);
    expect(database.getMetadata(CATALOG_METADATA_KEYS.snapshotVersion)).toBe(
      versionV1
    );
  });

  test('purge и keepPrevious сохраняют семантику', async () => {
    const database = createFakeCatalogDatabase({
      tires: [tire('keep-me'), tire('remove-me', supplierB)],
      discs: [disc('disc-keep')],
      metadata: { [CATALOG_METADATA_KEYS.snapshotVersion]: versionV1 },
    });
    mountCatalogDb(database);

    await indexedDBService.applyCatalogSnapshot(
      [
        {
          supplier: supplierB,
          category: CATALOG_STORES.tires,
          action: 'purge',
        },
        {
          supplier: supplierA,
          category: CATALOG_STORES.tires,
          action: 'keepPrevious',
        },
        {
          supplier: supplierA,
          category: CATALOG_STORES.discs,
          action: 'keepPrevious',
        },
      ],
      versionV2
    );

    expect(database.getTires()).toEqual([tire('keep-me')]);
    expect(database.getDiscs()).toEqual([disc('disc-keep')]);
  });

  test('metadata version не меняется при abort', async () => {
    const error = makeError('QuotaExceededError');
    const database = createFakeCatalogDatabase(
      {
        tires: [tire('tire-a-old')],
        discs: [disc('disc-a-old')],
        metadata: { [CATALOG_METADATA_KEYS.snapshotVersion]: versionV1 },
      },
      { type: 'metadata-put', error }
    );
    mountCatalogDb(database);

    await expect(
      indexedDBService.applyCatalogSnapshot(baseCommands(), versionV2)
    ).rejects.toBe(error);
    expect(database.getMetadata(CATALOG_METADATA_KEYS.snapshotVersion)).toBe(
      versionV1
    );
  });

  test('повторное применение snapshot идемпотентно', async () => {
    const database = createFakeCatalogDatabase({
      tires: [tire('tire-a-old')],
      discs: [disc('disc-a-old')],
      metadata: { [CATALOG_METADATA_KEYS.snapshotVersion]: versionV2 },
    });
    mountCatalogDb(database);

    await expect(
      indexedDBService.applyCatalogSnapshot(baseCommands(), versionV2)
    ).resolves.toEqual({ applied: false, writes: 0, skipped: true });
    expect(database.getTires()).toEqual([tire('tire-a-old')]);
  });

  test('старый snapshot не перезаписывает более новую persisted version', async () => {
    const database = createFakeCatalogDatabase({
      tires: [tire('tire-v2')],
      discs: [disc('disc-v2')],
      metadata: { [CATALOG_METADATA_KEYS.snapshotVersion]: versionV2 },
    });
    mountCatalogDb(database);

    await expect(
      indexedDBService.applyCatalogSnapshot(baseCommands(), versionV1)
    ).resolves.toEqual({ applied: false, writes: 0, skipped: true });
    expect(database.getMetadata(CATALOG_METADATA_KEYS.snapshotVersion)).toBe(
      versionV2
    );
  });
});

describe('CatalogDatabase: migration marker', () => {
  test('marker записывается в metadata', async () => {
    const database = createFakeCatalogDatabase();
    mountCatalogDb(database);

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [CATALOG_STORES.metadata],
        'readwrite'
      );
      transaction.objectStore(CATALOG_STORES.metadata).put({
        key: CATALOG_METADATA_KEYS.migrationMarker,
        value: LEGACY_MIGRATION_MARKER,
      });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });

    expect(database.getMetadata(CATALOG_METADATA_KEYS.migrationMarker)).toBe(
      LEGACY_MIGRATION_MARKER
    );
  });
});

describe('validateCatalogItemsForSupplier', () => {
  test('отклоняет товар другого поставщика', () => {
    expect(() =>
      validateCatalogItemsForSupplier(
        [{ id: 'x', supplier: supplierB }],
        supplierA,
        'шины'
      )
    ).toThrow(/не совпадает/);
  });
});

const createCartReadDatabase = ({
  tires = [],
  discs = [],
  version = '',
  failureStore = null,
} = {}) => {
  const values = {
    [CATALOG_STORES.tires]: new Map(tires.map((item) => [item.id, item])),
    [CATALOG_STORES.discs]: new Map(discs.map((item) => [item.id, item])),
  };
  let transactionCount = 0;
  let lastTransaction = null;

  return {
    get transactionCount() {
      return transactionCount;
    },
    get lastTransaction() {
      return lastTransaction;
    },
    transaction(storeNames, mode) {
      transactionCount += 1;
      let pending = 0;
      let aborted = false;
      const transaction = {
        error: null,
        oncomplete: null,
        onabort: null,
        abort() {
          aborted = true;
          queueMicrotask(() => transaction.onabort?.());
        },
        objectStore(storeName) {
          return {
            get(key) {
              pending += 1;
              const request = { result: undefined, error: null };
              queueMicrotask(() => {
                if (aborted) return;
                if (failureStore === storeName) {
                  request.error = makeError('UnknownError', 'read failed');
                  request.onerror?.();
                  return;
                }
                request.result =
                  storeName === CATALOG_STORES.metadata
                    ? version
                      ? metadataRecord(key, version)
                      : undefined
                    : values[storeName].get(key);
                request.onsuccess?.();
                pending -= 1;
                if (pending === 0) {
                  queueMicrotask(() => {
                    if (!aborted) transaction.oncomplete?.();
                  });
                }
              });
              return request;
            },
          };
        },
      };
      lastTransaction = { storeNames, mode };
      return transaction;
    },
  };
};

describe('CatalogDatabase: batch cart read', () => {
  test('читает обе категории и версию одной readonly-транзакцией', async () => {
    const database = createCartReadDatabase({
      tires: [{ id: 'same', title: 'Шина' }],
      discs: [{ id: 'same', title: 'Диск' }],
      version: '2026-08-23T10:00:00Z',
    });
    mountCatalogDb(database);

    const result = await indexedDBService.readCartCatalogItems([
      { requestKey: 'same', category: null, id: 'same' },
      { requestKey: 'tyres:missing', category: 'tyres', id: 'missing' },
    ]);

    expect(database.transactionCount).toBe(1);
    expect(database.lastTransaction).toEqual({
      storeNames: [
        CATALOG_STORES.tires,
        CATALOG_STORES.discs,
        CATALOG_STORES.metadata,
      ],
      mode: 'readonly',
    });
    expect(result).toEqual({
      version: '2026-08-23T10:00:00Z',
      results: [
        {
          requestKey: 'same',
          matches: {
            tyres: { id: 'same', title: 'Шина' },
            discs: { id: 'same', title: 'Диск' },
          },
        },
        {
          requestKey: 'tyres:missing',
          matches: { tyres: null, discs: null },
        },
      ],
    });
  });

  test('ошибка request отклоняет всю операцию', async () => {
    const database = createCartReadDatabase({
      version: '2026-08-23T10:00:00Z',
      failureStore: CATALOG_STORES.tires,
    });
    mountCatalogDb(database);

    await expect(
      indexedDBService.readCartCatalogItems([
        { requestKey: 'tyres:x', category: 'tyres', id: 'x' },
      ])
    ).rejects.toThrow('read failed');
  });
});
