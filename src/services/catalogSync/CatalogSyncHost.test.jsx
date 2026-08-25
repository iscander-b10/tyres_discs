import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import indexedDBService from '../indexedDBService';
import { CatalogSyncHost } from './CatalogSyncHost';
import {
  checkAndSyncCatalog,
  isCatalogSyncConfigured,
} from './catalogSyncService';

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
jest.mock('./catalogSyncService', () => ({
  checkAndSyncCatalog: jest.fn(),
  isCatalogSyncConfigured: jest.fn(),
  msUntilNextSyncCheck: () => 60_000,
}));

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('CatalogSyncHost workspace lifecycle', () => {
  let container;
  let root;
  let auth;
  let notifyCatalogApplied;
  let setCatalogBootstrap;
  let registerCatalogBootstrapRetry;
  let bootstrap;
  let activeStore;
  let generation;
  let visibilityState;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    auth = { isWorkspaceReady: false, workspace: null };
    notifyCatalogApplied = jest.fn();
    bootstrap = { phase: 'idle', progress: 0, label: '' };
    setCatalogBootstrap = jest.fn((update) => {
      bootstrap =
        typeof update === 'function' ? update(bootstrap) : { ...update };
    });
    registerCatalogBootstrapRetry = jest.fn(() => jest.fn());
    activeStore = null;
    generation = 0;
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    useAuth.mockImplementation(() => auth);
    useAppShell.mockReturnValue({
      notifyCatalogApplied,
      setCatalogBootstrap,
      registerCatalogBootstrapRetry,
    });
    isCatalogSyncConfigured.mockReturnValue(true);
    indexedDBService.isCatalogEmpty.mockResolvedValue(false);
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
    jest.useRealTimers();
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const render = async () => {
    await act(async () => {
      root.render(<CatalogSyncHost />);
      await Promise.resolve();
    });
  };

  test('не обращается к sync API до готового workspace', async () => {
    await render();

    expect(isCatalogSyncConfigured).not.toHaveBeenCalled();
    expect(checkAndSyncCatalog).not.toHaveBeenCalled();
  });

  test('передаёт storeId и игнорирует результат прежнего магазина', async () => {
    const oldSync = deferred();
    checkAndSyncCatalog
      .mockReturnValueOnce(oldSync.promise)
      .mockResolvedValueOnce({ status: 'up-to-date', version: 'v2' });
    indexedDBService.getPersistedCatalogVersion
      .mockResolvedValueOnce('old-version')
      .mockResolvedValueOnce('v2');
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };
    await render();

    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-b', storeId: 'store-b' },
    };
    await render();

    await act(async () => {
      oldSync.resolve({ status: 'applied', version: 'old-version' });
      await oldSync.promise;
      await Promise.resolve();
    });

    expect(checkAndSyncCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-a', signal: expect.any(AbortSignal) })
    );
    expect(checkAndSyncCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-b', signal: expect.any(AbortSignal) })
    );
    expect(notifyCatalogApplied).not.toHaveBeenCalledWith(
      'old-version',
      'store-a'
    );
  });

  test('бампит UI при up-to-date, если IDB-версия новее', async () => {
    checkAndSyncCatalog.mockResolvedValue({
      status: 'up-to-date',
      version: '2026-08-24T10:00:00Z',
    });
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue(
      '2026-08-24T12:00:00Z'
    );
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(notifyCatalogApplied).toHaveBeenCalledWith(
      '2026-08-24T12:00:00Z',
      'store-a'
    );
  });

  test('скрытый slot не запускает sync', async () => {
    jest.useFakeTimers();
    checkAndSyncCatalog.mockResolvedValue({
      status: 'up-to-date',
      version: 'v1',
    });
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue('v1');
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    expect(checkAndSyncCatalog).toHaveBeenCalledTimes(1);

    visibilityState = 'hidden';
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(checkAndSyncCatalog).toHaveBeenCalledTimes(1);
  });

  test('пустой каталог держит blocking, затем ready после snapshot', async () => {
    const sync = deferred();
    indexedDBService.isCatalogEmpty.mockResolvedValue(true);
    checkAndSyncCatalog.mockReturnValue(sync.promise);
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(bootstrap.phase).toBe('blocking');
    expect(bootstrap.waitForShowcase).toBe(true);
    expect(checkAndSyncCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-a',
        onProgress: expect.any(Function),
      })
    );

    indexedDBService.isCatalogEmpty.mockResolvedValue(false);
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue('v1');
    await act(async () => {
      sync.resolve({ status: 'applied', version: 'v1' });
      await sync.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(indexedDBService.warmupCatalogReadCache).toHaveBeenCalledWith(
      expect.objectContaining({ tires: true, discs: true })
    );
    expect(bootstrap.phase).toBe('ready');
    expect(bootstrap.waitForShowcase).toBe(true);
    expect(bootstrap.progress).toBe(100);
    expect(bootstrap.waitForShowcase).toBe(true);
  });

  test('onProgress cold start обновляет progress и label в AppShell', async () => {
    const sync = deferred();
    indexedDBService.isCatalogEmpty.mockResolvedValue(true);
    checkAndSyncCatalog.mockReturnValue(sync.promise);
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
    });

    const onProgress = checkAndSyncCatalog.mock.calls[0][0].onProgress;
    await act(async () => {
      onProgress({
        phase: 'download',
        receivedBytes: 2 * 1024 * 1024,
        totalBytes: null,
        progress: 32,
      });
    });
    expect(bootstrap.phase).toBe('blocking');
    expect(bootstrap.progress).toBe(32);
    expect(bootstrap.label).toBe('Загружено 2,0 МБ');

    await act(async () => {
      onProgress({
        phase: 'download',
        receivedBytes: 3 * 1024 * 1024,
        totalBytes: null,
        progress: 20,
      });
    });
    expect(bootstrap.progress).toBe(32);

    await act(async () => {
      onProgress({
        phase: 'parse',
        receivedBytes: 3 * 1024 * 1024,
        totalBytes: null,
        progress: 86,
      });
    });
    expect(bootstrap.label).toBe('Читаем каталог');
    expect(bootstrap.progress).toBe(86);

    await act(async () => {
      sync.resolve({ status: 'error', error: 'HTTP 503' });
      await sync.promise;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(bootstrap.phase).toBe('error');
    expect(bootstrap.error).toBe('Сервер каталога не ответил.');
  });

  test('непустой каталог не открывает шторку и синхронизирует тихо', async () => {
    indexedDBService.isCatalogEmpty.mockResolvedValue(false);
    checkAndSyncCatalog.mockResolvedValue({
      status: 'up-to-date',
      version: 'v1',
    });
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue('v1');
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const phases = setCatalogBootstrap.mock.calls.map(([update]) => {
      const next =
        typeof update === 'function' ? update({ phase: 'idle' }) : update;
      return next?.phase;
    });
    expect(phases).not.toContain('blocking');
    expect(phases).not.toContain('error');
    expect(bootstrap.phase).toBe('ready');
    expect(bootstrap.waitForShowcase).toBeUndefined();
    expect(checkAndSyncCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-a',
        onProgress: undefined,
      })
    );
    expect(indexedDBService.warmupCatalogReadCache).not.toHaveBeenCalled();
  });

  test('offline на пустом каталоге ставит error в bootstrap', async () => {
    indexedDBService.isCatalogEmpty.mockResolvedValue(true);
    checkAndSyncCatalog.mockResolvedValue({ status: 'offline' });
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bootstrap.phase).toBe('error');
    expect(bootstrap.error).toBe('Нет сети. Проверьте подключение.');
  });

  test('stale store и abort не ставят общую ошибку bootstrap', async () => {
    indexedDBService.isCatalogEmpty.mockResolvedValue(true);
    checkAndSyncCatalog.mockResolvedValue({
      status: 'skipped',
      error: 'stale store',
    });
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bootstrap.phase).not.toBe('error');
    expect(bootstrap.phase).toBe('blocking');

    checkAndSyncCatalog.mockResolvedValue({
      status: 'skipped',
      error: 'aborted',
    });
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-b', storeId: 'store-b' },
    };
    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bootstrap.phase).not.toBe('error');
  });

  test('warmup обеих категорий после cold apply идёт до notify и ready', async () => {
    const sync = deferred();
    const warmup = deferred();
    indexedDBService.isCatalogEmpty.mockResolvedValue(true);
    indexedDBService.warmupCatalogReadCache.mockReturnValue(warmup.promise);
    checkAndSyncCatalog.mockReturnValue(sync.promise);
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
    });

    indexedDBService.isCatalogEmpty.mockResolvedValue(false);
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue('v1');
    await act(async () => {
      sync.resolve({ status: 'applied', version: 'v1' });
      await sync.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bootstrap.phase).toBe('blocking');
    expect(notifyCatalogApplied).not.toHaveBeenCalled();
    expect(indexedDBService.warmupCatalogReadCache).toHaveBeenCalledWith(
      expect.objectContaining({ tires: true, discs: true })
    );

    const onStep = indexedDBService.warmupCatalogReadCache.mock.calls[0][0]
      .onStep;
    await act(async () => {
      onStep({ category: 'tires' });
      onStep({ category: 'discs' });
    });
    expect(bootstrap.label).toBe('Готовим витрину');
    expect(bootstrap.progress).toBeGreaterThanOrEqual(97);

    await act(async () => {
      warmup.resolve({ warmed: ['tires', 'discs'] });
      await warmup.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(notifyCatalogApplied).toHaveBeenCalledWith('v1', 'store-a');
    expect(bootstrap.phase).toBe('ready');
  });

  test('вторая вкладка на blocking: waiting без download %, затем ready', async () => {
    const sync = deferred();
    indexedDBService.isCatalogEmpty.mockResolvedValue(true);
    checkAndSyncCatalog.mockImplementation(({ onLockWaiting }) => {
      onLockWaiting?.();
      return sync.promise;
    });
    auth = {
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };

    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bootstrap.phase).toBe('blocking');
    expect(bootstrap.label).toBe('Каталог загружается в другой вкладке');
    expect(bootstrap.progress).toBe(0);
    expect(bootstrap.error).toBeUndefined();

    indexedDBService.isCatalogEmpty.mockResolvedValue(false);
    indexedDBService.getPersistedCatalogVersion.mockResolvedValue('v1');
    await act(async () => {
      sync.resolve({ status: 'up-to-date', version: 'v1' });
      await sync.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(indexedDBService.warmupCatalogReadCache).toHaveBeenCalled();
    expect(notifyCatalogApplied).toHaveBeenCalledWith('v1', 'store-a');
    expect(bootstrap.phase).toBe('ready');
  });
});
