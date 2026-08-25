import {
  collectShowcaseCandidatesFromItems,
  DISC_SEARCH_INDEX_HINTS,
  pickEqualityFilterKey,
  pickEqualityIndex,
  TIRE_SEARCH_INDEX_HINTS,
} from './catalogIdbQueries';

const createStore = () => {
  const calls = [];
  return {
    calls,
    openCursor: () => {
      calls.push({ kind: 'store' });
      return { kind: 'store' };
    },
    index: (name) => ({
      openCursor: (range) => {
        calls.push({ kind: 'index', name, range });
        return { kind: 'index', name, range };
      },
    }),
  };
};

describe('pickEqualityIndex', () => {
  let originalKeyRange;

  beforeEach(() => {
    originalKeyRange = global.IDBKeyRange;
    global.IDBKeyRange = {
      only: (value) => ({ only: value }),
    };
  });

  afterEach(() => {
    global.IDBKeyRange = originalKeyRange;
  });

  test('шины: width важнее season, иначе diameter → brand → supplier', () => {
    const widthAndSeason = createStore();
    pickEqualityIndex(
      widthAndSeason,
      { width: 205, season: 's' },
      TIRE_SEARCH_INDEX_HINTS
    );
    expect(widthAndSeason.calls).toEqual([
      { kind: 'index', name: 'width', range: { only: 205 } },
    ]);

    const store = createStore();
    pickEqualityIndex(
      store,
      { diameter: 'R16', season: 's', brand: 'Ikon', supplier: 'A' },
      TIRE_SEARCH_INDEX_HINTS
    );
    expect(store.calls).toEqual([
      { kind: 'index', name: 'diameter', range: { only: 'R16' } },
    ]);

    const withoutSize = createStore();
    pickEqualityIndex(
      withoutSize,
      { season: 's', brand: 'Ikon', supplier: 'A' },
      TIRE_SEARCH_INDEX_HINTS
    );
    expect(withoutSize.calls).toEqual([
      { kind: 'index', name: 'brand', range: { only: 'Ikon' } },
    ]);

    const seasonOnly = createStore();
    pickEqualityIndex(seasonOnly, { season: 's' }, TIRE_SEARCH_INDEX_HINTS);
    expect(seasonOnly.calls).toEqual([
      { kind: 'index', name: 'season', range: { only: 's' } },
    ]);
  });

  test('диски: diameter → pcd → pn → diskType → brand → supplier', () => {
    const store = createStore();
    pickEqualityIndex(
      store,
      { diameter: 'R16', diskType: 'Литой', brand: 'Replay', supplier: 'A' },
      DISC_SEARCH_INDEX_HINTS
    );
    expect(store.calls).toEqual([
      { kind: 'index', name: 'diameter', range: { only: 'R16' } },
    ]);

    const pcdAndType = createStore();
    pickEqualityIndex(
      pcdAndType,
      { pcd: 114.3, diskType: 'Литой' },
      DISC_SEARCH_INDEX_HINTS
    );
    expect(pcdAndType.calls).toEqual([
      { kind: 'index', name: 'pcd', range: { only: 114.3 } },
    ]);

    const withoutDiameter = createStore();
    pickEqualityIndex(
      withoutDiameter,
      { diskType: 'Литой', brand: 'Replay', supplier: 'A' },
      DISC_SEARCH_INDEX_HINTS
    );
    expect(withoutDiameter.calls).toEqual([
      { kind: 'index', name: 'diskType', range: { only: 'Литой' } },
    ]);
  });

  test('массив брендов не выбирает индекс brand', () => {
    const store = createStore();
    pickEqualityIndex(
      store,
      { brand: ['Ikon', 'Nokian'], supplier: 'A' },
      TIRE_SEARCH_INDEX_HINTS
    );
    expect(store.calls).toEqual([
      { kind: 'index', name: 'supplier', range: { only: 'A' } },
    ]);
  });

  test('пустые фильтры открывают store cursor', () => {
    const store = createStore();
    pickEqualityIndex(store, {}, TIRE_SEARCH_INDEX_HINTS);
    expect(store.calls).toEqual([{ kind: 'store' }]);
  });

  test('pickEqualityFilterKey: season не перебивает width', () => {
    expect(
      pickEqualityFilterKey({ season: 's', width: 205 }, TIRE_SEARCH_INDEX_HINTS)
    ).toEqual({ key: 'width', value: 205 });
    expect(pickEqualityFilterKey({ season: 's' }, TIRE_SEARCH_INDEX_HINTS)).toEqual(
      { key: 'season', value: 's' }
    );
  });
});

describe('collectShowcaseCandidatesFromItems', () => {
  test('Ikon в конце массива не отрезаются лимитом чужих', () => {
    const items = [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `o-${i}`,
        supplier: 'Шинсервис',
        brand: 'Nokian',
        amount: 4,
      })),
      {
        id: 'ikon-late',
        supplier: 'Шинсервис',
        brand: 'Ikon',
        amount: 8,
      },
    ];
    const payload = collectShowcaseCandidatesFromItems(items, {
      candidateLimit: 5,
      minAmount: 1,
      supplier: 'Шинсервис',
      preferItem: (item) => item.brand === 'Ikon',
    });
    expect(payload.isEmpty).toBe(false);
    expect(payload.candidates.some((item) => item.id === 'ikon-late')).toBe(
      true
    );
    expect(payload.candidates[0].id).toBe('ikon-late');
    expect(payload.candidates).toHaveLength(5);
  });

  test('диски: candidateLimit null возвращает все matching', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `d-${i}`,
      supplier: 'Шинсервис',
      diskType: 'Литой',
      amount: 4,
    }));
    const payload = collectShowcaseCandidatesFromItems(items, {
      candidateLimit: null,
      minAmount: 4,
      supplier: 'Шинсервис',
    });
    expect(payload.candidates).toHaveLength(40);
  });

  test('пустой массив → isEmpty', () => {
    expect(collectShowcaseCandidatesFromItems([], { candidateLimit: 10 })).toEqual(
      { isEmpty: true, candidates: [] }
    );
  });
});
