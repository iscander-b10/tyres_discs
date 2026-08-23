jest.mock('../../services/indexedDBService', () => ({
  __esModule: true,
  default: {
    collectTireShowcaseCandidates: jest.fn(),
    collectDiscShowcaseCandidates: jest.fn(),
  },
}));

describe('getCatalogShowcase stale-while-revalidate', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  test('возвращает stale payload, пока новая версия грузится', async () => {
    const indexedDBService = require('../../services/indexedDBService').default;
    indexedDBService.collectTireShowcaseCandidates
      .mockResolvedValueOnce({ isEmpty: false, candidates: [{ id: 'v1' }] })
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () => resolve({ isEmpty: false, candidates: [{ id: 'v2' }] }),
              30
            );
          })
      );

    const { getCatalogShowcase } = require('./getCatalogShowcase');
    await getCatalogShowcase({ kind: 'tires', catalogDataVersion: 1 });

    const pending = getCatalogShowcase({ kind: 'tires', catalogDataVersion: 2 });
    const stale = await getCatalogShowcase({ kind: 'tires', catalogDataVersion: 1 });
    expect(stale).toBeTruthy();
    await expect(pending).resolves.toBeTruthy();
  });

  test('устаревший promise не перезаписывает более новую версию', async () => {
    jest.isolateModules(async () => {
      jest.doMock('../../services/indexedDBService', () => ({
        __esModule: true,
        default: {
          collectTireShowcaseCandidates: jest
            .fn()
            .mockImplementationOnce(
              () =>
                new Promise((resolve) => {
                  setTimeout(
                    () => resolve({ isEmpty: false, candidates: [{ id: 'old' }] }),
                    40
                  );
                })
            )
            .mockResolvedValueOnce({ isEmpty: false, candidates: [{ id: 'new' }] }),
        },
      }));

      const { getCatalogShowcase } = require('./getCatalogShowcase');
      const slow = getCatalogShowcase({ kind: 'tires', catalogDataVersion: 1 });
      const fast = getCatalogShowcase({ kind: 'tires', catalogDataVersion: 2 });

      await expect(fast).resolves.toBeTruthy();
      await expect(slow).resolves.toBeTruthy();
    });
  });

  test('не возвращает payload прежнего workspace при ошибке нового чтения', async () => {
    const indexedDBService = require('../../services/indexedDBService').default;
    indexedDBService.collectTireShowcaseCandidates
      .mockReset()
      .mockResolvedValueOnce({ isEmpty: false, candidates: [{ id: 'store-a' }] });
    const { getCatalogShowcase } = require('./getCatalogShowcase');

    await getCatalogShowcase({
      kind: 'tires',
      catalogDataVersion: 1,
      workspaceResetKey: 'account-a:store-a',
    });
    expect(
      indexedDBService.collectTireShowcaseCandidates
    ).toHaveBeenCalledTimes(1);
    indexedDBService.collectTireShowcaseCandidates.mockRejectedValueOnce(
      new Error('store-b unavailable')
    );

    await expect(
      getCatalogShowcase({
        kind: 'tires',
        catalogDataVersion: 1,
        workspaceResetKey: 'account-b:store-b',
      })
    ).rejects.toThrow('store-b unavailable');
  });
});
