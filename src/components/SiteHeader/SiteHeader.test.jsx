import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import { useCart } from '../../cart/CartContext';
import SiteHeader from './SiteHeader';

let mockLocationPathname = '/';

jest.mock('../../app/AppShellContext', () => ({ useAppShell: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../auth/useLogout', () => ({ useLogout: () => jest.fn() }));
jest.mock('../../cart/CartContext', () => ({ useCart: jest.fn() }));
jest.mock('react-router-dom', () => ({
  Link: ({ children }) => children,
  NavLink: ({ children, className, 'aria-label': ariaLabel }) => {
    const ReactModule = require('react');
    return ReactModule.createElement(
      'a',
      {
        className:
          typeof className === 'function'
            ? className({ isActive: false })
            : className,
        'aria-label': ariaLabel,
      },
      children
    );
  },
  useLocation: () => ({ pathname: mockLocationPathname, search: '' }),
}));
jest.mock('@ant-design/icons', () => ({
  ShoppingCartOutlined: () => null,
}));
jest.mock('../../icons/Phone.svg', () => ({
  ReactComponent: () => null,
}));
jest.mock('../../icons/User.svg', () => ({
  ReactComponent: () => null,
}));
jest.mock('../shared/HoverTooltip', () => ({ children }) => children);
jest.mock('../shared/ThemeSwitch/ThemeSwitch', () => () => null);

describe('SiteHeader cart badge', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockLocationPathname = '/';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useAppShell.mockReturnValue({ handleBrandClick: jest.fn() });
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isWorkspaceReady: true,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const render = async () => {
    await act(async () => {
      root.render(<SiteHeader />);
    });
  };

  test('скрывает количество до загрузки cart namespace', async () => {
    useCart.mockReturnValue({ isLoaded: false, totalQuantity: 7 });
    await render();

    expect(container.querySelector('.site-header__cart-badge')).toBeNull();
    expect(
      container.querySelector('[aria-label="Корзина"]')
    ).not.toBeNull();
  });

  test('показывает количество только для готового workspace', async () => {
    useCart.mockReturnValue({ isLoaded: true, totalQuantity: 7 });
    await render();

    expect(container.querySelector('.site-header__cart-badge')?.textContent).toBe(
      '7'
    );
    expect(container.querySelector('[aria-label="Корзина, 7"]')).not.toBeNull();
  });
});

describe('SiteHeader auth actions', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockLocationPathname = '/';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useAppShell.mockReturnValue({ handleBrandClick: jest.fn() });
    useCart.mockReturnValue({ isLoaded: true, totalQuantity: 0 });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const render = async () => {
    await act(async () => {
      root.render(<SiteHeader />);
    });
  };

  test('на / гость видит Войти', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isWorkspaceReady: false,
    });
    await render();
    expect(container.querySelector('[aria-label="Войти"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Выйти"]')).toBeNull();
  });

  test('на /demo* нет Войти и Выйти', async () => {
    mockLocationPathname = '/demo/tyres';
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isWorkspaceReady: true,
    });
    await render();
    expect(container.querySelector('[aria-label="Войти"]')).toBeNull();
    expect(container.querySelector('[aria-label="Выйти"]')).toBeNull();
  });

  test('сотрудник на /demo* тоже без Выйти', async () => {
    mockLocationPathname = '/demo/wheels';
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isWorkspaceReady: true,
    });
    await render();
    expect(container.querySelector('[aria-label="Войти"]')).toBeNull();
    expect(container.querySelector('[aria-label="Выйти"]')).toBeNull();
  });
});

describe('SiteHeader phone', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockLocationPathname = '/';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useAppShell.mockReturnValue({ handleBrandClick: jest.fn() });
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isWorkspaceReady: false,
    });
    useCart.mockReturnValue({ isLoaded: true, totalQuantity: 0 });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test('ссылка телефона сохраняет номер в accessible name', async () => {
    await act(async () => {
      root.render(<SiteHeader />);
    });

    const phone = container.querySelector('.site-header__phone');
    expect(phone.getAttribute('href')).toBe('tel:+78002508850');
    expect(phone.getAttribute('aria-label')).toBe('8 800 250 88 50');
    expect(
      container.querySelector('.site-header__phone-text')?.textContent
    ).toBe('8 800 250 88 50');
  });
});
