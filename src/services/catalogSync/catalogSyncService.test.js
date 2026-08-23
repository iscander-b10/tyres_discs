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
  const actual = jest.requireActual('../indexedDBService');
  const indexedDBService = {
    replaceTiresForSupplier: jest
      .fn()
      .mockResolvedValue({ saved: 0, skipped: 0 }),
    replaceDiscsForSupplier: jest
      .fn()
      .mockResolvedValue({ saved: 0, skipped: 0 }),
    collectTireShowcaseCandidates: jest
      .fn()
      .mockResolvedValue({ isEmpty: false, candidates: [] }),
    collectDiscShowcaseCandidates: jest
      .fn()
      .mockResolvedValue({ isEmpty: false, candidates: [] }),
    ...overrides,
  };

  jest.doMock('../indexedDBService', () => ({
    __esModule: true,
    default: indexedDBService,
    validateCatalogItemsForSupplier: actual.validateCatalogItemsForSupplier,
  }));

  return {
    service: require('./catalogSyncService'),
    indexedDBService,
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

  test.each([
    ['replace с пустым массивом', replace(), 1],
    ['purge', purge(), 1],
    ['keepPrevious/failed', keepPrevious('failed'), 0],
    ['keepPrevious/keptPrevious', keepPrevious('keptPrevious'), 0],
  ])(
    '%s является успешно выполненной командой',
    async (_, tyres, writeCount) => {
      const { service, indexedDBService } = loadService();

      await expect(
        service.applyCatalogSnapshot(snapshotWith({ tyres }))
      ).resolves.toEqual({ applied: true, writes: writeCount });

      expect(indexedDBService.replaceTiresForSupplier).toHaveBeenCalledTimes(
        writeCount
      );
      if (writeCount) {
        expect(indexedDBService.replaceTiresForSupplier).toHaveBeenCalledWith(
          'Поставщик A',
          []
        );
      }
    }
  );

  test('шины и диски получают независимые команды', async () => {
    const { service, indexedDBService } = loadService();

    await service.applyCatalogSnapshot(
      snapshotWith({
        tyres: replace(),
        discs: keepPrevious('failed'),
      })
    );

    expect(indexedDBService.replaceTiresForSupplier).toHaveBeenCalledWith(
      'Поставщик A',
      []
    );
    expect(indexedDBService.replaceDiscsForSupplier).not.toHaveBeenCalled();
  });

  test('purge и replace используют одну операцию замены категории', async () => {
    const item = { id: 'disc-1', supplier: 'Поставщик A' };
    const { service, indexedDBService } = loadService();

    await service.applyCatalogSnapshot(
      snapshotWith({ tyres: purge(), discs: replace([item]) })
    );

    expect(indexedDBService.replaceTiresForSupplier).toHaveBeenCalledWith(
      'Поставщик A',
      []
    );
    expect(indexedDBService.replaceDiscsForSupplier).toHaveBeenCalledWith(
      'Поставщик A',
      [item]
    );
  });

  test.each([
    ['отсутствующая команда', (entry) => delete entry.tyres],
    [
      'null',
      (entry) => {
        entry.tyres = null;
      },
    ],
    [
      'неизвестный action',
      (entry) => {
        entry.tyres = { action: 'merge', status: 'ok' };
      },
    ],
    [
      'недопустимый status',
      (entry) => {
        entry.tyres = { action: 'replace', status: 'failed', items: [] };
      },
    ],
    [
      'replace без items',
      (entry) => {
        entry.tyres = { action: 'replace', status: 'ok' };
      },
    ],
    [
      'keepPrevious с items',
      (entry) => {
        entry.tyres = { ...keepPrevious(), items: [] };
      },
    ],
    [
      'purge с items',
      (entry) => {
        entry.tyres = { ...purge(), items: [] };
      },
    ],
    [
      'пустой legacy-массив',
      (entry) => {
        entry.tyres = [];
      },
    ],
  ])('%s отклоняется до операций записи', async (_, mutate) => {
    const invalidSnapshot = snapshotWith();
    mutate(invalidSnapshot.suppliers['supplier-a']);
    const { service, indexedDBService } = loadService();

    await expect(service.applyCatalogSnapshot(invalidSnapshot)).rejects.toThrow(
      /Некорректный snapshot/
    );
    expect(indexedDBService.replaceTiresForSupplier).not.toHaveBeenCalled();
    expect(indexedDBService.replaceDiscsForSupplier).not.toHaveBeenCalled();
  });

  test('несовпадение supplier отклоняет весь snapshot до записи', async () => {
    const invalidSnapshot = snapshotWith({
      tyres: replace([{ id: 'tire-1', supplier: 'Поставщик B' }]),
      discs: purge(),
    });
    const { service, indexedDBService } = loadService();

    await expect(service.applyCatalogSnapshot(invalidSnapshot)).rejects.toThrow(
      /не совпадает/
    );
    expect(indexedDBService.replaceTiresForSupplier).not.toHaveBeenCalled();
    expect(indexedDBService.replaceDiscsForSupplier).not.toHaveBeenCalled();
  });

  test('непустой legacy-массив безопасно преобразуется в replace', async () => {
    const item = { id: 'tire-1', supplier: 'Поставщик A' };
    const legacySnapshot = snapshotWith({ tyres: [item] });
    const { service, indexedDBService } = loadService();

    await service.applyCatalogSnapshot(legacySnapshot);

    expect(indexedDBService.replaceTiresForSupplier).toHaveBeenCalledWith(
      'Поставщик A',
      [item]
    );
  });

  test.each([
    ['успешный replace', replace([{ id: 'tire-1', supplier: 'Поставщик A' }])],
    ['успешная очистка', purge()],
    ['keepPrevious', keepPrevious()],
  ])('%s обновляет локальную версию', async (_, tyres) => {
    const { service } = loadService();
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(jsonResponse(snapshotWith({ tyres })));

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'applied',
      version: VERSION,
    });
    expect(window.localStorage.getItem(VERSION_KEY)).toBe(VERSION);
  });

  test('ошибка валидации не обновляет локальную версию', async () => {
    const { service } = loadService();
    window.localStorage.setItem(VERSION_KEY, 'old-version');
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(jsonResponse(snapshotWith({ tyres: null })));

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual(
      expect.objectContaining({ status: 'error' })
    );
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('old-version');
  });

  test('ошибка IndexedDB не обновляет локальную версию', async () => {
    const replaceTiresForSupplier = jest
      .fn()
      .mockRejectedValue(new Error('IndexedDB transaction aborted'));
    const { service } = loadService({ replaceTiresForSupplier });
    window.localStorage.setItem(VERSION_KEY, 'old-version');
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: VERSION }))
      .mockResolvedValueOnce(
        jsonResponse(snapshotWith({ tyres: replace(), discs: purge() }))
      );

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'error',
      error: 'Не удалось сохранить снимок (1 ошибок)',
    });
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('old-version');
  });
});
