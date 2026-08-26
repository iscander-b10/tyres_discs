import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppShellProvider, useAppShell } from './AppShellContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/indexedDBService', () => ({
  __esModule: true,
  default: {
    setActiveStore: jest.fn(),
    invalidateActiveStore: jest.fn(),
  },
}));
jest.mock('../services/catalogSync/catalogSyncChannel', () => ({
  subscribeCatalogApplied: jest.fn(() => () => {}),
}));

function Probe({ onChange }) {
  const shell = useAppShell();
  React.useEffect(() => {
    onChange(shell);
  }, [onChange, shell]);
  return null;
}

describe('AppShell catalog bootstrap', () => {
  let container;
  let root;
  let auth;
  let shell;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    shell = null;
    auth = {
      isAuthenticated: true,
      isReady: true,
      isWorkspaceReady: true,
      workspace: { accountId: 'account-a', storeId: 'store-a' },
    };
    useAuth.mockImplementation(() => auth);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const renderShell = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AppShellProvider>
            <Probe onChange={(next) => { shell = next; }} />
          </AppShellProvider>
        </MemoryRouter>
      );
    });
  };

  test('публикует idle bootstrap до проверки каталога', async () => {
    auth.isWorkspaceReady = false;
    auth.workspace = null;
    await renderShell();

    expect(shell.catalogBootstrapPhase).toBe('idle');
    expect(typeof shell.setCatalogBootstrap).toBe('function');
    expect(typeof shell.retryCatalogBootstrap).toBe('function');
    expect(typeof shell.registerCatalogBootstrapRetry).toBe('function');
  });

  test('setCatalogBootstrap обновляет Context и шторку', async () => {
    await renderShell();

    await act(async () => {
      shell.setCatalogBootstrap({
        phase: 'blocking',
        progress: 42,
        label: 'Загружаем каталог шин и дисков',
      });
    });

    expect(shell.catalogBootstrapPhase).toBe('blocking');
    expect(shell.catalogBootstrap).toBeUndefined();
    expect(
      document.querySelector('[data-testid="catalog-bootstrap-overlay"]')
    ).not.toBeNull();
    expect(document.body.textContent).toContain('42%');
  });

  test('смена workspace сбрасывает bootstrap в idle', async () => {
    await renderShell();
    await act(async () => {
      shell.setCatalogBootstrap({
        phase: 'error',
        progress: 18,
        label: '',
        error: 'Нет сети. Проверьте подключение.',
      });
    });
    expect(shell.catalogBootstrapPhase).toBe('error');

    auth = {
      ...auth,
      workspace: { accountId: 'account-b', storeId: 'store-b' },
    };
    await renderShell();

    expect(shell.catalogBootstrapPhase).toBe('idle');
    expect(
      document.querySelector('[data-testid="catalog-bootstrap-overlay"]')
    ).toBeNull();
  });

  test('retry вызывает зарегистрированный callback', async () => {
    await renderShell();
    const retry = jest.fn();
    let unregister;
    await act(async () => {
      unregister = shell.registerCatalogBootstrapRetry(retry);
    });
    await act(async () => {
      shell.retryCatalogBootstrap();
    });
    expect(retry).toHaveBeenCalledTimes(1);
    unregister();
    await act(async () => {
      shell.retryCatalogBootstrap();
    });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('прогресс шторки не меняет identity AppShell context', async () => {
    let renders = 0;
    function Consumer() {
      useAppShell();
      renders += 1;
      return null;
    }

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AppShellProvider>
            <Probe onChange={(next) => { shell = next; }} />
            <Consumer />
          </AppShellProvider>
        </MemoryRouter>
      );
    });
    const afterMount = renders;

    await act(async () => {
      shell.setCatalogBootstrap({
        phase: 'blocking',
        progress: 10,
        label: 'Загружаем каталог шин и дисков',
      });
    });
    const afterPhase = renders;
    expect(afterPhase).toBeGreaterThan(afterMount);

    await act(async () => {
      shell.setCatalogBootstrap({
        phase: 'blocking',
        progress: 55,
        label: 'Загружаем каталог шин и дисков',
      });
    });
    expect(renders).toBe(afterPhase);
    expect(
      document.querySelector('[data-testid="catalog-bootstrap-overlay"]')
    ).not.toBeNull();
    expect(document.body.textContent).toContain('55%');
  });
});
