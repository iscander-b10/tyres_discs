import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { AppShellProvider } from '../../app/AppShellContext';
import indexedDBService from '../../services/indexedDBService';
import TiresSearchParameters from './TiresSearchParameters';

/**
 * Моки: indexedDBService, useAppShell, showcase/list.
 * Реально: TiresSearchParameters + antd Form + searchRequestId guard.
 * Риск: P1 — поздний ответ старого поиска перетирает новый.
 */

jest.mock('../../app/AppShellContext', () => {
  const React = require('react');
  const ShellContext = React.createContext(null);
  return {
    useAppShell: () => React.useContext(ShellContext),
    AppShellProvider: ShellContext.Provider,
  };
});
jest.mock('../../services/indexedDBService', () => ({
  __esModule: true,
  default: {
    getAvailableParameterOptions: jest.fn(),
    searchTires: jest.fn(),
  },
}));
jest.mock('../shared/CatalogShowcase', () => () => (
  <div data-testid="tires-showcase" />
));
jest.mock('../shared/CatalogShowcase/CatalogSearchEmptyHint', () => () => null);
jest.mock('../shared/PaginatedCardsList/PaginatedCardsList', () => ({
  __esModule: true,
  default: ({ items, error }) => (
    <>
      {error ? <div data-testid="search-error">{error}</div> : null}
      <ul data-testid="search-results">
        {(items || []).map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </>
  ),
}));
jest.mock('../shared/HoverTooltip', () => ({ children }) => children);
jest.mock('../shared/CatalogItemCard/CatalogItemCard', () => () => null);
jest.mock('../shared/CatalogItemModalWindow/CatalogItemModalWindow', () => () =>
  null
);
jest.mock('../../icons/Sun.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Snow.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Reset.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Search.svg', () => ({ ReactComponent: () => null }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('TiresSearchParameters search races', () => {
  const shellValue = (catalogDataVersion = 0) => ({
    clientMode: false,
    catalogDataVersion,
    workspaceResetKey: 'store-a',
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    indexedDBService.getAvailableParameterOptions.mockResolvedValue({
      widths: [],
      profiles: [],
      diameters: [],
      brands: [],
      suppliers: [],
    });
    indexedDBService.searchTires.mockReset();
  });

  test('поздний ответ устаревшего searchRequestId игнорируется', async () => {
    const stale = deferred();
    const latest = deferred();
    indexedDBService.searchTires
      .mockResolvedValueOnce([{ id: 'seed', title: 'Seed' }])
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(latest.promise);

    const view = render(
      <AppShellProvider value={shellValue(0)}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', { name: 'Параметры поиска шин' });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText('Seed')).toBeInTheDocument();

    await act(async () => {
      view.rerender(
        <AppShellProvider value={shellValue(1)}>
          <TiresSearchParameters isActive />
        </AppShellProvider>
      );
    });
    expect(indexedDBService.searchTires).toHaveBeenCalledTimes(2);

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(indexedDBService.searchTires).toHaveBeenCalledTimes(3);

    await act(async () => {
      latest.resolve([{ id: 'new', title: 'Новый результат' }]);
      await latest.promise;
    });
    expect(screen.getByText('Новый результат')).toBeInTheDocument();

    await act(async () => {
      stale.resolve([{ id: 'old', title: 'Устаревший результат' }]);
      await stale.promise;
    });

    expect(screen.getByText('Новый результат')).toBeInTheDocument();
    expect(screen.queryByText('Устаревший результат')).not.toBeInTheDocument();
    expect(screen.queryByText('Seed')).not.toBeInTheDocument();
  });

  test('чекбоксы не перезагружают facets', async () => {
    render(
      <AppShellProvider value={shellValue(0)}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', { name: 'Параметры поиска шин' });
    await act(async () => {
      await Promise.resolve();
    });
    const callsAfterMount =
      indexedDBService.getAvailableParameterOptions.mock.calls.length;

    await act(async () => {
      fireEvent.click(within(form).getByRole('checkbox', { name: 'RunFlat' }));
    });
    await act(async () => {
      fireEvent.click(within(form).getByRole('checkbox', { name: 'от 4 шт' }));
    });

    expect(
      indexedDBService.getAvailableParameterOptions.mock.calls.length
    ).toBe(callsAfterMount);
  });

  test('StaleCatalogStoreError гасит кнопку Найти и не показывает ошибку', async () => {
    const staleError = Object.assign(new Error('stale store'), {
      name: 'StaleCatalogStoreError',
    });
    indexedDBService.searchTires
      .mockResolvedValueOnce([{ id: 'seed', title: 'Seed' }])
      .mockRejectedValueOnce(staleError);

    render(
      <AppShellProvider value={shellValue(0)}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', { name: 'Параметры поиска шин' });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText('Seed')).toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.queryByTestId('search-error')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
  });

  test('сброс во время in-flight поиска гасит spinner, возвращает витрину и игнорирует поздний ответ', async () => {
    const pending = deferred();
    indexedDBService.searchTires.mockReturnValueOnce(pending.promise);

    render(
      <AppShellProvider value={shellValue(0)}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', { name: 'Параметры поиска шин' });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByRole('button', { name: 'Найти' })).toHaveClass(
      'ant-btn-loading'
    );
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-search-status')).toBeInTheDocument();
    expect(indexedDBService.searchTires).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    });

    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();
    expect(indexedDBService.searchTires).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve([{ id: 'late', title: 'Поздний результат' }]);
      await pending.promise;
    });

    expect(screen.queryByText('Поздний результат')).not.toBeInTheDocument();
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
    expect(indexedDBService.searchTires).toHaveBeenCalledTimes(1);
  });

  test('пока «Найти» pending, витрина и статус остаются; после resolve — список без spinner', async () => {
    const pending = deferred();
    indexedDBService.searchTires.mockReturnValueOnce(pending.promise);

    render(
      <AppShellProvider value={shellValue(0)}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', { name: 'Параметры поиска шин' });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-search-status')).toBeInTheDocument();
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve([{ id: 'hit', title: 'Найденная шина' }]);
      await pending.promise;
    });

    expect(screen.getByText('Найденная шина')).toBeInTheDocument();
    expect(screen.queryByTestId('tires-showcase')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-search-status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
  });

  test('зависший searchTires: timeout гасит spinner и показывает ошибку', async () => {
    render(
      <AppShellProvider value={shellValue(0)}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', { name: 'Параметры поиска шин' });
    await act(async () => {
      await Promise.resolve();
    });

    indexedDBService.searchTires.mockReturnValueOnce(new Promise(() => {}));
    jest.useFakeTimers();
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByRole('button', { name: 'Найти' })).toHaveClass(
      'ant-btn-loading'
    );

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(screen.getByTestId('search-error')).toHaveTextContent(
      'Каталог не отвечает'
    );
    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
