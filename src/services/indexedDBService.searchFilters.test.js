import {
  matchesDiscSearchFilters,
  matchesTireSearchFilters,
} from './indexedDBService';

/**
 * Моки: нет.
 * Реально: exported matchers поиска.
 * Риск: P1 — фильтры размера/остатка/шипов/runflat расходятся с IDB-курсором.
 */

const tire = (over = {}) => ({
  id: 't1',
  supplier: 'A',
  brand: 'Ikon',
  width: 205,
  profile: 55,
  diameter: 'R16',
  season: 's',
  spikes: false,
  runflat: false,
  amount: 8,
  ...over,
});

const disc = (over = {}) => ({
  id: 'd1',
  supplier: 'A',
  brand: 'Replay',
  diameter: 'R16',
  width: 7,
  pcd: 114.3,
  pn: 5,
  et: 40,
  cb: 66.1,
  diskType: 'Литой',
  amount: 8,
  ...over,
});

describe('matchesTireSearchFilters', () => {
  test('minAmount отсекает остаток меньше порога', () => {
    expect(matchesTireSearchFilters(tire({ amount: 3 }), { minAmount: 4 })).toBe(
      false
    );
    expect(matchesTireSearchFilters(tire({ amount: 4 }), { minAmount: 4 })).toBe(
      true
    );
  });

  test('spikes сравнивается строго, undefined пропускает', () => {
    expect(matchesTireSearchFilters(tire({ spikes: true }), { spikes: true })).toBe(
      true
    );
    expect(
      matchesTireSearchFilters(tire({ spikes: true }), { spikes: false })
    ).toBe(false);
    expect(matchesTireSearchFilters(tire({ spikes: true }), {})).toBe(true);
  });

  test('runflat: true требует item.runflat === true', () => {
    expect(matchesTireSearchFilters(tire({ runflat: true }), { runflat: true })).toBe(
      true
    );
    expect(matchesTireSearchFilters(tire({ runflat: false }), { runflat: true })).toBe(
      false
    );
    expect(matchesTireSearchFilters(tire({ runflat: true }), {})).toBe(true);
  });

  test('несовпадающий diameter / season отсекает', () => {
    expect(
      matchesTireSearchFilters(tire(), { diameter: 'R17', season: 's' })
    ).toBe(false);
    expect(matchesTireSearchFilters(tire(), { season: 'w' })).toBe(false);
    expect(
      matchesTireSearchFilters(tire(), { width: 205, profile: 55, diameter: 'R16' })
    ).toBe(true);
  });

  test('бренд: массив включает, чужой исключает', () => {
    expect(matchesTireSearchFilters(tire(), { brand: ['Ikon', 'Nokian'] })).toBe(
      true
    );
    expect(matchesTireSearchFilters(tire(), { brand: ['Nokian'] })).toBe(false);
  });
});

describe('matchesDiscSearchFilters', () => {
  test('minAmount и диапазон ET', () => {
    expect(matchesDiscSearchFilters(disc({ amount: 2 }), { minAmount: 4 })).toBe(
      false
    );
    expect(
      matchesDiscSearchFilters(disc({ et: 40 }), { etFrom: 35, etTo: 45 })
    ).toBe(true);
    expect(
      matchesDiscSearchFilters(disc({ et: 50 }), { etFrom: 35, etTo: 45 })
    ).toBe(false);
  });

  test('pcd / pn / diskType', () => {
    expect(matchesDiscSearchFilters(disc(), { pcd: 114.3, pn: 5 })).toBe(true);
    expect(matchesDiscSearchFilters(disc(), { pcd: 100 })).toBe(false);
    expect(matchesDiscSearchFilters(disc(), { diskType: 'Штампованный' })).toBe(
      false
    );
  });
});
