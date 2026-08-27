import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
 * Реально: DiscsSearchParameters + antd Form + связанные Select «от/до».
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
jest.mock('../shared/PaginatedCardsList/PaginatedCardsList', () => () => null);
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

const emptyDiscOptions = {
  brands: [],
  suppliers: [],
  diameters: [],
  widths: [],
  cb: [54, 67, 80],
  et: [],
  pcd: [],
  pn: [],
  diskTypes: [],
};

const shellValue = {
  clientMode: false,
  catalogDataVersion: 0,
  workspaceResetKey: 'store-a',
};

const getSelectRoot = (label) =>
  screen.getByRole('combobox', { name: label }).closest('.ant-select');

const getSelectedText = (label) =>
  getSelectRoot(label).querySelector('.ant-select-selection-item')?.textContent ??
  '';

const getDropdownOptionTexts = (fieldName) => {
  const dropdown = document
    .getElementById(`${fieldName}_list`)
    ?.closest('.ant-select-dropdown');
  if (!dropdown) {
    return [];
  }
  return [...dropdown.querySelectorAll('.ant-select-item-option-content')].map(
    (node) => node.textContent
  );
};

const openSelectByLabel = (label) => {
  const selector = getSelectRoot(label).querySelector('.ant-select-selector');
  fireEvent.mouseDown(selector);
};

const pickOption = async (value) => {
  const content = await waitFor(() => {
    const node = document.querySelector(
      `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${value}"] .ant-select-item-option-content`
    );
    if (!node) {
      throw new Error(`option ${value} not visible`);
    }
    return node;
  });
  fireEvent.click(content);
};

describe('DiscsSearchParameters linked range selects', () => {
  jest.setTimeout(20000);
  beforeEach(() => {
    useCatalogSearchFormLayout.mockReturnValue(CATALOG_SEARCH_LAYOUT.SIDEBAR);
    indexedDBService.getAvailableDiscParameterOptions.mockResolvedValue(
      emptyDiscOptions
    );
    indexedDBService.searchDiscs.mockResolvedValue([]);
  });

  test(
    'после выбора ЦО от в «до» нет меньших значений; clear возвращает полный список',
    async () => {
      render(
        <AppShellProvider value={shellValue}>
          <DiscsSearchParameters isActive />
        </AppShellProvider>
      );

      await screen.findByRole('form', { name: 'Параметры поиска дисков' });
      await waitFor(() => {
        expect(
          indexedDBService.getAvailableDiscParameterOptions
        ).toHaveBeenCalled();
      });

      openSelectByLabel('ЦО от');
      await pickOption('67');
      await waitFor(() => {
        expect(getSelectedText('ЦО от')).toBe('67');
      });

      openSelectByLabel('ЦО до');
      await waitFor(() => {
        expect(getDropdownOptionTexts('cbTo')).toEqual(['67', '80']);
      });

      fireEvent.keyDown(document.body, { key: 'Escape', which: 27, keyCode: 27 });

      const clearButton = getSelectRoot('ЦО от').querySelector('.ant-select-clear');
      expect(clearButton).not.toBeNull();
      fireEvent.mouseDown(clearButton);
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(getSelectedText('ЦО от')).toBe('');
      });

      openSelectByLabel('ЦО до');
      await waitFor(() => {
        expect(getDropdownOptionTexts('cbTo')).toEqual(['54', '67', '80']);
      });
    },
    15000
  );
});
