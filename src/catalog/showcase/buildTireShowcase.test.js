import { SHOWCASE_CONFIG } from './showcaseConfig';
import { buildTireShowcase } from './buildTireShowcase';

const mk = (over) => ({
  id: over.id,
  brand: over.brand ?? 'Brand',
  title: over.title ?? `Tire ${over.id}`,
  model: over.model ?? 'Model',
  width: over.width ?? 205,
  profile: over.profile ?? 55,
  diameter: over.diameter ?? 'R16',
  amount: over.amount ?? 8,
  photoUrl: 'x',
  sellingPrice: over.sellingPrice ?? 7000,
  season: over.season ?? 's',
  supplier: 'Шинсервис',
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
          diameter: `R${15 + (i % 4)}`,
        });
      }
      return mk({
        id: i + 1,
        brand: `Brand${i}`,
        title: `Brand${i} Model${i} 91V`,
        model: `Model${i}`,
        season: 's',
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
    expect(result.shelves[0].items).toHaveLength(30);
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
