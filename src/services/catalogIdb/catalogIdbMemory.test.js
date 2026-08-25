import { TIRE_SEARCH_INDEX_HINTS } from './catalogIdbQueries';
import { matchesTireSearchFilters } from './catalogSearchFilters';
import {
  createCategoryMemory,
  filterIndexedItems,
  selectIndexedCandidates,
} from './catalogIdbMemory';

const tire = (over = {}) => ({
  id: 't',
  width: 205,
  profile: 55,
  diameter: 'R16',
  season: 's',
  brand: 'Ikon',
  supplier: 'A',
  amount: 8,
  ...over,
});

describe('catalogIdbMemory', () => {
  test('width+season берёт bucket ширины, а не весь сезон', () => {
    const items = [
      tire({ id: 'w205a', width: 205, season: 's' }),
      tire({ id: 'w205b', width: 205, season: 's', brand: 'Nokian' }),
      tire({ id: 'w215', width: 215, season: 's' }),
      ...Array.from({ length: 40 }, (_, i) =>
        tire({ id: `s-${i}`, width: 185, season: 's' })
      ),
      tire({ id: 'winter', width: 205, season: 'w' }),
    ];
    const memory = createCategoryMemory(items, 'tires');
    const candidates = selectIndexedCandidates(
      memory.items,
      memory.indexMaps,
      { season: 's', width: 205 },
      TIRE_SEARCH_INDEX_HINTS
    );

    expect(candidates.map((item) => item.id).sort()).toEqual(['w205a', 'w205b', 'winter']);
    expect(candidates.length).toBeLessThan(memory.indexMaps.season.get('s').length);
  });

  test('filterIndexedItems сохраняет matcher: season отсекает зимние при width-only+season', () => {
    const items = [
      tire({ id: 'summer', width: 205, season: 's' }),
      tire({ id: 'winter', width: 205, season: 'w' }),
    ];
    const memory = createCategoryMemory(items, 'tires');
    const results = filterIndexedItems(
      memory.items,
      memory.indexMaps,
      { season: 's', width: 205 },
      TIRE_SEARCH_INDEX_HINTS,
      matchesTireSearchFilters
    );
    expect(results.map((item) => item.id)).toEqual(['summer']);
  });

  test('компактные facet-rows схлопывают дубли размеров', () => {
    const items = [
      tire({ id: '1', brand: 'Ikon' }),
      tire({ id: '2', brand: 'Ikon' }),
      tire({ id: '3', brand: 'Nokian' }),
    ];
    const memory = createCategoryMemory(items, 'tires');
    expect(memory.items).toHaveLength(3);
    expect(memory.facetRows).toHaveLength(2);
  });
});
