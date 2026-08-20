import { SHOWCASE_CONFIG } from './showcaseConfig';
import {
  resolveIkonSeasonModelKey,
  isExcludedIkonModel,
  ikonSlotsForLimit,
  pickMixedSeasonHits,
} from './ikonSeasonHits';
import { buildTireShowcase } from './buildTireShowcase';

const summerWl = SHOWCASE_CONFIG.tires.ikonSeasonModelsSummer;
const winterWl = SHOWCASE_CONFIG.tires.ikonSeasonModelsWinter;

const mk = (over) => ({
  id: over.id,
  brand: over.brand ?? 'Ikon',
  title: over.title,
  model: over.model,
  width: over.width ?? 205,
  profile: over.profile ?? 55,
  diameter: over.diameter ?? 'R16',
  amount: over.amount ?? 8,
  photoUrl: 'x',
  sellingPrice: over.sellingPrice ?? 7000,
  season: over.season ?? 's',
  spikes: over.spikes,
  supplier: 'Шинсервис',
  ...over,
});

describe('ikon season shelf', () => {
  test('matcher whitelist + exclusions', () => {
    expect(
      resolveIkonSeasonModelKey(mk({ title: 'Ikon Character Eco 91H' }), summerWl)
    ).toBe('Character Eco');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Autograph Eco 3 91V' }),
        summerWl
      )
    ).toBe('Autograph Eco 3');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Autograph Eco C3 104/102R' }),
        summerWl
      )
    ).toBeNull();
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Autograph Aqua 3 SUV 109V' }),
        summerWl
      )
    ).toBeNull();
    expect(isExcludedIkonModel('Character Eco SUV')).toBe(true);
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Character Ice 8 95T', season: 'w' }),
        winterWl
      )
    ).toBe('Character Ice 8');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Nordman 7 99T', season: 'w' }),
        winterWl
      )
    ).toBe('Nordman 7');
  });

  test('slot formula ~1/3', () => {
    expect(ikonSlotsForLimit(12)).toBe(4);
    expect(ikonSlotsForLimit(15)).toBe(5);
    expect(ikonSlotsForLimit(18)).toBe(6);
  });

  test('summer mix: unique Ikon ~1/3, no C3/SUV, fill others', () => {
    const summerPool = [
      mk({ id: 1, title: 'Ikon Character Eco 91H', diameter: 'R15' }),
      mk({ id: 2, title: 'Ikon Character Eco 91H', diameter: 'R16' }),
      mk({ id: 3, title: 'Ikon Autograph Eco 3 91V', diameter: 'R17' }),
      mk({ id: 4, title: 'Ikon Autograph Aqua 3 94V', diameter: 'R18' }),
      mk({ id: 5, title: 'Ikon Character Aqua 91V', diameter: 'R16' }),
      mk({ id: 6, title: 'Ikon Character Ultra 94W', diameter: 'R17' }),
      mk({ id: 7, title: 'Ikon Autograph Ultra 2 94W', diameter: 'R18' }),
      mk({ id: 8, title: 'Ikon Autograph Eco C3 104R', model: 'Autograph Eco C3' }),
      mk({
        id: 10,
        brand: 'Michelin',
        title: 'Michelin Primacy 4 91V',
        model: 'Primacy 4',
      }),
      mk({
        id: 11,
        brand: 'Michelin',
        title: 'Michelin Primacy 4 94V',
        model: 'Primacy 4',
        diameter: 'R17',
      }),
      mk({
        id: 12,
        brand: 'Pirelli',
        title: 'Pirelli Cinturato P7 91V',
        model: 'Cinturato P7',
      }),
      mk({
        id: 13,
        brand: 'Continental',
        title: 'Continental PremiumContact 6 91V',
        model: 'PremiumContact 6',
      }),
      mk({
        id: 14,
        brand: 'Nokian Tyres',
        title: 'Nokian Tyres Hakka Blue 3 91V',
        model: 'Hakka Blue 3',
      }),
      mk({
        id: 15,
        brand: 'Gislaved',
        title: 'Gislaved UltraSpeed 2 91V',
        model: 'UltraSpeed 2',
      }),
      mk({
        id: 16,
        brand: 'Formula',
        title: 'Formula Energy 91V',
        model: 'Energy',
      }),
      mk({
        id: 17,
        brand: 'Torero',
        title: 'Torero MP47 91V',
        model: 'MP47',
      }),
      mk({
        id: 18,
        brand: 'Bridgestone',
        title: 'Bridgestone Turanza T005 91V',
        model: 'Turanza T005',
      }),
      mk({
        id: 19,
        brand: 'Goodyear',
        title: 'Goodyear EfficientGrip 91V',
        model: 'EfficientGrip',
      }),
      mk({
        id: 20,
        brand: 'Hankook',
        title: 'Hankook Ventus Prime 91V',
        model: 'Ventus Prime',
      }),
      mk({
        id: 21,
        brand: 'Yokohama',
        title: 'Yokohama BlueEarth 91V',
        model: 'BlueEarth',
      }),
      mk({
        id: 22,
        brand: 'Toyo',
        title: 'Toyo Proxes 91V',
        model: 'Proxes',
      }),
    ];

    const mixed = pickMixedSeasonHits({
      pool: summerPool,
      season: 's',
      limit: 15,
      whitelist: summerWl,
    });
    expect(mixed).toHaveLength(15);
    expect(mixed.filter((i) => i.brand === 'Ikon')).toHaveLength(5);
    expect(mixed.some((i) => /Eco C3|SUV/i.test(i.title))).toBe(false);
    expect(mixed.filter((i) => /Character Eco/i.test(i.title))).toHaveLength(1);

    const fewIkon = pickMixedSeasonHits({
      pool: summerPool.filter(
        (i) => i.brand !== 'Ikon' || /Character Eco/i.test(i.title)
      ),
      season: 's',
      limit: 12,
      whitelist: summerWl,
    });
    expect(fewIkon).toHaveLength(12);
    expect(fewIkon.filter((i) => i.brand === 'Ikon')).toHaveLength(1);
  });

  test('buildTireShowcase summer/winter same shelf shape and quota', () => {
    const summerPool = Array.from({ length: 24 }, (_, i) => {
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

    const summer = buildTireShowcase({
      candidates: summerPool,
      isEmpty: false,
      now: new Date('2026-06-15'),
    });
    expect(summer.season).toBe('s');
    expect(summer.shelves).toHaveLength(1);
    expect(summer.shelves[0].id).toBe('season-hits');
    expect(summer.shelves[0].title).toBe('Сейчас в сезоне');
    const sItems = summer.shelves[0].items;
    expect(sItems.length).toBeGreaterThanOrEqual(12);
    expect(sItems.length).toBeLessThanOrEqual(18);
    expect(sItems.filter((i) => i.brand === 'Ikon')).toHaveLength(
      Math.round(sItems.length / 3)
    );

    const winterPool = [
      mk({
        id: 101,
        title: 'Ikon Character Ice 8 95T',
        season: 'w',
        spikes: true,
      }),
      mk({
        id: 102,
        title: 'Ikon Character Ice 7 99T',
        season: 'w',
        spikes: true,
        diameter: 'R15',
      }),
      mk({
        id: 103,
        title: 'Ikon Character Snow 2 94R',
        season: 'w',
        spikes: false,
        diameter: 'R17',
      }),
      mk({
        id: 104,
        title: 'Ikon Nordman 5 94T',
        season: 'w',
        spikes: true,
      }),
      ...Array.from({ length: 16 }, (_, i) =>
        mk({
          id: 200 + i,
          brand: `WBrand${i}`,
          title: `WBrand${i} WModel${i} 95T`,
          model: `WModel${i}`,
          season: 'w',
          spikes: i % 2 === 0,
        })
      ),
    ];

    const winter = buildTireShowcase({
      candidates: winterPool,
      isEmpty: false,
      now: new Date('2026-01-15'),
    });
    expect(winter.season).toBe('w');
    expect(winter.shelves).toHaveLength(1);
    expect(winter.shelves[0].title).toBe('Сейчас в сезоне');
    const wItems = winter.shelves[0].items;
    expect(wItems.length).toBeGreaterThanOrEqual(12);
    expect(wItems.length).toBeLessThanOrEqual(18);
    // В моке только 4 уникальных Ikon — квота ≤⅓, дырки добираются others.
    const wIkon = wItems.filter((i) => i.brand === 'Ikon');
    expect(wIkon.length).toBe(4);
    expect(wIkon.length).toBeLessThanOrEqual(Math.round(wItems.length / 3));
  });
});
