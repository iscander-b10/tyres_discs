import { collectTireFacetOptions } from './catalogFacetOptions';

const tire = (over = {}) => ({
  width: 205,
  profile: 55,
  diameter: 'R16',
  season: 's',
  brand: 'Ikon',
  supplier: 'A',
  ...over,
});

describe('collectTireFacetOptions', () => {
  test('своё поле не фильтрует само себя при связанности width/profile/diameter', () => {
    const options = collectTireFacetOptions(
      [
        tire({ width: 205, profile: 55, diameter: 'R16' }),
        tire({ width: 215, profile: 55, diameter: 'R16' }),
        tire({ width: 205, profile: 60, diameter: 'R16' }),
        tire({ width: 205, profile: 55, diameter: 'R17' }),
        tire({ width: 225, profile: 60, diameter: 'R17' }),
      ],
      { width: 205, profile: 55, diameter: 'R16' }
    );

    expect(options.widths).toEqual([205, 215]);
    expect(options.profiles).toEqual([55, 60]);
    expect(options.diameters).toEqual(['R16', 'R17']);
    expect(options.brands).toEqual(['Ikon']);
  });
});
