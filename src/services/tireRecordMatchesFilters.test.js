import { tireRecordMatchesFilters } from './indexedDBService';

const sampleTire = {
  id: 't1',
  width: '205',
  profile: 55,
  diameter: 'R16',
  season: 's',
  brand: 'Michelin',
  supplier: 'Форточки',
  spikes: false,
  runflat: false,
  amount: 8,
};

describe('tireRecordMatchesFilters', () => {
  test('matches diameter values like R16 (Number() would yield NaN)', () => {
    expect(
      tireRecordMatchesFilters(sampleTire, { diameter: 'R16', season: 's' })
    ).toBe(true);
    expect(
      tireRecordMatchesFilters(sampleTire, { diameter: 'R17', season: 's' })
    ).toBe(false);
  });

  test('matches width across string/number storage', () => {
    expect(
      tireRecordMatchesFilters(sampleTire, { width: 205, season: 's' })
    ).toBe(true);
    expect(
      tireRecordMatchesFilters(
        { ...sampleTire, width: 205 },
        { width: '205', season: 's' }
      )
    ).toBe(true);
    expect(
      tireRecordMatchesFilters(sampleTire, { width: 195, season: 's' })
    ).toBe(false);
  });

  test('treats profile 0 as an active filter (commercial tires)', () => {
    const commercial = { ...sampleTire, profile: 0, diameter: 'R16C' };
    expect(
      tireRecordMatchesFilters(commercial, { profile: 0, season: 's' })
    ).toBe(true);
    expect(
      tireRecordMatchesFilters(sampleTire, { profile: 0, season: 's' })
    ).toBe(false);
  });

  test('supports commercial diameter suffix R16C', () => {
    const commercial = { ...sampleTire, diameter: 'R16C' };
    expect(
      tireRecordMatchesFilters(commercial, { diameter: 'R16C', season: 's' })
    ).toBe(true);
    expect(
      tireRecordMatchesFilters(commercial, { diameter: 'R16', season: 's' })
    ).toBe(false);
  });
});
