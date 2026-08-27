import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { AppShellProvider } from '../../app/AppShellContext';
import indexedDBService from '../../services/indexedDBService';
import {
  CATALOG_SEARCH_LAYOUT,
  useCatalogSearchFormLayout,
} from '../shared/useCatalogSearchFormLayout';
import DiscsSearchParameters from './DiscsSearchParameters';

/**
 * Моки: indexedDBService, useAppShell, showcase/list.
 * Реально: DiscsSearchParameters + antd Form + searchRequestId guard.
 * Риск: P1 — поздний ответ старого поиска дисков перетирает новый.
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
    getAvailableDiscParameterOptions: jest.fn(),
    searchDiscs: jest.fn(),
  },
}));
jest.mock('../shared/CatalogShowcase', () => () => (
  <div data-testid="discs-showcase" />
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
jest.mock('../shared/useCatalogSearchFormLayout', () => {
  const actual = jest.requireActual('../shared/useCatalogSearchFormLayout');
  return {
    ...actual,
    useCatalogSearchFormLayout: jest.fn(),
  };
});
jest.mock('../../icons/Reset.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Search.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Filters.svg', () => ({ ReactComponent: () => null }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('DiscsSearchParameters search races', () => {
  const shellValue = (catalogDataVersion = 0) => ({
    clientMode: false,
    catalogDataVersion,
    workspaceResetKey: 'store-a',
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    useCatalogSearchFormLayout.mockReturnValue(CATALOG_SEARCH_LAYOUT.SIDEBAR);
    indexedDBService.getAvailableDiscParameterOptions.mockResolvedValue({
      brands: [],
      suppliers: [],
      diameters: [],
      widths: [],
      cb: [],
      et: [],
      pcd: [],
      pn: [],
      diskTypes: [],
    });
    indexedDBService.searchDiscs.mockReset();
  });

  test('поздний ответ устаревшего searchRequestId игнорируется', async () => {
    const stale = deferred();
    const latest = deferred();
    indexedDBService.searchDiscs
      .mockResolvedValueOnce([{ id: 'seed-disc', title: 'Seed диск' }])
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(latest.promise);

    const view = render(
      <AppShellProvider value={shellValue(0)}>
        <DiscsSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText('Seed диск')).toBeInTheDocument();

    await act(async () => {
      view.rerender(
        <AppShellProvider value={shellValue(1)}>
          <DiscsSearchParameters isActive />
        </AppShellProvider>
      );
    });
    expect(indexedDBService.searchDiscs).toHaveBeenCalledTimes(2);

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(indexedDBService.searchDiscs).toHaveBeenCalledTimes(3);

    await act(async () => {
      latest.resolve([{ id: 'new-disc', title: 'Новый диск' }]);
      await latest.promise;
    });
    expect(await screen.findByText('Новый диск')).toBeInTheDocument();

    await act(async () => {
      stale.resolve([{ id: 'old-disc', title: 'Устаревший диск' }]);
      await stale.promise;
    });

    expect(screen.getByText('Новый диск')).toBeInTheDocument();
    expect(screen.queryByText('Устаревший диск')).not.toBeInTheDocument();
    expect(screen.queryByText('Seed диск')).not.toBeInTheDocument();
  });

  test('бренд и чекбокс не перезагружают facets', async () => {
    render(
      <AppShellProvider value={shellValue(0)}>
        <DiscsSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });
    await act(async () => {
      await Promise.resolve();
    });
    const callsAfterMount =
      indexedDBService.getAvailableDiscParameterOptions.mock.calls.length;

    await act(async () => {
      fireEvent.click(within(form).getByRole('checkbox', { name: 'от 4 шт' }));
    });

    expect(
      indexedDBService.getAvailableDiscParameterOptions.mock.calls.length
    ).toBe(callsAfterMount);
  });

  test('StaleCatalogStoreError гасит кнопку Найти и не показывает ошибку', async () => {
    const staleError = Object.assign(new Error('stale store'), {
      name: 'StaleCatalogStoreError',
    });
    indexedDBService.searchDiscs
      .mockResolvedValueOnce([{ id: 'seed-disc', title: 'Seed диск' }])
      .mockRejectedValueOnce(staleError);

    render(
      <AppShellProvider value={shellValue(0)}>
        <DiscsSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText('Seed диск')).toBeInTheDocument();

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
    indexedDBService.searchDiscs.mockReturnValueOnce(pending.promise);

    render(
      <AppShellProvider value={shellValue(0)}>
        <DiscsSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByRole('button', { name: 'Найти' })).toHaveClass(
      'ant-btn-loading'
    );
    expect(screen.getByTestId('discs-showcase')).toBeInTheDocument();
    expect(indexedDBService.searchDiscs).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    });

    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
    expect(screen.getByTestId('discs-showcase')).toBeInTheDocument();
    expect(indexedDBService.searchDiscs).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve([{ id: 'late-disc', title: 'Поздний диск' }]);
      await pending.promise;
    });

    expect(screen.queryByText('Поздний диск')).not.toBeInTheDocument();
    expect(screen.getByTestId('discs-showcase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
    expect(indexedDBService.searchDiscs).toHaveBeenCalledTimes(1);
  });

  test('StrictMode: «Найти» гасит spinner и показывает результаты', async () => {
    indexedDBService.searchDiscs.mockResolvedValue([
      { id: 'strict-disc', title: 'StrictMode диск' },
    ]);

    render(
      <React.StrictMode>
        <AppShellProvider value={shellValue(0)}>
          <DiscsSearchParameters isActive />
        </AppShellProvider>
      </React.StrictMode>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(await screen.findByText('StrictMode диск')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
  });

  test('пока «Найти» pending, витрина остаётся; после resolve — список без spinner', async () => {
    const pending = deferred();
    indexedDBService.searchDiscs.mockReturnValueOnce(pending.promise);

    render(
      <AppShellProvider value={shellValue(0)}>
        <DiscsSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByTestId('discs-showcase')).toBeInTheDocument();
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve([{ id: 'hit-disc', title: 'Найденный диск' }]);
      await pending.promise;
    });

    expect(await screen.findByText('Найденный диск')).toBeInTheDocument();
    expect(screen.queryByTestId('discs-showcase')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Найти' })).not.toHaveClass(
      'ant-btn-loading'
    );
  });

  test('зависший searchDiscs: timeout гасит spinner и показывает ошибку', async () => {
    render(
      <AppShellProvider value={shellValue(0)}>
        <DiscsSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });
    await act(async () => {
      await Promise.resolve();
    });

    indexedDBService.searchDiscs.mockReturnValueOnce(new Promise(() => {}));
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
    expect(screen.getByTestId('discs-showcase')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
