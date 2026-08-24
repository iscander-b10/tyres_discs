import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { AppShellProvider } from './app/AppShellContext';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import indexedDBService from './services/indexedDBService';

/**
 * Dual-mount catalog: keep-alive UX + pause IDB for inactive panel.
 * Риск: P1 — скрытая вкладка бьёт IDB; catch-up/keep-alive ломаются.
 */

jest.mock('./app/AppShellContext', () => {
  const React = require('react');
  const ShellContext = React.createContext(null);
  return {
    useAppShell: () => React.useContext(ShellContext),
    AppShellProvider: ShellContext.Provider,
  };
});

jest.mock('./services/indexedDBService', () => ({
  __esModule: true,
  default: {
    getAvailableParameterOptions: jest.fn(),
    getAvailableDiscParameterOptions: jest.fn(),
    searchTires: jest.fn(),
    searchDiscs: jest.fn(),
    collectTireShowcaseCandidates: jest.fn(),
    collectDiscShowcaseCandidates: jest.fn(),
  },
}));

jest.mock('./components/shared/CatalogShowcase', () => ({ kind }) => (
  <div data-testid={`${kind === 'discs' ? 'discs' : 'tires'}-showcase`} />
));
jest.mock('./components/shared/CatalogShowcase/CatalogSearchEmptyHint', () => () =>
  null
);
jest.mock('./components/shared/PaginatedCardsList/PaginatedCardsList', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ items, searchResetKey }) => {
      const [page, setPage] = React.useState(1);
      React.useEffect(() => {
        setPage(1);
      }, [searchResetKey]);
      return (
        <div data-testid="search-results-panel">
          <ul data-testid="search-results">
            {(items || []).map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
          <span data-testid="current-page">{page}</span>
          <button type="button" onClick={() => setPage(2)}>
            go-page-2
          </button>
        </div>
      );
    },
  };
});
jest.mock('./components/shared/HoverTooltip', () => ({ children }) => children);
jest.mock('./components/shared/CatalogItemCard/CatalogItemCard', () => () => null);
jest.mock('./components/shared/CatalogItemModalWindow/CatalogItemModalWindow', () => () =>
  null
);
jest.mock('./icons/Sun.svg', () => ({ ReactComponent: () => null }));
jest.mock('./icons/Snow.svg', () => ({ ReactComponent: () => null }));
jest.mock('./icons/Reset.svg', () => ({ ReactComponent: () => null }));
jest.mock('./icons/Search.svg', () => ({ ReactComponent: () => null }));

const emptyTireOptions = {
  widths: [205],
  profiles: [55],
  diameters: ['16'],
  brands: ['Michelin'],
  suppliers: [],
};

const emptyDiscOptions = {
  brands: ['OZ'],
  suppliers: [],
  diameters: ['16'],
  widths: [7],
  cb: [66.6],
  et: [40],
  pcd: [114.3],
  pn: [5],
  diskTypes: [],
};

function DualMountHarness({
  page: pageProp = 'tyres',
  catalogDataVersion = 0,
  workspaceResetKey = 'store-a',
  sessionResetKey = 0,
}) {
  const [page, setPage] = useState(pageProp);
  return (
    <AppShellProvider
      value={{
        clientMode: false,
        catalogDataVersion,
        workspaceResetKey,
      }}
    >
      <div data-testid="nav">
        <button type="button" onClick={() => setPage('tyres')}>
          to-tyres
        </button>
        <button type="button" onClick={() => setPage('wheels')}>
          to-wheels
        </button>
        <span data-testid="active-page">{page}</span>
      </div>
      <div hidden={page !== 'tyres'}>
        <TiresSearchParameters
          key={`tires-${workspaceResetKey}-${sessionResetKey}`}
          isActive={page === 'tyres'}
        />
      </div>
      <div hidden={page !== 'wheels'}>
        <DiscsSearchParameters
          key={`discs-${workspaceResetKey}-${sessionResetKey}`}
          isActive={page === 'wheels'}
        />
      </div>
    </AppShellProvider>
  );
}

describe('catalog dual-mount pause IDB', () => {
  beforeEach(() => {
    indexedDBService.getAvailableParameterOptions.mockReset();
    indexedDBService.getAvailableDiscParameterOptions.mockReset();
    indexedDBService.searchTires.mockReset();
    indexedDBService.searchDiscs.mockReset();
    indexedDBService.collectTireShowcaseCandidates.mockReset();
    indexedDBService.collectDiscShowcaseCandidates.mockReset();

    indexedDBService.getAvailableParameterOptions.mockResolvedValue(emptyTireOptions);
    indexedDBService.getAvailableDiscParameterOptions.mockResolvedValue(
      emptyDiscOptions
    );
    indexedDBService.searchTires.mockResolvedValue([
      { id: 't1', title: 'Tire One' },
      { id: 't2', title: 'Tire Two' },
    ]);
    indexedDBService.searchDiscs.mockResolvedValue([
      { id: 'd1', title: 'Disc One' },
      { id: 'd2', title: 'Disc Two' },
    ]);
  });

  test('на /tyres диски не ходят в IDB (facets / search / showcase collect)', async () => {
    render(<DualMountHarness page="tyres" />);

    await screen.findByRole('form', { name: 'Параметры поиска шин' });
    expect(indexedDBService.getAvailableParameterOptions).toHaveBeenCalled();
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();

    expect(indexedDBService.getAvailableDiscParameterOptions).not.toHaveBeenCalled();
    expect(indexedDBService.searchDiscs).not.toHaveBeenCalled();
    expect(indexedDBService.collectDiscShowcaseCandidates).not.toHaveBeenCalled();
    expect(screen.queryByTestId('discs-showcase')).not.toBeInTheDocument();
  });

  test('bump catalogDataVersion на /tyres: шины обновляются, диски только stale', async () => {
    const view = render(
      <DualMountHarness page="tyres" catalogDataVersion={0} />
    );
    await screen.findByRole('form', { name: 'Параметры поиска шин' });
    const tireCallsAfterMount =
      indexedDBService.getAvailableParameterOptions.mock.calls.length;

    await act(async () => {
      view.rerender(
        <DualMountHarness page="tyres" catalogDataVersion={1} />
      );
    });

    expect(
      indexedDBService.getAvailableParameterOptions.mock.calls.length
    ).toBeGreaterThan(tireCallsAfterMount);
    expect(indexedDBService.getAvailableDiscParameterOptions).not.toHaveBeenCalled();
    expect(indexedDBService.searchDiscs).not.toHaveBeenCalled();
  });

  test('переключение на /wheels после bump: discs catch-up ровно один раз', async () => {
    const view = render(
      <DualMountHarness page="tyres" catalogDataVersion={0} />
    );
    await screen.findByRole('form', { name: 'Параметры поиска шин' });

    await act(async () => {
      view.rerender(
        <DualMountHarness page="tyres" catalogDataVersion={2} />
      );
    });
    expect(indexedDBService.getAvailableDiscParameterOptions).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'to-wheels' }));
    });

    await screen.findByRole('form', { name: 'Параметры поиска дисков' });
    expect(indexedDBService.getAvailableDiscParameterOptions).toHaveBeenCalledTimes(
      1
    );
    expect(screen.getByTestId('discs-showcase')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'to-tyres' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'to-wheels' }));
    });

    // Re-activate без нового bump — без повторного catch-up
    expect(indexedDBService.getAvailableDiscParameterOptions).toHaveBeenCalledTimes(
      1
    );
  });

  test('keep-alive: фильтры + searchResults + page переживают tyres→wheels→tyres', async () => {
    render(<DualMountHarness page="tyres" />);
    const tiresForm = await screen.findByRole('form', {
      name: 'Параметры поиска шин',
    });

    const runflat = within(tiresForm).getByRole('checkbox', { name: 'RunFlat' });
    await act(async () => {
      fireEvent.click(runflat);
    });
    expect(runflat).toBeChecked();

    await act(async () => {
      fireEvent.submit(tiresForm);
    });
    expect(await screen.findByText('Tire One')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go-page-2' }));
    });
    expect(screen.getByTestId('current-page')).toHaveTextContent('2');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'to-wheels' }));
    });
    await screen.findByRole('form', { name: 'Параметры поиска дисков' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'to-tyres' }));
    });

    const tiresFormAgain = await screen.findByRole('form', {
      name: 'Параметры поиска шин',
    });
    expect(screen.getByText('Tire One')).toBeInTheDocument();
    expect(screen.getByTestId('current-page')).toHaveTextContent('2');
    expect(
      within(tiresFormAgain).getByRole('checkbox', { name: 'RunFlat' })
    ).toBeChecked();
  });

  test('remount по sessionResetKey сбрасывает searchResults', async () => {
    const view = render(
      <DualMountHarness page="tyres" sessionResetKey={0} />
    );
    const tiresForm = await screen.findByRole('form', {
      name: 'Параметры поиска шин',
    });

    await act(async () => {
      fireEvent.submit(tiresForm);
    });
    expect(await screen.findByText('Tire One')).toBeInTheDocument();

    await act(async () => {
      view.rerender(
        <DualMountHarness page="tyres" sessionResetKey={1} />
      );
    });

    await screen.findByRole('form', { name: 'Параметры поиска шин' });
    expect(screen.queryByText('Tire One')).not.toBeInTheDocument();
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();
  });

  test('remount по workspaceResetKey сбрасывает searchResults', async () => {
    const view = render(
      <DualMountHarness page="tyres" workspaceResetKey="store-a" />
    );
    const tiresForm = await screen.findByRole('form', {
      name: 'Параметры поиска шин',
    });

    await act(async () => {
      fireEvent.submit(tiresForm);
    });
    expect(await screen.findByText('Tire One')).toBeInTheDocument();

    await act(async () => {
      view.rerender(
        <DualMountHarness page="tyres" workspaceResetKey="store-b" />
      );
    });

    await screen.findByRole('form', { name: 'Параметры поиска шин' });
    expect(screen.queryByText('Tire One')).not.toBeInTheDocument();
    expect(screen.getByTestId('tires-showcase')).toBeInTheDocument();
  });
});
