import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
 * Реально: TiresSearchParameters + antd Form + spikes Select/Radio mapping.
 * Риск: P2 — vertical Radio.Group не мапит yes/no/all в true/false/null.
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
jest.mock('../shared/PaginatedCardsList/PaginatedCardsList', () => () => null);
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

const shellValue = {
  clientMode: false,
  catalogDataVersion: 0,
  workspaceResetKey: 'store-a',
};

const clickVisibleRadio = (label) => {
  fireEvent.click(screen.getByText(label).closest('label'));
};

const clickSpikesOption = (label) => {
  const group = screen.getByRole('radiogroup', { name: 'Шипы' });
  fireEvent.click(within(group).getByText(label).closest('label'));
};

const lastSearchFilters = () =>
  indexedDBService.searchTires.mock.calls.at(-1)?.[0];

const renderTiresSearch = async () => {
  const view = render(
    <AppShellProvider value={shellValue}>
      <TiresSearchParameters isActive />
    </AppShellProvider>
  );
  const filtersTrigger = screen.queryByRole('button', { name: 'Фильтры' });
  if (filtersTrigger) {
    fireEvent.click(filtersTrigger);
  }
  const form = await screen.findByRole('form', { name: 'Параметры поиска шин' });
  await act(async () => {
    await Promise.resolve();
  });
  return { view, form };
};

describe('TiresSearchParameters spikes control', () => {
  beforeEach(() => {
    useCatalogSearchFormLayout.mockReturnValue(CATALOG_SEARCH_LAYOUT.STACKED);
    indexedDBService.getAvailableParameterOptions.mockResolvedValue({
      widths: [],
      profiles: [],
      diameters: [],
      brands: [],
      suppliers: [],
    });
    indexedDBService.searchTires.mockResolvedValue([]);
  });

  test('sidebar/stacked: зимние шипы — Radio.Group Все / Шипы / Без шипов', async () => {
    await renderTiresSearch();
    clickVisibleRadio('Зимние');

    const spikesGroup = screen.getByRole('radiogroup', { name: 'Шипы' });
    expect(spikesGroup).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Шипы' })).not.toBeInTheDocument();
    expect(spikesGroup).toHaveTextContent('Все');
    expect(spikesGroup).toHaveTextContent('Шипы');
    expect(spikesGroup).toHaveTextContent('Без шипов');
  });

  test('stacked: «Шипы» уходит в searchTires как true', async () => {
    const { form } = await renderTiresSearch();
    clickVisibleRadio('Зимние');
    clickSpikesOption('Шипы');

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(lastSearchFilters()).toEqual(expect.objectContaining({ spikes: true }));
    });
  });

  test('stacked: «Без шипов» уходит в searchTires как false', async () => {
    const { form } = await renderTiresSearch();
    clickVisibleRadio('Зимние');
    clickSpikesOption('Без шипов');

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(lastSearchFilters()).toEqual(
        expect.objectContaining({ spikes: false })
      );
    });
  });

  test('stacked: «Все» не передаёт ключ spikes', async () => {
    const { form } = await renderTiresSearch();
    clickVisibleRadio('Зимние');
    clickSpikesOption('Шипы');
    clickSpikesOption('Все');

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(lastSearchFilters()).not.toHaveProperty('spikes');
    });
  });

  test('horizontal: зимние шипы остаются Select', async () => {
    useCatalogSearchFormLayout.mockReturnValue(
      CATALOG_SEARCH_LAYOUT.HORIZONTAL
    );
    await renderTiresSearch();
    clickVisibleRadio('Зимние');

    expect(screen.getByRole('combobox', { name: 'Шипы' })).toBeInTheDocument();
    expect(
      screen.queryByRole('radiogroup', { name: 'Шипы' })
    ).not.toBeInTheDocument();
  });
});
