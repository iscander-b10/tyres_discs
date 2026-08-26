import { act, render, screen } from '@testing-library/react';
import React from 'react';
import CatalogShowcase from './CatalogShowcase';

const mockUseAppShell = jest.fn();

jest.mock('../../../app/AppShellContext', () => ({
  useAppShell: () => mockUseAppShell(),
}));

jest.mock('../../../catalog/showcase', () => ({
  getCatalogShowcase: jest.fn(),
  SHOWCASE_CONFIG: {
    copy: {
      popularModels: 'Популярные',
      seasonHits: 'Хиты',
    },
  },
}));

jest.mock('./ShowcaseShelf', () => ({ skeleton, title }) => (
  <div data-testid={skeleton ? 'showcase-skeleton' : 'shelf'}>{title}</div>
));
jest.mock('./ShowcaseSizeChips', () => () => <div data-testid="chips" />);
jest.mock('./showcaseChips', () => ({
  getShowcaseStaticChips: () => ({ chips: [], chipsTitle: 'Чипы' }),
}));

const { getCatalogShowcase } = require('../../../catalog/showcase');

describe('CatalogShowcase empty catalog', () => {
  beforeEach(() => {
    getCatalogShowcase.mockReset();
    getCatalogShowcase.mockResolvedValue({
      empty: true,
      shelves: [],
      chips: [],
      chipsTitle: 'Чипы',
    });
    mockUseAppShell.mockReturnValue({
      clientMode: false,
      catalogDataVersion: 1,
      catalogSnapshotVersion: '',
      workspaceResetKey: 'store-a',
    });
  });

  test('пустой store показывает skeleton, не Empty «Каталог ещё загружается»', async () => {
    await act(async () => {
      render(
        <CatalogShowcase kind="tires" renderCard={() => null} onChipClick={() => {}} />
      );
    });

    expect(
      screen.queryByText('Каталог ещё загружается')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('showcase-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('chips')).toBeInTheDocument();
  });

  test('в status loading показывает skeleton', async () => {
    getCatalogShowcase.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      render(
        <CatalogShowcase kind="tires" renderCard={() => null} onChipClick={() => {}} />
      );
    });

    expect(
      screen.queryByText('Каталог ещё загружается')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('showcase-skeleton')).toBeInTheDocument();
  });

  test('готовые полки после phase ready сообщают surface ready', async () => {
    const notifyCatalogSurfaceReady = jest.fn();
    getCatalogShowcase.mockResolvedValue({
      empty: false,
      shelves: [{ id: 'hits', title: 'Хиты', items: [{ id: '1' }] }],
      chips: [],
      chipsTitle: 'Чипы',
    });
    mockUseAppShell.mockReturnValue({
      clientMode: false,
      catalogDataVersion: 1,
      catalogSnapshotVersion: 'v1',
      workspaceResetKey: 'store-a',
      catalogBootstrapPhase: 'ready',
      notifyCatalogSurfaceReady,
    });

    await act(async () => {
      render(
        <CatalogShowcase kind="tires" renderCard={() => null} onChipClick={() => {}} />
      );
    });

    expect(screen.getByTestId('shelf')).toBeInTheDocument();
    expect(notifyCatalogSurfaceReady).toHaveBeenCalled();
  });

  test('skeleton на blocking не сообщает surface ready', async () => {
    const notifyCatalogSurfaceReady = jest.fn();
    mockUseAppShell.mockReturnValue({
      clientMode: false,
      catalogDataVersion: 1,
      catalogSnapshotVersion: '',
      workspaceResetKey: 'store-a',
      catalogBootstrapPhase: 'blocking',
      notifyCatalogSurfaceReady,
    });

    await act(async () => {
      render(
        <CatalogShowcase kind="tires" renderCard={() => null} onChipClick={() => {}} />
      );
    });

    expect(screen.getByTestId('showcase-skeleton')).toBeInTheDocument();
    expect(notifyCatalogSurfaceReady).not.toHaveBeenCalled();
  });
});
