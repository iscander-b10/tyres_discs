import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import indexedDBService from '../indexedDBService';
import { DemoCatalogHost } from './DemoCatalogHost';
import { loadFrozenDemoCatalog } from './demoCatalogService';

jest.mock('../../app/AppShellContext', () => ({ useAppShell: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../indexedDBService', () => ({
  __esModule: true,
  default: {
    setActiveStore: jest.fn(),
    isActiveStore: jest.fn(),
    getPersistedCatalogVersion: jest.fn(),
    isCatalogEmpty: jest.fn(),
    warmupCatalogReadCache: jest.fn(),
  },
}));
jest.mock('./demoCatalogService', () => ({
  loadFrozenDemoCatalog: jest.fn(),
}));

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('DemoCatalogHost', () => {
  let container;
  let root;
  let auth;
  let notifyCatalogApplied;
  let setCatalogBootstrap;
  let registerCatalogBootstrapRetry;
  let bootstrap;
  let activeStore;
  let generation;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    auth = {
      isWorkspaceReady: true,
      workspace: { login: 'demo', accountId: 'demo', storeId: 'demo' },
    };
    notifyCatalogApplied = jest.fn();
    bootstrap = { phase: 'idle', progress: 0, label: '' };
    setCatalogBootstrap = jest.fn((update) => {
      bootstrap =
        typeof update === 'function' ? update(bootstrap) : { ...update };
    });
    registerCatalogBootstrapRetry = jest.fn(() => jest.fn());
    activeStore = null;
    generation = 0;

    useAuth.mockImplementation(() => auth);
    useAppShell.mockReturnValue({
      notifyCatalogApplied,
      setCatalogBootstrap,
      registerCatalogBootstrapRetry,
    });
    indexedDBService.warmupCatalogReadCache.mockResolvedValue({
      warmed: ['tires', 'discs'],
    });
    indexedDBService.setActiveStore.mockImplementation((storeId) => {
      if (storeId !== activeStore) {
        activeStore = storeId;
        generation += 1;
      }
      return generation;
    });
    indexedDBService.isActiveStore.mockImplementation(
      (storeId, expectedGeneration) =>
        storeId === activeStore && expectedGeneration === generation
    );
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue('');
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const render = async (path = '/demo/tyres') => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <DemoCatalogHost />
        </MemoryRouter>
      );
      await Promise.resolve();
    });
  };

  test('пустой IDB: blocking, download frozen snapshot, без МБ в label', async () => {
    const sync = deferred();
    loadFrozenDemoCatalog.mockReturnValue(sync.promise);
    indexedDBService.isCatalogEmpty.mockResolvedValue(true);
    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bootstrap.phase).toBe('blocking');
    expect(bootstrap.waitForShowcase).toBe(true);
    expect(String(bootstrap.label)).not.toMatch(/МБ|байт/i);
    expect(loadFrozenDemoCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'demo', signal: expect.any(AbortSignal) })
    );

    const onProgress = loadFrozenDemoCatalog.mock.calls[0][0].onProgress;
    await act(async () => {
      onProgress({
        phase: 'download',
        receivedBytes: 12_000_000,
        totalBytes: 48_000_000,
        progress: 24,
      });
    });
    expect(bootstrap.progress).toBe(24);
    expect(bootstrap.label).toBe('Загружаем каталог шин и дисков');
    expect(JSON.stringify(bootstrap)).not.toMatch(/МБ|12,4|48/);

    indexedDBService.isCatalogEmpty.mockResolvedValue(false);
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue(
      '2026-08-25T15:10:00+03:00'
    );
    await act(async () => {
      sync.resolve({
        status: 'applied',
        version: '2026-08-25T15:10:00+03:00',
      });
      await sync.promise;
      await Promise.resolve();
    });

    expect(indexedDBService.warmupCatalogReadCache).toHaveBeenCalled();
    expect(notifyCatalogApplied).toHaveBeenCalledWith(
      '2026-08-25T15:10:00+03:00',
      'demo'
    );
    expect(bootstrap.phase).toBe('ready');
  });

  test('непустой IDB: без overlay и без повторного download', async () => {
    indexedDBService.isCatalogEmpty.mockResolvedValue(false);
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue(
      '2026-08-25T15:10:00+03:00'
    );
    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadFrozenDemoCatalog).not.toHaveBeenCalled();
    expect(setCatalogBootstrap.mock.calls.some(([update]) => {
      const next = typeof update === 'function' ? update(bootstrap) : update;
      return next?.phase === 'blocking';
    })).toBe(false);
    expect(bootstrap.phase).toBe('ready');
    expect(notifyCatalogApplied).toHaveBeenCalledWith(
      '2026-08-25T15:10:00+03:00',
      'demo'
    );
  });
});
