import { act, fireEvent, render, screen } from '@testing-library/react';
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
  default: ({ items }) => (
    <ul data-testid="search-results">
      {(items || []).map((item) => (
        <li key={item.id}>{item.title}</li>
      ))}
    </ul>
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
});
