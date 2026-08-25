import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CartProviderCore, useCart } from '../cart/CartContext';
import { getCartStorageKey } from '../cart/cartStorage';
import indexedDBService from '../services/indexedDBService';
import { useLogout } from './useLogout';

/**
 * Моки: AuthContext, navigate, indexedDBService.invalidateActiveStore, cart sync.
 * Реально: CartProviderCore + useLogout (flush/detach, не clear).
 * Риск: P1 — logout стирает v3 корзины или вызывает clear.
 */

const workspace = {
  accountId: 'account-a',
  login: 'a@example.com',
  storeId: 'store-a',
};

const mockLogout = jest.fn();
const mockNavigate = jest.fn();

jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    workspace,
    isWorkspaceReady: true,
  }),
}));
jest.mock('../services/indexedDBService', () => ({
  __esModule: true,
  default: { invalidateActiveStore: jest.fn() },
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

function Probe({ onReady }) {
  const cart = useCart();
  const executeLogout = useLogout();
  React.useEffect(
    () => onReady({ cart, executeLogout }),
    [cart, executeLogout, onReady]
  );
  return null;
}

describe('useLogout cart policy', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockLogout.mockClear();
    mockNavigate.mockClear();
    indexedDBService.invalidateActiveStore.mockClear();
  });

  test('flush → detach (не clear) → invalidate → logout → navigate; v3 остаётся', async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let api;
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem');

    await act(async () => {
      root.render(
        <CartProviderCore
          workspace={workspace}
          isWorkspaceReady
        >
          <Probe
            onReady={(next) => {
              api = next;
            }}
          />
        </CartProviderCore>
      );
    });

    await act(async () => {
      api.cart.addItem(
        {
          id: 'item-1',
          amount: 8,
          sellingPrice: 8000,
          price: 7000,
          title: 'Товар',
        },
        'tyres',
        2
      );
    });

    const cartKey = getCartStorageKey(workspace.accountId, workspace.storeId);
    expect(JSON.parse(localStorage.getItem(cartKey)).version).toBe(3);

    await act(async () => {
      api.executeLogout();
    });

    expect(indexedDBService.invalidateActiveStore).toHaveBeenCalledWith(
      'store-a'
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    expect(removeItem).not.toHaveBeenCalledWith(cartKey);
    expect(JSON.parse(localStorage.getItem(cartKey))).toMatchObject({
      version: 3,
      items: [expect.objectContaining({ key: 'tyres:item-1', quantity: 2 })],
    });
    expect(api.cart.items).toEqual([]);
    expect(api.cart.isLoaded).toBe(false);

    removeItem.mockRestore();
    await act(async () => root.unmount());
    container.remove();
  });
});
