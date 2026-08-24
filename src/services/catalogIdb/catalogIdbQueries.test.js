import {
  DISC_SEARCH_INDEX_HINTS,
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

  test('шины: приоритет diameter → season → brand → supplier', () => {
    const store = createStore();
    pickEqualityIndex(
      store,
      { diameter: 'R16', season: 's', brand: 'Ikon', supplier: 'A' },
      TIRE_SEARCH_INDEX_HINTS
    );
    expect(store.calls).toEqual([
      { kind: 'index', name: 'diameter', range: { only: 'R16' } },
    ]);

    const withoutDiameter = createStore();
    pickEqualityIndex(
      withoutDiameter,
      { season: 's', brand: 'Ikon', supplier: 'A' },
      TIRE_SEARCH_INDEX_HINTS
    );
    expect(withoutDiameter.calls).toEqual([
      { kind: 'index', name: 'season', range: { only: 's' } },
    ]);

    const brandOnly = createStore();
    pickEqualityIndex(
      brandOnly,
      { brand: 'Ikon', supplier: 'A' },
      TIRE_SEARCH_INDEX_HINTS
    );
    expect(brandOnly.calls).toEqual([
      { kind: 'index', name: 'brand', range: { only: 'Ikon' } },
    ]);
  });

  test('диски: приоритет diameter → diskType → brand → supplier', () => {
    const store = createStore();
    pickEqualityIndex(
      store,
      { diameter: 'R16', diskType: 'Литой', brand: 'Replay', supplier: 'A' },
      DISC_SEARCH_INDEX_HINTS
    );
    expect(store.calls).toEqual([
      { kind: 'index', name: 'diameter', range: { only: 'R16' } },
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
});
