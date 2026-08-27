import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import React from 'react';
import { AppShellProvider } from '../../app/AppShellContext';
import indexedDBService from '../../services/indexedDBService';
import {
  CATALOG_SEARCH_LAYOUT,
  useCatalogSearchFormLayout,
} from '../shared/useCatalogSearchFormLayout';
import { CATALOG_SELECT_DROPDOWN_CLASS } from '../shared/catalogSelectPopupScrollLock';
import TiresSearchParameters from './TiresSearchParameters';

/**
 * Моки: indexedDBService, useAppShell, layout, showcase/list.
 * Реально: TiresSearchParameters + antd Form + CatalogBrandFilterControl.
 * Риск: P2 — stacked/sidebar бренд открывает combobox+клавиатуру и сабмитит «Найти».
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

const lastSearchFilters = () =>
  indexedDBService.searchTires.mock.calls.at(-1)?.[0];

const visibleBrandDropdown = () =>
  document.querySelector(
    `.${CATALOG_SELECT_DROPDOWN_CLASS}:not(.ant-select-dropdown-hidden)`
  );

const getBrandSelector = (root = document) => {
  const combobox = within(root === document ? document.body : root).getByRole(
    'combobox',
    { name: 'Бренд' }
  );
  return combobox.closest('.ant-select').querySelector('.ant-select-selector');
};

const openBrandTrigger = async (root) => {
  fireEvent.mouseDown(getBrandSelector(root));
  return screen.findByRole('button', { name: 'Готово' });
};

const renderTiresSearch = async ({ isActive = true } = {}) => {
  const view = render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <AppShellProvider value={shellValue}>
        <TiresSearchParameters isActive={isActive} />
      </AppShellProvider>
    </ConfigProvider>
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

describe('TiresSearchParameters brand filter', () => {
  jest.setTimeout(20000);
  beforeEach(() => {
    useCatalogSearchFormLayout.mockReturnValue(CATALOG_SEARCH_LAYOUT.STACKED);
    indexedDBService.getAvailableParameterOptions.mockResolvedValue({
      widths: [],
      profiles: [],
      diameters: [],
      brands: ['Michelin', 'Ikon', 'Nokian'],
      suppliers: [],
    });
    indexedDBService.searchTires.mockResolvedValue([]);
  });

  test.each([
    CATALOG_SEARCH_LAYOUT.STACKED,
    CATALOG_SEARCH_LAYOUT.SIDEBAR,
  ])('%s: тап по бренду открывает sheet, без catalog-select dropdown', async (layout) => {
    useCatalogSearchFormLayout.mockReturnValue(layout);
    await renderTiresSearch();

    await openBrandTrigger();

    expect(screen.getByRole('button', { name: 'Готово' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Michelin' })).toBeInTheDocument();
    expect(visibleBrandDropdown()).toBeNull();
    expect(document.querySelector(`.${CATALOG_SELECT_DROPDOWN_CLASS}`)).toBeNull();
  });

  test('чекбокс пишет Form brand как array', async () => {
    const { form } = await renderTiresSearch();
    await openBrandTrigger();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Michelin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));

    expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(lastSearchFilters()).toEqual(
        expect.objectContaining({ brand: ['Michelin'] })
      );
    });
  });

  test('«Готово» закрывает sheet и не вызывает handleSearch', async () => {
    await renderTiresSearch();
    await openBrandTrigger();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ikon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));

    expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();
    expect(indexedDBService.searchTires).not.toHaveBeenCalled();
  });

  test('Enter в поиске шита не сабмитит форму', async () => {
    await renderTiresSearch();
    await openBrandTrigger();

    const searchInput = screen.getByRole('searchbox', { name: 'Поиск бренда' });
    fireEvent.change(searchInput, { target: { value: 'mic' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(indexedDBService.searchTires).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Готово' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Michelin' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Ikon' })).not.toBeInTheDocument();
  });

  test('clear на trigger чистит значение без открытия sheet', async () => {
    const { form } = await renderTiresSearch();
    await openBrandTrigger();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nokian' }));
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();

    const clear = document.querySelector('.form-item-brand .ant-select-clear');
    expect(clear).toBeTruthy();
    fireEvent.mouseDown(clear);
    fireEvent.click(clear);

    expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(form);
    });
    await waitFor(() => {
      expect(indexedDBService.searchTires).toHaveBeenCalled();
    });
    expect(lastSearchFilters().brand || []).toEqual([]);
  });

  test('horizontal: прежний Select dropdown, без кнопки «Готово»', async () => {
    useCatalogSearchFormLayout.mockReturnValue(
      CATALOG_SEARCH_LAYOUT.HORIZONTAL
    );
    await renderTiresSearch();

    fireEvent.mouseDown(getBrandSelector());

    await waitFor(() => {
      expect(visibleBrandDropdown()).not.toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();
    expect(visibleBrandDropdown().textContent).toContain('Michelin');
  });

  test('dual-mount/inert: sheet не с скрытой панели', async () => {
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <AppShellProvider value={shellValue}>
          <div hidden inert data-testid="hidden-tires-panel">
            <TiresSearchParameters isActive={false} />
          </div>
          <div data-testid="active-tires-panel">
            <TiresSearchParameters isActive />
          </div>
        </AppShellProvider>
      </ConfigProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const activePanel = screen.getByTestId('active-tires-panel');
    const activeTrigger = within(activePanel).queryByRole('button', {
      name: 'Фильтры',
    });
    if (activeTrigger) {
      fireEvent.click(activeTrigger);
    }

    const hiddenPanel = screen.getByTestId('hidden-tires-panel');
    fireEvent.mouseDown(
      hiddenPanel.querySelector('.form-item-brand .ant-select-selector')
    );
    expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();
    expect(document.querySelector('.catalog-brand-sheet')).toBeNull();

    await openBrandTrigger(activePanel);
    expect(document.querySelectorAll('.catalog-brand-sheet')).toHaveLength(1);
  });
});
