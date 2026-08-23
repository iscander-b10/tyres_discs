import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CartProvider, useCart } from './CartContext';

function Probe({ onReady }) {
  const cart = useCart();
  React.useEffect(() => {
    onReady(cart);
  }, [cart, onReady]);
  return null;
}

async function mountCart() {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let api = null;
  const onReady = (cart) => {
    api = cart;
  };

  await act(async () => {
    root.render(
      <CartProvider>
        <Probe onReady={onReady} />
      </CartProvider>
    );
  });

  return {
    get api() {
      return api;
    },
    async rerenderWait() {
      await act(async () => {
        await Promise.resolve();
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('CartContext sellability guard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('прямой вызов addItem не обходит sellability-проверку без цены', async () => {
    const harness = await mountCart();
    let added;
    await act(async () => {
      added = harness.api.addItem(
        {
          id: 'no-price',
          amount: 5,
          sellingPrice: null,
          price: null,
          title: 'Без цены',
        },
        'tyres'
      );
    });
    expect(added).toBe(false);
    expect(harness.api.items).toHaveLength(0);
    await harness.unmount();
  });

  test('прямой вызов addItem отклоняет amount = 0', async () => {
    const harness = await mountCart();
    let added;
    await act(async () => {
      added = harness.api.addItem(
        {
          id: 'zero-stock',
          amount: 0,
          sellingPrice: 1000,
          price: 900,
        },
        'tyres'
      );
    });
    expect(added).toBe(false);
    expect(harness.api.items).toHaveLength(0);
    await harness.unmount();
  });

  test('валидный товар добавляется', async () => {
    const harness = await mountCart();
    let added;
    await act(async () => {
      added = harness.api.addItem(
        {
          id: 'ok-item',
          amount: 4,
          sellingPrice: 1200,
          price: 1000,
          title: 'OK',
        },
        'tyres'
      );
    });
    await harness.rerenderWait();
    expect(added).toBe(true);
    expect(harness.api.items).toHaveLength(1);
    expect(harness.api.items[0].key).toBe('tyres:ok-item');
    await harness.unmount();
  });

  test('невалидный sellingPrice с валидным price пропускается', async () => {
    const harness = await mountCart();
    let added;
    await act(async () => {
      added = harness.api.addItem(
        {
          id: 'fallback-price',
          amount: 3,
          sellingPrice: 'bad',
          price: 1500,
        },
        'tyres'
      );
    });
    await harness.rerenderWait();
    expect(added).toBe(true);
    expect(harness.api.items).toHaveLength(1);
    await harness.unmount();
  });
});

describe('CartContext reconciliation and persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const item = (overrides = {}) => ({
    id: 'item-1',
    amount: 8,
    sellingPrice: 8000,
    price: 7000,
    title: 'Товар',
    ...overrides,
  });

  const catalogRead = (catalogItem, version = '2026-08-23T10:00:00Z') => ({
    version,
    results: [
      {
        requestKey: 'tyres:item-1',
        matches: { tyres: catalogItem, discs: null },
      },
    ],
  });

  test('reconciliation использует последнее quantity и сохраняет результат', async () => {
    const harness = await mountCart();
    await act(async () => {
      harness.api.addItem(item(), 'tyres', 2);
    });
    await act(async () => {
      harness.api.increment('tyres:item-1');
      harness.api.reconcileCatalog(
        catalogRead(item({ sellingPrice: 9500, title: 'Обновлённый' }))
      );
    });
    await harness.rerenderWait();

    expect(harness.api.items[0]).toMatchObject({
      quantity: 3,
      sellingPrice: 9500,
      title: 'Обновлённый',
    });
    expect(harness.api.totals.selling).toBe(28500);

    const stored = JSON.parse(window.localStorage.getItem('cart.staff.v2'));
    expect(stored.version).toBe(2);
    expect(stored.items[0]).toMatchObject({
      key: 'tyres:item-1',
      quantity: 3,
      sellingPrice: 9500,
    });
    await harness.unmount();
  });

  test('более старая версия не перезаписывает новую', async () => {
    const harness = await mountCart();
    await act(async () => {
      harness.api.addItem(item(), 'tyres', 1);
      harness.api.reconcileCatalog(
        catalogRead(
          item({ sellingPrice: 9500 }),
          '2026-08-23T11:00:00Z'
        )
      );
      harness.api.reconcileCatalog(
        catalogRead(
          item({ sellingPrice: 8100 }),
          '2026-08-23T10:00:00Z'
        )
      );
    });
    await harness.rerenderWait();

    expect(harness.api.items[0].sellingPrice).toBe(9500);
    await harness.unmount();
  });

  test('читает v1 и безопасно мигрирует однозначную legacy-строку', async () => {
    window.localStorage.setItem(
      'cart.staff.v1',
      JSON.stringify([
        {
          ...item(),
          key: 'item-1',
          quantity: 2,
          maxStock: 8,
        },
      ])
    );
    const harness = await mountCart();

    await act(async () => {
      harness.api.reconcileCatalog({
        version: '2026-08-23T10:00:00Z',
        results: [
          {
            requestKey: 'item-1',
            matches: { tyres: item({ sellingPrice: 9500 }), discs: null },
          },
        ],
      });
    });
    await harness.rerenderWait();

    expect(harness.api.items[0]).toMatchObject({
      key: 'tyres:item-1',
      category: 'tyres',
      quantity: 2,
      sellingPrice: 9500,
    });
    await harness.unmount();
  });
});
