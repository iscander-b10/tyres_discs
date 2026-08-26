import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import SiteFooter from './SiteFooter';

jest.mock('../../app/AppShellContext', () => ({ useAppShell: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../icons/Phone.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Telegram.svg', () => ({ ReactComponent: () => null }));
jest.mock('../shared/HoverTooltip', () => ({ children }) => children);

describe('SiteFooter demo account', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useAppShell.mockReturnValue({ handleBrandClick: jest.fn() });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test('на / гость видит Войти', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <SiteFooter />
        </MemoryRouter>
      );
    });
    expect(container.textContent).toContain('Войти');
  });

  test('на /demo* нет Войти и Выйти', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/demo/tyres']}>
          <SiteFooter />
        </MemoryRouter>
      );
    });
    expect(container.textContent).not.toContain('Войти');
    expect(container.textContent).not.toContain('Выйти');
  });
});
