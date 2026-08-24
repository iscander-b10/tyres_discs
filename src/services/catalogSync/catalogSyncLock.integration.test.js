/**
 * Один snapshot-fetch при параллельных checkAndSyncCatalog (fake Web Locks).
 */
const API_BASE_ENV = 'REACT_APP_CATALOG_API_BASE';
const STORE_ID_ENV = 'REACT_APP_STORE_ID';
const VERSION = '2026-08-24T12:00:00Z';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

const createFakeWebLocks = () => {
  const queues = new Map();
  const pump = (name) => {
    const queue = queues.get(name) || [];
    const head = queue[0];
    if (!head || head.started) return;
    head.started = true;
    Promise.resolve()
      .then(() => head.cb())
      .then(
        (value) => head.resolve(value),
        (err) => head.reject(err)
      )
      .finally(() => {
        queue.shift();
        pump(name);
      });
  };
  return {
    request(name, options, callback) {
      const cb = typeof options === 'function' ? options : callback;
      return new Promise((resolve, reject) => {
        const queue = queues.get(name) || [];
        queues.set(name, queue);
        queue.push({ resolve, reject, cb, started: false });
        pump(name);
      });
    },
  };
};

const snapshot = {
  version: VERSION,
  schemaVersion: 1,
  suppliers: {
    'supplier-a': {
      supplier: 'Поставщик A',
      tyres: {
        action: 'replace',
        status: 'ok',
        items: [
          {
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
          },
        ],
      },
      discs: { action: 'purge', status: 'ok' },
    },
  },
};

describe('checkAndSyncCatalog + writer lock', () => {
  const originalApiBase = process.env[API_BASE_ENV];
  const originalStoreId = process.env[STORE_ID_ENV];
  const originalLocks = navigator.locks;

  beforeEach(() => {
    jest.resetModules();
    process.env[API_BASE_ENV] = 'https://catalog.example';
    process.env[STORE_ID_ENV] = 'lock-store';
    window.localStorage.clear();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: createFakeWebLocks(),
    });

    jest.doMock('./catalogSyncChannel', () => ({
      postCatalogApplied: jest.fn(),
    }));
    jest.doMock('../indexedDBService', () => ({
      __esModule: true,
      default: {
        setActiveStore: jest.fn(() => 1),
        isActiveStore: jest.fn(() => true),
        applyCatalogSnapshot: jest
          .fn()
          .mockResolvedValue({ applied: true, writes: 1, skipped: false }),
        getPersistedCatalogVersion: jest
          .fn()
          .mockResolvedValueOnce('')
          .mockResolvedValueOnce(VERSION),
        isCatalogEmpty: jest
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false),
      },
    }));
  });

  afterEach(() => {
    process.env[API_BASE_ENV] = originalApiBase;
    process.env[STORE_ID_ENV] = originalStoreId;
    if (originalLocks === undefined) {
      delete navigator.locks;
    } else {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: originalLocks,
      });
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('два параллельных sync — один snapshot request', async () => {
    const { checkAndSyncCatalog } = require('./catalogSyncService');

    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/meta')) {
        return jsonResponse({ version: VERSION });
      }
      if (String(url).includes('/snapshot')) {
        return jsonResponse(snapshot);
      }
      throw new Error(`unexpected url ${url}`);
    });

    const [first, second] = await Promise.all([
      checkAndSyncCatalog({ storeId: 'lock-store' }),
      checkAndSyncCatalog({ storeId: 'lock-store' }),
    ]);

    expect(first).toEqual({ status: 'applied', version: VERSION });
    expect(second).toEqual({ status: 'up-to-date', version: VERSION });

    const snapshotCalls = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes('/snapshot')
    );
    expect(snapshotCalls).toHaveLength(1);
  });
});
