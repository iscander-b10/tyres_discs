import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import React from 'react';
import { AppShellProvider } from '../../app/AppShellContext';
import indexedDBService from '../../services/indexedDBService';
import {
  CATALOG_SEARCH_LAYOUT,
  useCatalogSearchFormLayout,
} from '../shared/useCatalogSearchFormLayout';
import { CATALOG_SELECT_DROPDOWN_CLASS } from '../shared/catalogSelectPopupScrollLock';
import DiscsSearchParameters from './DiscsSearchParameters';

/**
 * Моки: indexedDBService, useAppShell, layout, showcase/list.
 * Реально: DiscsSearchParameters + shared CatalogBrandFilterControl.
 * Риск: P2 — диски не подключили sheet и остались на combobox.
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
jest.mock('../shared/useCatalogSearchFormLayout', () => {
  const actual = jest.requireActual('../shared/useCatalogSearchFormLayout');
  return {
    ...actual,
    useCatalogSearchFormLayout: jest.fn(),
  };
});
jest.mock('../shared/CatalogShowcase', () => () => (
  <div data-testid="discs-showcase" />
));
jest.mock('../shared/CatalogShowcase/CatalogSearchEmptyHint', () => () => null);
jest.mock('../shared/PaginatedCardsList/PaginatedCardsList', () => () => null);
jest.mock('../shared/HoverTooltip', () => ({ children }) => children);
jest.mock('../shared/CatalogItemCard/CatalogItemCard', () => () => null);
jest.mock('../shared/CatalogItemModalWindow/CatalogItemModalWindow', () => () =>
  null
);
jest.mock('../../icons/Reset.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Search.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../icons/Filters.svg', () => ({ ReactComponent: () => null }));

const shellValue = {
  clientMode: false,
  catalogDataVersion: 0,
  workspaceResetKey: 'store-a',
};

const emptyDiscOptions = {
  brands: ['OZ', 'Enkei'],
  suppliers: [],
  diameters: [],
  widths: [],
  cb: [],
  et: [],
  pcd: [],
  pn: [],
  diskTypes: [],
};

const getBrandSelector = () =>
  screen
    .getByRole('combobox', { name: 'Бренд' })
    .closest('.ant-select')
    .querySelector('.ant-select-selector');

describe('DiscsSearchParameters brand filter', () => {
  jest.setTimeout(20000);
  beforeEach(() => {
    useCatalogSearchFormLayout.mockReturnValue(CATALOG_SEARCH_LAYOUT.STACKED);
    indexedDBService.getAvailableDiscParameterOptions.mockResolvedValue(
      emptyDiscOptions
    );
    indexedDBService.searchDiscs.mockResolvedValue([]);
  });

  test('stacked: тап по бренду открывает sheet, без dropdown', async () => {
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <AppShellProvider value={shellValue}>
          <DiscsSearchParameters isActive />
        </AppShellProvider>
      </ConfigProvider>
    );
    await screen.findByRole('button', { name: 'Фильтры' });
    fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
    await screen.findByRole('form', { name: 'Параметры поиска дисков' });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.mouseDown(getBrandSelector());
    expect(await screen.findByRole('button', { name: 'Готово' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'OZ' })).toBeInTheDocument();
    expect(
      document.querySelector(`.${CATALOG_SELECT_DROPDOWN_CLASS}`)
    ).toBeNull();
  });

  test('sidebar: чекбокс пишет brand, «Готово» не ищет', async () => {
    useCatalogSearchFormLayout.mockReturnValue(CATALOG_SEARCH_LAYOUT.SIDEBAR);
    const view = render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <AppShellProvider value={shellValue}>
          <DiscsSearchParameters isActive />
        </AppShellProvider>
      </ConfigProvider>
    );
    const form = await screen.findByRole('form', {
      name: 'Параметры поиска дисков',
    });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.mouseDown(getBrandSelector());
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Enkei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));

    expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();
    expect(indexedDBService.searchDiscs).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.submit(form);
    });
    await waitFor(() => {
      expect(indexedDBService.searchDiscs).toHaveBeenCalled();
    });
    expect(indexedDBService.searchDiscs.mock.calls.at(-1)[0]).toEqual(
      expect.objectContaining({ brand: ['Enkei'] })
    );
    view.unmount();
  });
});
