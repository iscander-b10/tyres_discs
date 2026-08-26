import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './App';
import { useAuth } from './auth/AuthContext';

/**
 * Моки: Auth, AppShell, Cart, тяжёлые страницы каталога.
 * Реально: AppRoutes + MemoryRouter (guards).
 * Риск: P2 — guest/auth routing, basket guard, home→/tyres, login query.
 */

jest.mock('./auth/AuthContext', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }) => children,
}));
jest.mock('./app/AppShellContext', () => ({
  AppShellProvider: ({ children }) => children,
  useAppShell: () => ({
    clientMode: false,
    catalogDataVersion: 0,
    workspaceResetKey: 'guest',
    sessionResetKey: 0,
    catalogSnapshotVersion: '',
    handleBrandClick: jest.fn(),
  }),
}));
jest.mock('./cart/CartContext', () => ({
  CartProvider: ({ children }) => children,
  useCart: () => ({ isLoaded: true, totalQuantity: 0, items: [] }),
}));
jest.mock('./components/TiresSearchParameters/TiresSearchParameters', () => () => (
  <div data-testid="tires-search" />
));
jest.mock('./components/DiscsSearchParameters/DiscsSearchParameters', () => () => (
  <div data-testid="discs-search" />
));
jest.mock('./components/Basket/BasketPage', () => () => (
  <div data-testid="basket-page" />
));
jest.mock('./components/LandingPage/LandingPage', () => () => (
  <div data-testid="landing-page" />
));
jest.mock('./components/LoginPage/LoginPage', () => () => (
  <div data-testid="login-page" />
));
jest.mock('./components/SiteHeader/SiteHeader', () => () => (
  <header>header</header>
));
jest.mock('./components/SiteFooter/SiteFooter', () => () => (
  <footer>footer</footer>
));
jest.mock('./components/ModeToggle/ModeToggle', () => () => null);
jest.mock('./components/ScrollToTop/ScrollToTop', () => () => null);
jest.mock('./components/DemoCatalogBanner/DemoCatalogBanner', () => () => null);
jest.mock('./services/catalogSync/CatalogSyncHost', () => ({
  CatalogSyncHost: () => null,
}));
jest.mock('./cart/CartReconciliationHost', () => ({
  CartReconciliationHost: () => null,
}));
jest.mock('./auth/useLogout', () => ({ useLogout: () => jest.fn() }));

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

const guestAuth = {
  isAuthenticated: false,
  isReady: true,
  isWorkspaceReady: false,
  workspace: null,
};
const staffAuth = {
  isAuthenticated: true,
  isReady: true,
  isWorkspaceReady: true,
  workspace: { accountId: 'account-a', storeId: 'store-a' },
};

const renderRoutes = (initialEntry, auth = guestAuth) => {
  useAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>
  );
};

describe('AppRoutes guards', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('гость на /demo и /demo/tyres видит каталог без login', () => {
    renderRoutes('/demo');
    expect(screen.getByTestId('location')).toHaveTextContent('/demo/tyres');
    expect(screen.getByTestId('tires-search')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  test('гость на /demo/tyres остаётся в каталоге', () => {
    renderRoutes('/demo/tyres');
    expect(screen.getByTestId('location')).toHaveTextContent('/demo/tyres');
    expect(screen.getByTestId('tires-search')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  test('гость на /demo/wheels видит диски', () => {
    renderRoutes('/demo/wheels');
    expect(screen.getByTestId('location')).toHaveTextContent('/demo/wheels');
    expect(screen.getByTestId('discs-search')).toBeInTheDocument();
  });

  test('гость на /demo/basket видит корзину', () => {
    renderRoutes('/demo/basket');
    expect(screen.getByTestId('location')).toHaveTextContent('/demo/basket');
    expect(screen.getByTestId('basket-page')).toBeInTheDocument();
  });

  test('неизвестный /demo/x уходит на /demo/tyres, не на /', () => {
    renderRoutes('/demo/x');
    expect(screen.getByTestId('location')).toHaveTextContent('/demo/tyres');
    expect(screen.getByTestId('tires-search')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  test('гость на /tyres уходит на /?login=1', () => {
    renderRoutes('/tyres');
    expect(screen.getByTestId('location')).toHaveTextContent('/?login=1');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  test('гость на /basket уходит на /', () => {
    renderRoutes('/basket');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.queryByTestId('basket-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  test('авторизованный с / попадает на /tyres', () => {
    renderRoutes('/', staffAuth);
    expect(screen.getByTestId('location')).toHaveTextContent('/tyres');
    expect(screen.getByTestId('tires-search')).toBeInTheDocument();
  });

  test('/login редиректит на /?login=1', () => {
    renderRoutes('/login');
    expect(screen.getByTestId('location')).toHaveTextContent('/?login=1');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  test('авторизованный видит корзину на /basket', () => {
    renderRoutes('/basket', staffAuth);
    expect(screen.getByTestId('location')).toHaveTextContent('/basket');
    expect(screen.getByTestId('basket-page')).toBeInTheDocument();
  });
});
