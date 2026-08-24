import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { AppShellProvider } from '../../app/AppShellContext';
import indexedDBService from '../../services/indexedDBService';
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

describe('DiscsSearchParameters search races', () => {
  const shellValue = (catalogDataVersion = 0) => ({
    clientMode: false,
    catalogDataVersion,
    workspaceResetKey: 'store-a',
  });

  beforeEach(() => {
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
    expect(screen.getByText('Новый диск')).toBeInTheDocument();

    await act(async () => {
      stale.resolve([{ id: 'old-disc', title: 'Устаревший диск' }]);
      await stale.promise;
    });

    expect(screen.getByText('Новый диск')).toBeInTheDocument();
    expect(screen.queryByText('Устаревший диск')).not.toBeInTheDocument();
    expect(screen.queryByText('Seed диск')).not.toBeInTheDocument();
  });
});
