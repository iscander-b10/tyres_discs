import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CartProviderCore, useCart } from './CartContext';
import { createCartEnvelope, getCartStorageKey } from './cartStorage';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const workspaces = {
  a: { accountId: 'account-a', login: 'a@example.com', storeId: 'store-a' },
  b: { accountId: 'account-b', login: 'b@example.com', storeId: 'store-b' },
};

function Probe({ onReady }) {
  const cart = useCart();
  React.useEffect(() => onReady(cart), [cart, onReady]);
  return null;
}

async function mountCart(initial = {}) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let api = null;
  let props = {
    workspace: workspaces.a,
    isWorkspaceReady: true,
    showLegacyMigration: false,
    ...initial,
  };
  const syncInstances = [];
  const syncFactory =
    props.syncFactory ??
    ((options) => {
      const instance = {
        ...options,
        publish: jest.fn(),
        close: jest.fn(),
      };
      syncInstances.push(instance);
      return instance;
    });
  const onReady = (cart) => {
    api = cart;
  };
  const render = () =>
    root.render(
      <CartProviderCore {...props} syncFactory={syncFactory}>
        <Probe onReady={onReady} />
      </CartProviderCore>
    );

  await act(async () => render());
  return {
    get api() {
      return api;
    },
    syncInstances,
    async rerender(nextProps = {}) {
      props = { ...props, ...nextProps };
      await act(async () => render());
    },
    async call(callback) {
      let result;
      await act(async () => {
        result = callback(api);
      });
      return result;
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const item = (overrides = {}) => ({
  id: 'item-1',
  amount: 8,
  sellingPrice: 8000,
  price: 7000,
  title: 'Товар',
  ...overrides,
});

describe('CartContext workspace lifecycle', () => {
  beforeEach(() => window.localStorage.clear());

  test('до готового workspace корзина пуста и не загружена', async () => {
    const harness = await mountCart({
      workspace: null,
      isWorkspaceReady: false,
    });
    expect(harness.api.items).toEqual([]);
    expect(harness.api.isLoaded).toBe(false);
    expect(harness.api.addItem(item(), 'tyres')).toBe(false);
    expect(window.localStorage.length).toBe(0);
    await harness.unmount();
  });

  test('загружает только namespace текущего accountId', async () => {
    const envelopeA = createCartEnvelope({
      items: [{ key: 'tyres:a', quantity: 1 }],
      revision: 2,
      updatedAt: 10,
    });
    const envelopeB = createCartEnvelope({
      items: [{ key: 'discs:b', quantity: 3 }],
      revision: 4,
      updatedAt: 20,
    });
    localStorage.setItem(getCartStorageKey('account-a', 'store-a'), JSON.stringify(envelopeA));
    localStorage.setItem(getCartStorageKey('account-b', 'store-b'), JSON.stringify(envelopeB));

    const harness = await mountCart();
    expect(harness.api.isLoaded).toBe(true);
    expect(harness.api.items[0].key).toBe('tyres:a');

    await harness.rerender({ workspace: workspaces.b });
    expect(harness.api.items).toEqual(envelopeB.items);
    expect(harness.syncInstances[0].close).toHaveBeenCalled();
    await harness.unmount();
  });

  test('повреждённый v3 даёт пустой runtime без legacy fallback', async () => {
    localStorage.setItem(getCartStorageKey('account-a', 'store-a'), '{"version":3');
    localStorage.setItem(
      'cart.staff.v2',
      JSON.stringify({ version: 2, items: [{ key: 'tyres:x', quantity: 1 }] })
    );
    const harness = await mountCart();
    expect(harness.api.isLoaded).toBe(true);
    expect(harness.api.items).toEqual([]);
    await harness.unmount();
  });

  test('detach сохраняет snapshot, инвалидирует callbacks и не удаляет v3', async () => {
    const harness = await mountCart();
    expect(await harness.call((api) => api.addItem(item(), 'tyres', 2))).toBe(true);
    const oldSync = harness.syncInstances[0];
    const snapshot = await harness.call((api) => api.detach());

    expect(snapshot.items[0].quantity).toBe(2);
    expect(harness.api.items).toEqual([]);
    expect(harness.api.isLoaded).toBe(false);
    expect(localStorage.getItem(getCartStorageKey('account-a', 'store-a'))).not.toBeNull();

    await act(async () => {
      oldSync.onEnvelope(
        createCartEnvelope({
          items: [{ key: 'tyres:stale', quantity: 1 }],
          revision: 99,
          updatedAt: 99,
        })
      );
    });
    expect(harness.api.items).toEqual([]);
    await harness.unmount();
  });

  test('clear удаляет persisted v3 и публикует более новую пустую ревизию', async () => {
    const harness = await mountCart();
    await harness.call((api) => api.addItem(item(), 'tyres', 1));
    const revision = JSON.parse(
      localStorage.getItem(getCartStorageKey('account-a', 'store-a'))
    ).revision;

    expect(await harness.call((api) => api.clear())).toBe(true);
    expect(harness.api.items).toEqual([]);
    expect(localStorage.getItem(getCartStorageKey('account-a', 'store-a'))).toBeNull();
    const published =
      harness.syncInstances[0].publish.mock.calls.at(-1)[0];
    expect(published.items).toEqual([]);
    expect(published.revision).toBe(revision + 1);
    await harness.unmount();
  });

  test('старый callback A не меняет корзину B после переключения', async () => {
    const harness = await mountCart();
    const oldSync = harness.syncInstances[0];
    await harness.rerender({ workspace: workspaces.b });
    await act(async () => {
      oldSync.onEnvelope(
        createCartEnvelope({
          items: [{ key: 'tyres:a-only', quantity: 1 }],
          revision: 10,
          updatedAt: 10,
        })
      );
    });
    expect(harness.api.items).toEqual([]);
    await harness.unmount();
  });
});

describe('CartContext mutations and reconciliation', () => {
  beforeEach(() => window.localStorage.clear());

  test('sellability guard и v3 persistence', async () => {
    const harness = await mountCart();
    expect(
      await harness.call((api) =>
        api.addItem(item({ sellingPrice: null, price: null }), 'tyres')
      )
    ).toBe(false);
    expect(await harness.call((api) => api.addItem(item(), 'tyres', 2))).toBe(true);

    const stored = JSON.parse(
      localStorage.getItem(getCartStorageKey('account-a', 'store-a'))
    );
    expect(stored).toMatchObject({ version: 3, revision: 1 });
    expect(stored.items[0]).toMatchObject({
      key: 'tyres:item-1',
      quantity: 2,
    });
    await harness.unmount();
  });

  test('reconciliation обновляет snapshot, а старая версия игнорируется', async () => {
    const harness = await mountCart();
    await harness.call((api) => api.addItem(item(), 'tyres', 2));
    await harness.call((api) =>
      api.reconcileCatalog({
        version: '2026-08-23T11:00:00Z',
        results: [
          {
            requestKey: 'tyres:item-1',
            matches: {
              tyres: item({ sellingPrice: 9500, title: 'Обновлённый' }),
              discs: null,
            },
          },
        ],
      })
    );
    await harness.call((api) =>
      api.reconcileCatalog({
        version: '2026-08-23T10:00:00Z',
        results: [],
      })
    );
    expect(harness.api.items[0]).toMatchObject({
      sellingPrice: 9500,
      title: 'Обновлённый',
      quantity: 2,
    });
    expect(harness.api.totals.selling).toBe(19000);
    await harness.unmount();
  });

  test('ошибка localStorage не меняет runtime и не падает', async () => {
    const failingStorage = {
      getItem: jest.fn(() => {
        throw new Error('blocked');
      }),
      setItem: jest.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: jest.fn(() => {
        throw new Error('blocked');
      }),
    };
    const harness = await mountCart({ storage: failingStorage });
    expect(harness.api.isLoaded).toBe(true);
    expect(await harness.call((api) => api.addItem(item(), 'tyres'))).toBe(false);
    expect(harness.api.items).toEqual([]);
    await harness.unmount();
  });
});
