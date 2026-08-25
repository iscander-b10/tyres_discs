const { TextDecoder, TextEncoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

const API_BASE_ENV = 'REACT_APP_CATALOG_API_BASE';
const STORE_ID_ENV = 'REACT_APP_STORE_ID';
const VERSION_KEY = 'ivanor.catalog.cloudVersion.test-store';
const VERSION = '2026-08-23T10:00:00Z';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

function headerMap(headers = {}) {
  const map = new Map(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      String(value),
    ])
  );
  return {
    get(name) {
      return map.get(String(name).toLowerCase()) ?? null;
    },
  };
}

function encodeJsonChunks(value, parts = 2) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (parts <= 1) return [bytes];
  const size = Math.max(1, Math.ceil(bytes.length / parts));
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size));
  }
  return chunks;
}

function streamResponse(chunks, { status = 200, headers = {}, onRead } = {}) {
  let index = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headerMap(headers),
    body: {
      getReader() {
        return {
          async read() {
            onRead?.();
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          },
          async cancel() {},
        };
      },
    },
    json: async () => {
      throw new Error('stream response should not call json()');
    },
  };
}

const progressEvents = (onProgress) =>
  onProgress.mock.calls.map((call) => call[0]);

const replace = (items = []) => ({ action: 'replace', status: 'ok', items });
const keepPrevious = (status = 'failed') => ({
  action: 'keepPrevious',
  status,
});
const purge = () => ({ action: 'purge', status: 'ok' });

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
  tyres = keepPrevious(),
  discs = keepPrevious('keptPrevious'),
  supplier = 'Поставщик A',
  schemaVersion,
} = {}) => {
  const snapshot = {
    version: VERSION,
    suppliers: {
      'supplier-a': { supplier, tyres, discs },
    },
  };
  if (schemaVersion !== undefined) snapshot.schemaVersion = schemaVersion;
  return snapshot;
};

function loadService(overrides = {}) {
  jest.doMock('./catalogSyncChannel', () => ({
    postCatalogApplied: jest.fn(),
  }));

  let activeStoreId = null;
  let generation = 0;
  const indexedDBService = {
    setActiveStore: jest.fn((storeId) => {
      if (activeStoreId !== storeId) {
        activeStoreId = storeId;
        generation += 1;
      }
      return generation;
    }),
    isActiveStore: jest.fn(
      (storeId, expectedGeneration) =>
        storeId === activeStoreId &&
        (expectedGeneration === undefined || expectedGeneration === generation)
    ),
    applyCatalogSnapshot: jest
      .fn()
      .mockResolvedValue({ applied: true, writes: 1, skipped: false }),
    getPersistedCatalogVersion: jest.fn().mockResolvedValue(''),
    isCatalogEmpty: jest.fn().mockResolvedValue(true),
    ...overrides,
  };

  jest.doMock('../indexedDBService', () => ({
    __esModule: true,
    default: indexedDBService,
  }));

  const channel = require('./catalogSyncChannel');

  return {
    service: require('./catalogSyncService'),
    indexedDBService,
    postCatalogApplied: channel.postCatalogApplied,
  };
}

describe('безопасное применение snapshot каталога', () => {
  const originalApiBase = process.env[API_BASE_ENV];
  const originalStoreId = process.env[STORE_ID_ENV];

  beforeEach(() => {
    jest.resetModules();
    process.env[API_BASE_ENV] = 'https://catalog.example';
    process.env[STORE_ID_ENV] = 'test-store';
    window.localStorage.clear();
    global.fetch = jest.fn();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalApiBase === undefined) delete process.env[API_BASE_ENV];
    else process.env[API_BASE_ENV] = originalApiBase;
    if (originalStoreId === undefined) delete process.env[STORE_ID_ENV];
    else process.env[STORE_ID_ENV] = originalStoreId;
  });

  test('replace/purge/keepPrevious делегируются одной atomic-операции', async () => {
    const { service, indexedDBService } = loadService();

    const result = await service.applyCatalogSnapshot(
      snapshotWith({
        schemaVersion: 1,
        tyres: purge(),
        discs: replace([
          tire({
            id: 'disc-1',
            code: 'D1',
            sizeTitle: 'R16 / 7J',
            diskType: 'Литой',
            et: 40,
            pn: 5,
            pcd: 114.3,
            cb: 66.1,
          }),
        ]),
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        applied: true,
        writes: 1,
        skipped: false,
        validationReport: expect.objectContaining({ valid: true }),
      })
    );
    expect(indexedDBService.applyCatalogSnapshot).toHaveBeenCalledTimes(1);
    expect(indexedDBService.applyCatalogSnapshot).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ category: 'tyres', action: 'purge' }),
        expect.objectContaining({ category: 'discs', action: 'replace' }),
      ]),
      VERSION
    );
  });

  test.each([
    ['отсутствующая команда', (entry) => delete entry.tyres],
    ['null', (entry) => { entry.tyres = null; }],
    [
      'неизвестный action',
      (entry) => {
        entry.tyres = { action: 'merge', status: 'ok' };
      },
    ],
  ])('%s отклоняется до atomic-операции', async (_, mutate) => {
    const invalidSnapshot = snapshotWith({ schemaVersion: 1 });
    mutate(invalidSnapshot.suppliers['supplier-a']);
    const { service, indexedDBService } = loadService();

    await expect(service.applyCatalogSnapshot(invalidSnapshot)).rejects.toThrow(
      /Некорректный snapshot/
    );
    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
  });

  test('неизвестная schemaVersion не доходит до IndexedDB', async () => {
    const { service, indexedDBService } = loadService();
    const snapshot = snapshotWith({ schemaVersion: 2, tyres: purge() });

    await expect(service.applyCatalogSnapshot(snapshot)).rejects.toMatchObject({
      message: expect.stringMatching(/Некорректный snapshot/),
      validationReport: expect.objectContaining({
        valid: false,
        errors: expect.arrayContaining([
          expect.objectContaining({ code: 'UNSUPPORTED_SCHEMA_VERSION' }),
        ]),
      }),
    });
    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();
  });

  test('нормализованные amount уходят в IndexedDB', async () => {
    const { service, indexedDBService } = loadService();
    await service.applyCatalogSnapshot(
      snapshotWith({
        schemaVersion: 1,
        tyres: replace([tire({ amount: '4,0', price: '1000,5' })]),
        discs: purge(),
      })
    );

    const commands = indexedDBService.applyCatalogSnapshot.mock.calls[0][0];
    const tyreCmd = commands.find((c) => c.category === 'tyres');
    expect(tyreCmd.items[0].amount).toBe(4);
    expect(typeof tyreCmd.items[0].amount).toBe('number');
    expect(tyreCmd.items[0].price).toBe(1000.5);
  });

  test('legacy label преобразуется в supplier', async () => {
    const legacySnapshot = {
      version: VERSION,
      schemaVersion: 1,
      suppliers: {
        'supplier-a': {
          label: 'Поставщик A',
          tyres: replace([tire({ supplier: 'Поставщик A' })]),
          discs: keepPrevious(),
        },
      },
    };
    const { service, indexedDBService } = loadService();

    await service.applyCatalogSnapshot(legacySnapshot);

    expect(indexedDBService.applyCatalogSnapshot).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ supplier: 'Поставщик A' }),
      ]),
      VERSION
    );
  });

  test('успешный commit обновляет localStorage и уведомляет другие вкладки', async () => {
    const { service, postCatalogApplied } = loadService();
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        jsonResponse(
          snapshotWith({
            schemaVersion: 1,
            tyres: replace([tire()]),
            discs: purge(),
          })
        )
      );

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'applied',
      version: VERSION,
    });
    expect(window.localStorage.getItem(VERSION_KEY)).toBe(VERSION);
    expect(postCatalogApplied).toHaveBeenCalledWith(VERSION, 'test-store');
  });

  test('ошибка IndexedDB не обновляет localStorage и не шлёт broadcast', async () => {
    const applyCatalogSnapshot = jest
      .fn()
      .mockRejectedValue(new Error('IndexedDB transaction aborted'));
    const { service, postCatalogApplied } = loadService({ applyCatalogSnapshot });
    window.localStorage.setItem(VERSION_KEY, 'old-version');
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        jsonResponse(
          snapshotWith({
            schemaVersion: 1,
            tyres: replace([tire()]),
            discs: purge(),
          })
        )
      );

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'error',
      error: 'IndexedDB transaction aborted',
    });
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('old-version');
    expect(postCatalogApplied).not.toHaveBeenCalled();
  });

  test('validation failure не обновляет localStorage и не шлёт broadcast', async () => {
    const { service, indexedDBService, postCatalogApplied } = loadService();
    window.localStorage.setItem(VERSION_KEY, 'old-version');

    await expect(
      service.applyCatalogSnapshot(
        snapshotWith({
          schemaVersion: 1,
          tyres: replace([tire({ id: '' })]),
          discs: purge(),
        })
      )
    ).rejects.toThrow(/Некорректный snapshot/);

    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('old-version');
    expect(postCatalogApplied).not.toHaveBeenCalled();
  });

  test('решение up-to-date принимает persisted metadata version', async () => {
    const { service, indexedDBService } = loadService({
      getPersistedCatalogVersion: jest.fn().mockResolvedValue(VERSION),
      isCatalogEmpty: jest.fn().mockResolvedValue(false),
    });
    global.fetch.mockResolvedValueOnce(jsonResponse({ version: VERSION }));

    await expect(service.checkAndSyncCatalog()).resolves.toEqual({
      status: 'up-to-date',
      version: VERSION,
    });
    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
  });

  test('изолирует URL и local version двух storeId', async () => {
    const { service } = loadService();

    service.setLocalCatalogVersion('version-a', 'store/a');
    service.setLocalCatalogVersion('version-b', 'store b');

    expect(
      window.localStorage.getItem('ivanor.catalog.cloudVersion.store%2Fa')
    ).toBe('version-a');
    expect(
      window.localStorage.getItem('ivanor.catalog.cloudVersion.store%20b')
    ).toBe('version-b');

    global.fetch.mockResolvedValueOnce(jsonResponse({}));
    await service.checkAndSyncCatalog({ storeId: 'store/a' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://catalog.example/v2/catalog/store%2Fa/meta',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  test('без storeId использует актуальный REACT_APP_STORE_ID fallback', () => {
    const { service } = loadService();
    process.env[STORE_ID_ENV] = 'changed-after-import';

    expect(service.getCatalogStoreId()).toBe('changed-after-import');
    service.setLocalCatalogVersion('fallback-version');
    expect(
      window.localStorage.getItem(
        'ivanor.catalog.cloudVersion.changed-after-import'
      )
    ).toBe('fallback-version');
  });

  test('игнорирует stale sync после переключения магазина', async () => {
    let activeStoreId = null;
    let generation = 0;
    const setActiveStore = jest.fn((storeId) => {
      if (activeStoreId !== storeId) {
        activeStoreId = storeId;
        generation += 1;
      }
      return generation;
    });
    const isActiveStore = jest.fn(
      (storeId, expectedGeneration) =>
        storeId === activeStoreId && expectedGeneration === generation
    );
    const { service, indexedDBService, postCatalogApplied } = loadService({
      setActiveStore,
      isActiveStore,
    });
    let resolveFirstMeta;
    global.fetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstMeta = resolve;
          })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    const staleSync = service.checkAndSyncCatalog({ storeId: 'store-a' });
    await service.checkAndSyncCatalog({ storeId: 'store-b' });
    resolveFirstMeta(jsonResponse({ version: VERSION }));

    await expect(staleSync).resolves.toEqual({
      status: 'skipped',
      error: 'stale store',
    });
    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
    expect(postCatalogApplied).not.toHaveBeenCalled();
  });

  test('stream progress с известным Content-Length считает долю байтов', async () => {
    const { service, indexedDBService } = loadService();
    const snapshot = snapshotWith({
      schemaVersion: 1,
      tyres: replace([tire()]),
      discs: purge(),
    });
    const chunks = encodeJsonChunks(snapshot, 2);
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        streamResponse(chunks, {
          headers: { 'Content-Length': String(total) },
        })
      );
    const onProgress = jest.fn();

    await expect(
      service.checkAndSyncCatalog({ force: true, onProgress })
    ).resolves.toEqual({ status: 'applied', version: VERSION });

    const download = progressEvents(onProgress).filter(
      (event) => event.phase === 'download'
    );
    expect(download.length).toBeGreaterThan(0);
    expect(download.some((event) => event.totalBytes === total)).toBe(true);
    expect(download.every((event) => event.progress <= 80)).toBe(true);
    expect(download[download.length - 1]).toEqual(
      expect.objectContaining({
        receivedBytes: total,
        totalBytes: total,
        progress: 80,
      })
    );
    const firstChunk = download.find(
      (event) => event.receivedBytes === chunks[0].byteLength
    );
    expect(firstChunk.progress).toBeCloseTo(
      5 + 75 * (chunks[0].byteLength / total),
      5
    );
    expect(progressEvents(onProgress).some((event) => event.phase === 'parse')).toBe(
      true
    );
    expect(progressEvents(onProgress).some((event) => event.phase === 'apply')).toBe(
      true
    );
    expect(indexedDBService.applyCatalogSnapshot).toHaveBeenCalledTimes(1);
  });

  test('stream progress без Content-Length идёт коридором и не врёт percent файла', async () => {
    const { service } = loadService();
    const snapshot = snapshotWith({
      schemaVersion: 1,
      tyres: replace([tire()]),
      discs: purge(),
    });
    const chunks = encodeJsonChunks(snapshot, 3);
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(streamResponse(chunks));
    const onProgress = jest.fn();

    await expect(
      service.checkAndSyncCatalog({ force: true, onProgress })
    ).resolves.toEqual({ status: 'applied', version: VERSION });

    const download = progressEvents(onProgress).filter(
      (event) => event.phase === 'download' && event.receivedBytes > 0
    );
    expect(download.every((event) => event.totalBytes == null)).toBe(true);
    const percents = download.map((event) => event.progress);
    for (let index = 1; index < percents.length; index += 1) {
      expect(percents[index]).toBeGreaterThanOrEqual(percents[index - 1]);
    }
    expect(Math.max(...percents)).toBeLessThanOrEqual(80);
    expect(
      Math.max(...progressEvents(onProgress).map((event) => event.progress))
    ).toBeLessThan(100);
  });

  test('abort посреди stream даёт skipped aborted', async () => {
    const { service, indexedDBService } = loadService();
    const controller = new AbortController();
    const snapshot = snapshotWith({
      schemaVersion: 1,
      tyres: replace([tire()]),
      discs: purge(),
    });
    const chunks = encodeJsonChunks(snapshot, 4);
    let reads = 0;
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        streamResponse(chunks, {
          headers: { 'Content-Length': String(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)) },
          onRead: () => {
            reads += 1;
            if (reads === 2) controller.abort();
          },
        })
      );
    const onProgress = jest.fn();

    await expect(
      service.checkAndSyncCatalog({
        force: true,
        signal: controller.signal,
        onProgress,
      })
    ).resolves.toEqual({ status: 'skipped', error: 'aborted' });

    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
    expect(
      progressEvents(onProgress).some((event) => event.phase === 'download')
    ).toBe(true);
    expect(
      progressEvents(onProgress).some((event) => event.phase === 'apply')
    ).toBe(false);
  });

  test('gzip и разъезд total/stream не дают progress > 100', async () => {
    const { service } = loadService();
    const snapshot = snapshotWith({
      schemaVersion: 1,
      tyres: replace([tire()]),
      discs: purge(),
    });
    const chunks = encodeJsonChunks(snapshot, 2);
    const received = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    expect(received).toBeGreaterThan(10);

    const gzipProgress = jest.fn();
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        streamResponse(chunks, {
          headers: {
            'Content-Length': '10',
            'Content-Encoding': 'gzip',
          },
        })
      );
    await service.checkAndSyncCatalog({ force: true, onProgress: gzipProgress });
    const gzipDownload = progressEvents(gzipProgress).filter(
      (event) => event.phase === 'download'
    );
    expect(gzipDownload.every((event) => event.totalBytes == null)).toBe(true);
    expect(
      Math.max(...progressEvents(gzipProgress).map((event) => event.progress))
    ).toBeLessThan(100);

    const mismatchProgress = jest.fn();
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        streamResponse(chunks, {
          headers: { 'Content-Length': '10' },
        })
      );
    await service.checkAndSyncCatalog({
      force: true,
      onProgress: mismatchProgress,
    });
    const mismatchDownload = progressEvents(mismatchProgress).filter(
      (event) => event.phase === 'download' && event.receivedBytes > 10
    );
    expect(mismatchDownload.every((event) => event.totalBytes == null)).toBe(
      true
    );
    expect(
      Math.max(
        ...progressEvents(mismatchProgress).map((event) => event.progress)
      )
    ).toBeLessThan(100);
  });

  test('onProgress не ломает up-to-date путь', async () => {
    const { service, indexedDBService } = loadService({
      getPersistedCatalogVersion: jest.fn().mockResolvedValue(VERSION),
      isCatalogEmpty: jest.fn().mockResolvedValue(false),
    });
    global.fetch.mockResolvedValueOnce(jsonResponse({ version: VERSION }));
    const onProgress = jest.fn(() => {
      throw new Error('ui progress failed');
    });

    await expect(
      service.checkAndSyncCatalog({ onProgress })
    ).resolves.toEqual({
      status: 'up-to-date',
      version: VERSION,
    });
    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalled();
    expect(
      progressEvents(onProgress).every((event) => event.phase === 'meta')
    ).toBe(true);
  });
});
