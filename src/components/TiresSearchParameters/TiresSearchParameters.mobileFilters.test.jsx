import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AppShellProvider } from '../../app/AppShellContext';
import indexedDBService from '../../services/indexedDBService';
import {
  CATALOG_SEARCH_LAYOUT,
  useCatalogSearchFormLayout,
} from '../shared/useCatalogSearchFormLayout';
import TiresSearchParameters from './TiresSearchParameters';

/**
 * Моки: indexedDBService, useAppShell, layout, showcase/list.
 * Реально: TiresSearchParameters + CatalogMobileFiltersPanel + antd Form.
 * Риск: P2 — stacked снова показывает форму всегда или «Найти» скроллит к каталогу.
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
jest.mock('../shared/useCatalogSearchFormLayout', () => {
  const actual = jest.requireActual('../shared/useCatalogSearchFormLayout');
  return {
    ...actual,
    useCatalogSearchFormLayout: jest.fn(),
  };
});
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
jest.mock('../../icons/Filters.svg', () => ({ ReactComponent: () => null }));

const shellValue = (catalogDataVersion = 0) => ({
  clientMode: false,
  catalogDataVersion,
  workspaceResetKey: 'store-a',
});

const openStackedFilters = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
  return screen.findByRole('form', { name: 'Параметры поиска шин' });
};

describe('TiresSearchParameters stacked mobile filters', () => {
  beforeEach(() => {
    useCatalogSearchFormLayout.mockReturnValue(CATALOG_SEARCH_LAYOUT.STACKED);
    indexedDBService.getAvailableParameterOptions.mockResolvedValue({
      widths: [],
      profiles: [],
      diameters: [],
      brands: [],
      suppliers: [],
    });
    indexedDBService.searchTires.mockResolvedValue([
      { id: 't1', title: 'Найденная шина' },
    ]);
  });

  test('idle: кнопка «Фильтры», нет полей формы, витрина видна', async () => {
    render(
      <AppShellProvider value={shellValue()}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );

    expect(await screen.findByRole('button', { name: 'Фильтры' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(
      screen.queryByRole('form', { name: 'Параметры поиска шин' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('tires-showcase')).toBeVisible();
  });

  test('открытие: форма есть, каталог скрыт', async () => {
    render(
      <AppShellProvider value={shellValue()}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    await screen.findByRole('button', { name: 'Фильтры' });
    await openStackedFilters();

    expect(
      screen.getByRole('form', { name: 'Параметры поиска шин' })
    ).toBeVisible();
    expect(screen.getByTestId('tires-showcase')).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument();
  });

  test('«Найти» закрывает форму, оставляет «Фильтры» и показывает результаты', async () => {
    render(
      <AppShellProvider value={shellValue()}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await openStackedFilters();

    await act(async () => {
      fireEvent.submit(form);
    });

    await screen.findByText('Найденная шина');
    expect(
      screen.queryByRole('form', { name: 'Параметры поиска шин' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Фильтры' })).toBeInTheDocument();
    expect(screen.queryByTestId('tires-showcase')).not.toBeInTheDocument();
  });

  test('«Сбросить» при открытой форме не закрывает её', async () => {
    render(
      <AppShellProvider value={shellValue()}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    await openStackedFilters();

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));

    expect(
      screen.getByRole('form', { name: 'Параметры поиска шин' })
    ).toBeVisible();
    expect(screen.getByTestId('tires-showcase')).not.toBeVisible();
  });

  test('background search не тогглит панель', async () => {
    const view = render(
      <AppShellProvider value={shellValue(0)}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );
    const form = await openStackedFilters();
    await act(async () => {
      fireEvent.submit(form);
    });
    await screen.findByText('Найденная шина');

    await openStackedFilters();
    expect(
      screen.getByRole('form', { name: 'Параметры поиска шин' })
    ).toBeVisible();
    const searchCallsAfterFind = indexedDBService.searchTires.mock.calls.length;

    await act(async () => {
      view.rerender(
        <AppShellProvider value={shellValue(1)}>
          <TiresSearchParameters isActive />
        </AppShellProvider>
      );
    });

    await waitFor(() => {
      expect(indexedDBService.searchTires.mock.calls.length).toBeGreaterThan(
        searchCallsAfterFind
      );
    });
    expect(
      screen.getByRole('form', { name: 'Параметры поиска шин' })
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument();
  });

  test.each([
    CATALOG_SEARCH_LAYOUT.SIDEBAR,
    CATALOG_SEARCH_LAYOUT.HORIZONTAL,
  ])('%s: без кнопки «Фильтры», форма видна', async (layout) => {
    useCatalogSearchFormLayout.mockReturnValue(layout);
    render(
      <AppShellProvider value={shellValue()}>
        <TiresSearchParameters isActive />
      </AppShellProvider>
    );

    expect(
      await screen.findByRole('form', { name: 'Параметры поиска шин' })
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument();
    expect(screen.getByTestId('tires-showcase')).toBeVisible();
  });
});
