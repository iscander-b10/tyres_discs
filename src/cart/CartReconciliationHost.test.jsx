import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CartReconciliationHost } from './CartReconciliationHost';
import { useAppShell } from '../app/AppShellContext';
import { useAuth } from '../auth/AuthContext';
import indexedDBService from '../services/indexedDBService';
import { useCart } from './CartContext';

jest.mock('../app/AppShellContext', () => ({ useAppShell: jest.fn() }));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./CartContext', () => ({ useCart: jest.fn() }));
jest.mock('../services/indexedDBService', () => ({
  __esModule: true,
  default: { readCartCatalogItems: jest.fn() },
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('CartReconciliationHost', () => {
  let container;
  let root;
  let catalogSnapshotVersion;
  let reconcileCatalog;
  let cartItems;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    catalogSnapshotVersion = '';
    reconcileCatalog = jest.fn();
    cartItems = [
      {
        key: 'tyres:item-1',
        category: 'tyres',
        id: 'item-1',
        quantity: 4,
      },
    ];
    useAppShell.mockImplementation(() => ({ catalogSnapshotVersion }));
    useAuth.mockReturnValue({
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    });
    useCart.mockImplementation(() => ({
      items: cartItems,
      isLoaded: true,
      reconcileCatalog,
    }));
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container.remove();
    jest.clearAllMocks();
  });

  const render = async () => {
    await act(async () => {
      root.render(<CartReconciliationHost />);
      await Promise.resolve();
    });
  };

  test('ошибка IndexedDB не изменяет корзину', async () => {
    indexedDBService.readCartCatalogItems.mockRejectedValue(
      new Error('IDB unavailable')
    );
    await render();
    await act(async () => Promise.resolve());

    expect(reconcileCatalog).not.toHaveBeenCalled();
  });

  test('пустая IDB без подтверждённой версии не изменяет корзину', async () => {
    indexedDBService.readCartCatalogItems.mockResolvedValue({
      version: '',
      results: [],
    });
    await render();
    await act(async () => Promise.resolve());

    expect(reconcileCatalog).not.toHaveBeenCalled();
  });

  test('медленная старая сверка не перезаписывает новую', async () => {
    const oldRead = deferred();
    const newRead = deferred();
    indexedDBService.readCartCatalogItems
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(newRead.promise);
    await render();

    catalogSnapshotVersion = '2026-08-23T11:00:00Z';
    await act(async () => {
      root.render(<CartReconciliationHost />);
      await Promise.resolve();
    });

    const latest = {
      version: '2026-08-23T11:00:00Z',
      results: [],
    };
    await act(async () => {
      newRead.resolve(latest);
      await newRead.promise;
    });
    await act(async () => {
      oldRead.resolve({
        version: '2026-08-23T10:00:00Z',
        results: [],
      });
      await oldRead.promise;
    });

    expect(reconcileCatalog).toHaveBeenCalledTimes(1);
    expect(reconcileCatalog).toHaveBeenCalledWith(latest);
  });

  test('смена catalogSnapshotVersion запускает новое чтение', async () => {
    indexedDBService.readCartCatalogItems.mockResolvedValue({
      version: '2026-08-23T10:00:00Z',
      results: [],
    });
    await render();
    await act(async () => Promise.resolve());

    catalogSnapshotVersion = '2026-08-23T11:00:00Z';
    indexedDBService.readCartCatalogItems.mockResolvedValue({
      version: '2026-08-23T11:00:00Z',
      results: [],
    });
    await act(async () => {
      root.render(<CartReconciliationHost />);
      await Promise.resolve();
    });
    await act(async () => Promise.resolve());

    expect(
      indexedDBService.readCartCatalogItems.mock.calls.length
    ).toBeGreaterThanOrEqual(2);
    expect(reconcileCatalog).toHaveBeenCalledWith({
      version: '2026-08-23T11:00:00Z',
      results: [],
    });
  });

  test('не применяет завершившееся чтение после размонтирования', async () => {
    const read = deferred();
    indexedDBService.readCartCatalogItems.mockReturnValue(read.promise);
    await render();

    await act(async () => root.unmount());
    root = null;
    await act(async () => {
      read.resolve({
        version: '2026-08-23T10:00:00Z',
        results: [],
      });
      await read.promise;
    });

    expect(reconcileCatalog).not.toHaveBeenCalled();
  });

  test('не запускается до готового workspace', async () => {
    useAuth.mockReturnValue({
      isWorkspaceReady: false,
      workspace: null,
    });
    await render();

    expect(indexedDBService.readCartCatalogItems).not.toHaveBeenCalled();
  });

  test('игнорирует чтение старого workspace после переключения', async () => {
    const oldRead = deferred();
    indexedDBService.readCartCatalogItems.mockReturnValue(oldRead.promise);
    await render();

    useAuth.mockReturnValue({
      isWorkspaceReady: true,
      workspace: { accountId: 'account-b', storeId: 'store-b' },
    });
    cartItems = [];
    await act(async () => {
      root.render(<CartReconciliationHost />);
      await Promise.resolve();
    });

    await act(async () => {
      oldRead.resolve({
        version: '2026-08-23T10:00:00Z',
        results: [],
      });
      await oldRead.promise;
    });

    expect(reconcileCatalog).not.toHaveBeenCalled();
  });

  test('повторяет чтение, если набор строк изменился во время транзакции', async () => {
    const firstRead = deferred();
    const secondRead = deferred();
    indexedDBService.readCartCatalogItems
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);
    await render();

    cartItems = [
      ...cartItems,
      {
        key: 'discs:item-2',
        category: 'discs',
        id: 'item-2',
        quantity: 1,
      },
    ];
    await act(async () => {
      root.render(<CartReconciliationHost />);
      await Promise.resolve();
    });

    await act(async () => {
      firstRead.resolve({
        version: '2026-08-23T10:00:00Z',
        results: [],
      });
      await firstRead.promise;
    });
    const latest = {
      version: '2026-08-23T10:00:00Z',
      results: [],
    };
    await act(async () => {
      secondRead.resolve(latest);
      await secondRead.promise;
    });

    expect(indexedDBService.readCartCatalogItems).toHaveBeenCalledTimes(2);
    expect(indexedDBService.readCartCatalogItems.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requestKey: 'discs:item-2' }),
      ])
    );
    expect(reconcileCatalog).toHaveBeenCalledWith(latest);
  });
});
