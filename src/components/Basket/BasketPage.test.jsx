import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import BasketPage from './BasketPage';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import { useCart } from '../../cart/CartContext';

jest.mock('../../app/AppShellContext', () => ({ useAppShell: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../cart/CartContext', () => ({ useCart: jest.fn() }));
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/basket', search: '' }),
}));
jest.mock('../shared/CartQtyControls/CartQtyControls', () => () => null);
jest.mock('../shared/CatalogItemModalWindow/CatalogItemModalWindow', () => () => null);
jest.mock('../shared/CatalogPriceStrip/CatalogPriceStrip', () => () => null);
jest.mock('../shared/HoverTooltip', () => ({ children }) => children);
jest.mock('../../icons/Website.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../utils/fetchSupplier', () => ({
  resolvePhotoUrl: (url) => (url ? String(url) : ''),
}));

const cartItem = {
  key: 'tyre-1',
  title: 'Test Tyre',
  photoUrl: 'https://example.com/tyre.jpg',
  supplier: 'demo',
  quantity: 1,
  category: 'tyres',
  sellingPrice: 5000,
  amount: 4,
};

describe('BasketPage photo', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useAppShell.mockReturnValue({
      clientMode: false,
      continueSelection: jest.fn(),
    });
    useAuth.mockReturnValue({ isWorkspaceReady: true });
    useCart.mockReturnValue({
      items: [cartItem],
      isLoaded: true,
      totals: { quantity: 1, selling: 5000, b2b: 0 },
      increment: jest.fn(),
      decrement: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test('пустой photoUrl: ячейка без img и без via.placeholder.com', async () => {
    useCart.mockReturnValue({
      items: [{ ...cartItem, photoUrl: '' }],
      isLoaded: true,
      totals: { quantity: 1, selling: 5000, b2b: 0 },
      increment: jest.fn(),
      decrement: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    });

    await act(async () => {
      root.render(<BasketPage />);
    });

    expect(container.querySelector('.basket-line__media')).not.toBeNull();
    expect(container.querySelector('.basket-line__image')).toBeNull();
    expect(container.innerHTML).not.toContain('via.placeholder.com');
    expect(container.innerHTML).not.toContain('placeholder.com');
  });

  test('ошибка загрузки: убирает img, не ставит via.placeholder.com', async () => {
    await act(async () => {
      root.render(<BasketPage />);
    });

    const img = container.querySelector('.basket-line__image');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(cartItem.photoUrl);

    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });

    expect(container.querySelector('.basket-line__image')).toBeNull();
    expect(container.innerHTML).not.toContain('via.placeholder.com');
    expect(container.querySelector('.basket-line__media')).not.toBeNull();
  });
});

describe('BasketPage line layout', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useAppShell.mockReturnValue({
      clientMode: false,
      continueSelection: jest.fn(),
    });
    useAuth.mockReturnValue({ isWorkspaceReady: true });
    useCart.mockReturnValue({
      items: [{ ...cartItem, websitePrice: 4000 }],
      isLoaded: true,
      totals: { quantity: 1, selling: 5000, b2b: 0 },
      increment: jest.fn(),
      decrement: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test('суммы — сосед body, не внутри него, чтобы уезжать под фото', async () => {
    await act(async () => {
      root.render(<BasketPage />);
    });

    const line = container.querySelector('.basket-line');
    const body = container.querySelector('.basket-line__body');
    const head = container.querySelector('.basket-line__head');
    const end = container.querySelector('.basket-line__end');
    const prices = container.querySelector('.basket-line__prices-hit');
    const remove = container.querySelector('.basket-line__remove');
    const info = container.querySelector('.basket-line__info');

    expect(line).not.toBeNull();
    expect(body).not.toBeNull();
    expect(head).not.toBeNull();
    expect(end).not.toBeNull();
    expect(end.parentElement).toBe(line);
    expect(body.contains(end)).toBe(false);
    expect(body.contains(prices)).toBe(true);
    expect(head.contains(info)).toBe(true);
    expect(head.contains(remove)).toBe(true);
    expect(container.querySelector('.basket-line__sum-web')).not.toBeNull();
  });
});
