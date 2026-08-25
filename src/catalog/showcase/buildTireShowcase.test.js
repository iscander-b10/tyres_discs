import { SHOWCASE_CONFIG, isPopularTireSize } from './showcaseConfig';
import { buildTireShowcase } from './buildTireShowcase';

const popularSizeOf = (index = 0) => {
  const size =
    SHOWCASE_CONFIG.tires.popularSizes[
      index % SHOWCASE_CONFIG.tires.popularSizes.length
    ];
  return {
    width: size.width,
    profile: size.profile,
    diameter: size.diameter,
  };
};

const mk = (over) => ({
  id: over.id,
  brand: over.brand ?? 'Brand',
  title: over.title ?? `Tire ${over.id}`,
  amount: over.amount ?? 8,
  photoUrl: 'x',
  sellingPrice: over.sellingPrice ?? 7000,
  season: over.season ?? 's',
  supplier: 'Шинсервис',
  ...popularSizeOf(0),
  ...over,
});

describe('buildTireShowcase season shelf', () => {
  test('December: only summer in-stock → no season shelf, chips remain', () => {
    const result = buildTireShowcase({
      candidates: [
        mk({ id: 1, season: 's' }),
        mk({ id: 2, season: 's', brand: 'Michelin', title: 'Michelin Pilot' }),
      ],
      isEmpty: false,
      now: new Date('2026-12-15'),
    });

    expect(result.season).toBe('w');
    expect(result.empty).toBe(false);
    expect(result.shelves).toEqual([]);
    expect(result.chips).toEqual(SHOWCASE_CONFIG.tires.popularSizes);
    expect(result.chipsTitle).toBe(SHOWCASE_CONFIG.copy.popularSizes);
  });

  test('June: only winter in-stock → no season shelf, chips remain', () => {
    const result = buildTireShowcase({
      candidates: [
        mk({ id: 1, season: 'w' }),
        mk({ id: 2, season: 'w', brand: 'Nokian', title: 'Nokian Hakkapeliitta' }),
      ],
      isEmpty: false,
      now: new Date('2026-06-15'),
    });

    expect(result.season).toBe('s');
    expect(result.empty).toBe(false);
    expect(result.shelves).toEqual([]);
    expect(result.chips).toEqual(SHOWCASE_CONFIG.tires.popularSizes);
  });

  test('current season in stock → «Сейчас в сезоне» shelf as before', () => {
    const candidates = Array.from({ length: 40 }, (_, i) => {
      if (i < 6) {
        const titles = [
          'Ikon Character Eco 91H',
          'Ikon Autograph Eco 3 91V',
          'Ikon Autograph Aqua 3 94V',
          'Ikon Character Aqua 91V',
          'Ikon Character Ultra 94W',
          'Ikon Autograph Ultra 2 94W',
        ];
        return mk({
          id: i + 1,
          brand: 'Ikon',
          title: titles[i],
          season: 's',
          ...popularSizeOf(i),
        });
      }
      return mk({
        id: i + 1,
        brand: `Brand${i}`,
        title: `Brand${i} Model${i} 91V`,
        model: `Model${i}`,
        season: 's',
        ...popularSizeOf(i),
      });
    });

    const result = buildTireShowcase({
      candidates,
      isEmpty: false,
      now: new Date('2026-06-15'),
    });

    expect(result.season).toBe('s');
    expect(result.empty).toBe(false);
    expect(result.shelves).toHaveLength(1);
    expect(result.shelves[0].id).toBe('season-hits');
    expect(result.shelves[0].title).toBe('Сейчас в сезоне');
    expect(result.shelves[0].items).toHaveLength(25);
    expect(result.chips).toEqual(SHOWCASE_CONFIG.tires.popularSizes);
  });

  test('amount < 4 не попадает на полку (нужен комплект)', () => {
    const result = buildTireShowcase({
      candidates: [
        mk({ id: 1, season: 's', amount: 3, brand: 'Michelin', title: 'Michelin Pilot', model: 'Pilot' }),
        mk({ id: 2, season: 's', amount: 4, brand: 'Continental', title: 'Continental Premium', model: 'Premium' }),
      ],
      isEmpty: false,
      now: new Date('2026-06-15'),
    });

    expect(result.shelves).toHaveLength(1);
    expect(result.shelves[0].items).toHaveLength(1);
    expect(result.shelves[0].items[0].id).toBe(2);
  });

  test('на полку только частые размеры; редкий не проходит даже у Ikon', () => {
    const rare = {
      width: 245,
      profile: 45,
      diameter: 'R18',
    };
    expect(isPopularTireSize(rare)).toBe(false);

    const result = buildTireShowcase({
      candidates: [
        mk({
          id: 1,
          brand: 'Ikon',
          title: 'Ikon Character Eco 91H',
          amount: 20,
          sellingPrice: 5000,
          ...rare,
        }),
        mk({
          id: 2,
          brand: 'Michelin',
          title: 'Michelin Primacy 4 91V',
          model: 'Primacy 4',
          amount: 4,
          ...popularSizeOf(0),
        }),
        mk({
          id: 3,
          brand: 'Pirelli',
          title: 'Pirelli Cinturato P7 91V',
          model: 'Cinturato P7',
          ...popularSizeOf(1),
        }),
      ],
      isEmpty: false,
      now: new Date('2026-06-15'),
    });

    const ids = result.shelves[0].items.map((item) => item.id);
    expect(ids).not.toContain(1);
    expect(ids).toEqual(expect.arrayContaining([2, 3]));
    expect(
      result.shelves[0].items.every((item) => isPopularTireSize(item))
    ).toBe(true);
  });

  test('у одной модели на полку идёт частый размер, не редкий с лучшим score', () => {
    const result = buildTireShowcase({
      candidates: [
        mk({
          id: 10,
          brand: 'Ikon',
          title: 'Ikon Character Eco 91H',
          amount: 40,
          sellingPrice: 4000,
          width: 245,
          profile: 45,
          diameter: 'R18',
        }),
        mk({
          id: 11,
          brand: 'Ikon',
          title: 'Ikon Character Eco 91H',
          amount: 4,
          sellingPrice: 9000,
          ...popularSizeOf(6),
        }),
        mk({
          id: 20,
          brand: 'Continental',
          title: 'Continental Premium 91V',
          model: 'Premium',
          ...popularSizeOf(2),
        }),
      ],
      isEmpty: false,
      now: new Date('2026-06-15'),
    });

    const eco = result.shelves[0].items.filter((item) =>
      /Character Eco/i.test(item.title)
    );
    expect(eco).toHaveLength(1);
    expect(eco[0].id).toBe(11);
  });

  test('только редкие размеры сезона → полки нет, чипы остаются', () => {
    const result = buildTireShowcase({
      candidates: [
        mk({
          id: 1,
          season: 's',
          brand: 'Michelin',
          title: 'Michelin Pilot',
          model: 'Pilot',
          width: 245,
          profile: 45,
          diameter: 'R18',
        }),
      ],
      isEmpty: false,
      now: new Date('2026-06-15'),
    });

    expect(result.empty).toBe(false);
    expect(result.shelves).toEqual([]);
    expect(result.chips).toEqual(SHOWCASE_CONFIG.tires.popularSizes);
  });

  test('isEmpty: true → catalog empty state, not «no season»', () => {
    const result = buildTireShowcase({
      candidates: [mk({ id: 1, season: 's' })],
      isEmpty: true,
      now: new Date('2026-06-15'),
    });

    expect(result.empty).toBe(true);
    expect(result.season).toBe('s');
    expect(result.shelves).toEqual([]);
    expect(result.chips).toEqual(SHOWCASE_CONFIG.tires.popularSizes);
  });
});
