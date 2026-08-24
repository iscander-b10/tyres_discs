import {
  mapDiscFormValuesToSearchFilters,
  mapTireFormValuesToSearchFilters,
} from './searchFormFilters';

/**
 * Моки: нет.
 * Реально: чистый маппинг form → filters.
 * Риск: P1 — onlyAmountFrom4/spikes/runflat не доходят до searchTires/searchDiscs.
 */

describe('mapTireFormValuesToSearchFilters', () => {
  test('onlyAmountFrom4 → minAmount: 4 и убирает флаг формы', () => {
    expect(
      mapTireFormValuesToSearchFilters({
        season: 's',
        onlyAmountFrom4: true,
        onlyRunflat: false,
      })
    ).toEqual({
      season: 's',
      minAmount: 4,
    });
  });

  test('onlyRunflat → runflat: true', () => {
    expect(
      mapTireFormValuesToSearchFilters({
        season: 's',
        onlyRunflat: true,
        onlyAmountFrom4: false,
      })
    ).toEqual({
      season: 's',
      runflat: true,
    });
  });

  test('spikes: null не уходит в фильтр', () => {
    expect(
      mapTireFormValuesToSearchFilters({
        season: 'w',
        spikes: null,
      })
    ).toEqual({ season: 'w' });
  });

  test('spikes: false сохраняется (без шипов)', () => {
    expect(
      mapTireFormValuesToSearchFilters({
        season: 'w',
        spikes: false,
      })
    ).toEqual({ season: 'w', spikes: false });
  });
});

describe('mapDiscFormValuesToSearchFilters', () => {
  test('onlyAmountFrom4 → minAmount: 4', () => {
    expect(
      mapDiscFormValuesToSearchFilters({
        diameter: 'R16',
        onlyAmountFrom4: true,
      })
    ).toEqual({
      diameter: 'R16',
      minAmount: 4,
    });
  });

  test('выключенный чекбокс не добавляет minAmount', () => {
    expect(
      mapDiscFormValuesToSearchFilters({
        diameter: 'R16',
        onlyAmountFrom4: false,
      })
    ).toEqual({ diameter: 'R16' });
  });
});
