import { act, render, screen } from '@testing-library/react';
import React from 'react';
import CatalogShowcase from './CatalogShowcase';
import { appLog } from '../../../utils/appLog';

jest.mock('../../../app/AppShellContext', () => ({
  useAppShell: () => ({
    clientMode: false,
    catalogDataVersion: 3,
    catalogSnapshotVersion: 'v-snap',
    workspaceResetKey: 'store-a',
  }),
}));

jest.mock('../../../catalog/showcase', () => ({
  getCatalogShowcase: jest.fn(),
  SHOWCASE_CONFIG: {
    copy: {
      popularModels: 'Популярные',
      seasonHits: 'Хиты',
      catalogEmptyTitle: 'Пусто',
      catalogEmptyHint: 'Подсказка',
    },
  },
}));

jest.mock('./ShowcaseShelf', () => () => <div data-testid="shelf" />);
jest.mock('./ShowcaseSizeChips', () => () => <div data-testid="chips" />);
jest.mock('./showcaseChips', () => ({
  getShowcaseStaticChips: () => ({ chips: [], chipsTitle: 'Чипы' }),
}));

jest.mock('../../../utils/appLog', () => {
  const actual = jest.requireActual('../../../utils/appLog');
  return {
    ...actual,
    appLog: {
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

const { getCatalogShowcase } = require('../../../catalog/showcase');

describe('CatalogShowcase appLog', () => {
  beforeEach(() => {
    getCatalogShowcase.mockReset();
    appLog.error.mockReset();
  });

  test('catch логирует showcase.load_failed без смены Empty UX', async () => {
    getCatalogShowcase.mockRejectedValue(new Error('idb down'));

    await act(async () => {
      render(
        <CatalogShowcase kind="tires" renderCard={() => null} onChipClick={() => {}} />
      );
    });

    expect(appLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'showcase.load_failed',
        domain: 'showcase',
        context: expect.objectContaining({
          kind: 'tires',
          catalogDataVersion: 3,
          catalogSnapshotVersion: 'v-snap',
          workspaceResetKey: 'store-a',
          hadStale: false,
        }),
      })
    );
    expect(
      screen.getByText('Не удалось собрать полки. Загрузите данные ещё раз.')
    ).toBeInTheDocument();
  });

  test('StaleCatalogStoreError не логируется как error', async () => {
    const stale = new Error('stale');
    stale.name = 'StaleCatalogStoreError';
    getCatalogShowcase.mockRejectedValue(stale);

    await act(async () => {
      render(
        <CatalogShowcase kind="tires" renderCard={() => null} onChipClick={() => {}} />
      );
    });

    expect(appLog.error).not.toHaveBeenCalled();
  });
});
