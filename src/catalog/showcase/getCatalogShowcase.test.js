jest.mock('../../services/indexedDBService', () => ({
  __esModule: true,
  default: {
    collectTireShowcaseCandidates: jest.fn(),
    collectDiscShowcaseCandidates: jest.fn(),
  },
}));

const summerShelfCandidates = () =>
  Array.from({ length: 40 }, (_, i) => {
    if (i < 6) {
      const titles = [
        'Ikon Character Eco 91H',
        'Ikon Autograph Eco 3 91V',
        'Ikon Autograph Aqua 3 94V',
        'Ikon Character Aqua 91V',
        'Ikon Character Ultra 94W',
        'Ikon Autograph Ultra 2 94W',
      ];
      return {
        id: i + 1,
        brand: 'Ikon',
        title: titles[i],
        amount: 8,
        photoUrl: 'x',
        sellingPrice: 7000,
        season: 's',
        diameter: `R${15 + (i % 4)}`,
        supplier: 'Шинсервис',
      };
    }
    return {
      id: i + 1,
      brand: `Brand${i}`,
      title: `Brand${i} Model${i} 91V`,
      model: `Model${i}`,
      amount: 8,
      photoUrl: 'x',
      sellingPrice: 7000,
      season: 's',
      diameter: 'R16',
      supplier: 'Шинсервис',
    };
  });

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
          collectDiscShowcaseCandidates: jest.fn(),
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

  test('одна catalogDataVersion + snapshot version → одинаковый порядок полки', async () => {
    const candidates = summerShelfCandidates();
    const indexedDBService = require('../../services/indexedDBService').default;
    indexedDBService.collectTireShowcaseCandidates.mockReset();
    indexedDBService.collectTireShowcaseCandidates.mockResolvedValue({
      isEmpty: false,
      candidates,
    });
    if (typeof indexedDBService.collectDiscShowcaseCandidates !== 'function') {
      indexedDBService.collectDiscShowcaseCandidates = jest.fn();
    }

    const { getCatalogShowcase } = require('./getCatalogShowcase');
    const opts = {
      kind: 'tires',
      catalogDataVersion: 7,
      catalogSnapshotVersion: '2026-08-24T12:10:00Z',
      workspaceResetKey: 'acc:store-1',
      now: new Date('2026-06-15'),
    };
    const first = await getCatalogShowcase(opts);
    const second = await getCatalogShowcase(opts);
    expect(indexedDBService.collectTireShowcaseCandidates).toHaveBeenCalled();
    expect(first.empty).toBe(false);
    expect(first.shelves).toHaveLength(1);
    expect(first.shelves[0].items.map((i) => i.id)).toEqual(
      second.shelves[0].items.map((i) => i.id)
    );
    expect(first.shelves[0].items).toHaveLength(30);
  });

  test('диски: collect без раннего лимита 480', async () => {
    const indexedDBService = require('../../services/indexedDBService').default;
    if (typeof indexedDBService.collectDiscShowcaseCandidates !== 'function') {
      indexedDBService.collectDiscShowcaseCandidates = jest.fn();
    }
    indexedDBService.collectDiscShowcaseCandidates.mockReset();
    indexedDBService.collectDiscShowcaseCandidates.mockResolvedValue({
      isEmpty: false,
      candidates: Array.from({ length: 20 }, (_, i) => ({
        id: `d-${i}`,
        brand: `B${i}`,
        model: `M${i}`,
        amount: 4,
        diskType: 'Литой',
        photoUrl: 'x',
        sellingPrice: 8000,
        supplier: 'Шинсервис',
      })),
    });

    const { getCatalogShowcase } = require('./getCatalogShowcase');
    await getCatalogShowcase({
      kind: 'discs',
      catalogDataVersion: 1,
      catalogSnapshotVersion: 'snap-1',
    });

    expect(indexedDBService.collectDiscShowcaseCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateLimit: Number.POSITIVE_INFINITY,
        minAmount: 4,
        supplier: 'Шинсервис',
      })
    );
  });
});
