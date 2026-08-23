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
      added = harness.api.addItem({
        id: 'no-price',
        amount: 5,
        sellingPrice: null,
        price: null,
        title: 'Без цены',
      });
    });
    expect(added).toBe(false);
    expect(harness.api.items).toHaveLength(0);
    await harness.unmount();
  });

  test('прямой вызов addItem отклоняет amount = 0', async () => {
    const harness = await mountCart();
    let added;
    await act(async () => {
      added = harness.api.addItem({
        id: 'zero-stock',
        amount: 0,
        sellingPrice: 1000,
        price: 900,
      });
    });
    expect(added).toBe(false);
    expect(harness.api.items).toHaveLength(0);
    await harness.unmount();
  });

  test('валидный товар добавляется', async () => {
    const harness = await mountCart();
    let added;
    await act(async () => {
      added = harness.api.addItem({
        id: 'ok-item',
        amount: 4,
        sellingPrice: 1200,
        price: 1000,
        title: 'OK',
      });
    });
    await harness.rerenderWait();
    expect(added).toBe(true);
    expect(harness.api.items).toHaveLength(1);
    expect(harness.api.items[0].key).toBe('ok-item');
    await harness.unmount();
  });

  test('невалидный sellingPrice с валидным price пропускается', async () => {
    const harness = await mountCart();
    let added;
    await act(async () => {
      added = harness.api.addItem({
        id: 'fallback-price',
        amount: 3,
        sellingPrice: 'bad',
        price: 1500,
      });
    });
    await harness.rerenderWait();
    expect(added).toBe(true);
    expect(harness.api.items).toHaveLength(1);
    await harness.unmount();
  });
});
