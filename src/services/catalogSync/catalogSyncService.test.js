const API_BASE_ENV = 'REACT_APP_CATALOG_API_BASE';
const STORE_ID_ENV = 'REACT_APP_STORE_ID';
const VERSION_KEY = 'ivanor.catalog.cloudVersion';
const VERSION = '2026-08-23T10:00:00Z';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

const replace = (items = []) => ({ action: 'replace', status: 'ok', items });
const keepPrevious = (status = 'failed') => ({
  action: 'keepPrevious',
  status,
});
const purge = () => ({ action: 'purge', status: 'ok' });

const snapshotWith = ({
  tyres = keepPrevious(),
  discs = keepPrevious('keptPrevious'),
  supplier = 'Поставщик A',
} = {}) => ({
  version: VERSION,
  suppliers: {
    'supplier-a': { supplier, tyres, discs },
  },
});

function loadService(overrides = {}) {
  jest.doMock('./catalogSyncChannel', () => ({
    postCatalogApplied: jest.fn(),
  }));

  const actual = jest.requireActual('../indexedDBService');
  const indexedDBService = {
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
    validateCatalogItemsForSupplier: actual.validateCatalogItemsForSupplier,
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

    await expect(
      service.applyCatalogSnapshot(snapshotWith({ tyres: purge(), discs: replace() }))
    ).resolves.toEqual({ applied: true, writes: 1, skipped: false });

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
    const invalidSnapshot = snapshotWith();
    mutate(invalidSnapshot.suppliers['supplier-a']);
    const { service, indexedDBService } = loadService();

    await expect(service.applyCatalogSnapshot(invalidSnapshot)).rejects.toThrow(
      /Некорректный snapshot/
    );
    expect(indexedDBService.applyCatalogSnapshot).not.toHaveBeenCalled();
  });

  test('legacy label преобразуется в supplier', async () => {
    const legacySnapshot = {
      version: VERSION,
      suppliers: {
        'supplier-a': {
          label: 'Поставщик A',
          tyres: replace([{ id: 'tire-1', supplier: 'Поставщик A' }]),
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
      .mockResolvedValueOnce(jsonResponse(snapshotWith({ tyres: replace() })));

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'applied',
      version: VERSION,
    });
    expect(window.localStorage.getItem(VERSION_KEY)).toBe(VERSION);
    expect(postCatalogApplied).toHaveBeenCalledWith(VERSION);
  });

  test('ошибка IndexedDB не обновляет localStorage и не шлёт broadcast', async () => {
    const applyCatalogSnapshot = jest
      .fn()
      .mockRejectedValue(new Error('IndexedDB transaction aborted'));
    const { service, postCatalogApplied } = loadService({ applyCatalogSnapshot });
    window.localStorage.setItem(VERSION_KEY, 'old-version');
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(jsonResponse(snapshotWith({ tyres: replace() })));

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'error',
      error: 'IndexedDB transaction aborted',
    });
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
});
