import { collectDiscFacetOptions, collectTireFacetOptions } from './catalogFacetOptions';
import { createCategoryMemory } from './catalogIdbMemory';

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

  test('та же каскадная семантика на компактных facet-rows, не на полном getAll', () => {
    const items = [
      tire({ width: 205, profile: 55, diameter: 'R16' }),
      tire({ width: 205, profile: 55, diameter: 'R16', brand: 'Ikon' }),
      tire({ width: 215, profile: 55, diameter: 'R16' }),
      tire({ width: 205, profile: 60, diameter: 'R16' }),
      tire({ width: 205, profile: 55, diameter: 'R17' }),
    ];
    const memory = createCategoryMemory(items, 'tires');
    const options = collectTireFacetOptions(memory.facetRows, {
      width: 205,
      profile: 55,
      diameter: 'R16',
    });
    expect(options.widths).toEqual([205, 215]);
    expect(options.profiles).toEqual([55, 60]);
    expect(options.diameters).toEqual(['R16', 'R17']);
  });
});

describe('collectDiscFacetOptions', () => {
  const disc = (over = {}) => ({
    diameter: 'R16',
    width: 7,
    pcd: 114.3,
    pn: 5,
    cb: 66.1,
    et: 40,
    diskType: 'Литой',
    brand: 'Replay',
    supplier: 'A',
    ...over,
  });

  test('своё поле не фильтрует само себя: diameter/pcd/pn', () => {
    const options = collectDiscFacetOptions(
      [
        disc(),
        disc({ diameter: 'R17' }),
        disc({ pcd: 100 }),
        disc({ pn: 4 }),
      ],
      { diameter: 'R16', pcd: 114.3, pn: 5 }
    );

    expect(options.diameters).toEqual(['R16', 'R17']);
    expect(options.pcd).toEqual([100, 114.3]);
    expect(options.pn).toEqual([4, 5]);
  });
});
