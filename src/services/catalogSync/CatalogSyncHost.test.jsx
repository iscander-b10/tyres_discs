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
  let activeStore;
  let generation;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    auth = { isWorkspaceReady: false, workspace: null };
    notifyCatalogApplied = jest.fn();
    activeStore = null;
    generation = 0;

    useAuth.mockImplementation(() => auth);
    useAppShell.mockReturnValue({ notifyCatalogApplied });
    isCatalogSyncConfigured.mockReturnValue(true);
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
  });

  afterEach(async () => {
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
    });

    expect(checkAndSyncCatalog).toHaveBeenCalledWith({ storeId: 'store-a' });
    expect(checkAndSyncCatalog).toHaveBeenCalledWith({ storeId: 'store-b' });
    expect(notifyCatalogApplied).not.toHaveBeenCalledWith(
      'old-version',
      'store-a'
    );
  });
});
