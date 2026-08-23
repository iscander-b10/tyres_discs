const API_BASE_ENV = 'REACT_APP_CATALOG_API_BASE';
const STORE_ID_ENV = 'REACT_APP_STORE_ID';
const VERSION_KEY = 'ivanor.catalog.cloudVersion';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

function loadService(saveTires) {
  const indexedDBService = {
    saveTires,
    saveDiscs: jest.fn(),
    collectTireShowcaseCandidates: jest
      .fn()
      .mockResolvedValue({ isEmpty: false, candidates: [] }),
    collectDiscShowcaseCandidates: jest
      .fn()
      .mockResolvedValue({ isEmpty: false, candidates: [] }),
  };

  jest.doMock('../indexedDBService', () => ({
    __esModule: true,
    default: indexedDBService,
  }));

  return {
    service: require('./catalogSyncService'),
    indexedDBService,
  };
}

describe('обновление версии snapshot', () => {
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
    if (originalApiBase === undefined) {
      delete process.env[API_BASE_ENV];
    } else {
      process.env[API_BASE_ENV] = originalApiBase;
    }
    if (originalStoreId === undefined) {
      delete process.env[STORE_ID_ENV];
    } else {
      process.env[STORE_ID_ENV] = originalStoreId;
    }
  });

  test('skipped отдельных товаров считается успехом и обновляет версию', async () => {
    const saveTires = jest.fn().mockResolvedValue({ saved: 1, skipped: 1 });
    const { service } = loadService(saveTires);
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: '2026-08-23T10:00:00Z' }))
      .mockResolvedValueOnce(
        jsonResponse({
          version: '2026-08-23T10:00:00Z',
          suppliers: {
            supplier: {
              tyres: [
                { id: 'valid', supplier: 'Поставщик' },
                { supplier: 'Поставщик' },
              ],
            },
          },
        })
      );

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'applied',
      version: '2026-08-23T10:00:00Z',
    });
    expect(saveTires).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(VERSION_KEY)).toBe(
      '2026-08-23T10:00:00Z'
    );
  });

  test('ошибка IndexedDB не обновляет версию', async () => {
    const transactionError = new Error('IndexedDB transaction aborted');
    const saveTires = jest.fn().mockRejectedValue(transactionError);
    const { service } = loadService(saveTires);
    window.localStorage.setItem(VERSION_KEY, 'old-version');
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ version: 'new-version' }))
      .mockResolvedValueOnce(
        jsonResponse({
          version: 'new-version',
          suppliers: {
            supplier: {
              tyres: [{ id: 'valid', supplier: 'Поставщик' }],
            },
          },
        })
      );

    await expect(service.checkAndSyncCatalog({ force: true })).resolves.toEqual({
      status: 'error',
      error: 'Не удалось сохранить снимок (1 ошибок)',
    });
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('old-version');
  });
});
