import { SHOWCASE_CONFIG } from './showcaseConfig';
import {
  resolveIkonSeasonModelKey,
  isExcludedIkonModel,
  pickMixedSeasonHits,
  spreadPreferredItems,
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
    expect(isExcludedIkonModel('Nordman 7')).toBe(true);
    expect(isExcludedIkonModel('Nordman RS2')).toBe(true);
    expect(isExcludedIkonModel('Character Eco C2')).toBe(true);
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Character Ice 8 95T', season: 'w' }),
        winterWl
      )
    ).toBe('Character Ice 8');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Character Snow 2 94R', season: 'w' }),
        winterWl
      )
    ).toBe('Character Snow 2');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Autograph Snow 5 94T', season: 'w' }),
        winterWl
      )
    ).toBe('Autograph Snow 5');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Autograph Ice 10 95T', season: 'w' }),
        winterWl
      )
    ).toBe('Autograph Ice 10');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Autograph Snow 3 94T', season: 'w' }),
        winterWl
      )
    ).toBe('Autograph Snow 3');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Nordman 7 99T', season: 'w' }),
        winterWl
      )
    ).toBeNull();
    expect(
      resolveIkonSeasonModelKey(
        mk({
          title: 'Ikon Character Eco (Nordman SX3) 91H',
          model: 'Character Eco (Nordman SX3)',
        }),
        summerWl
      )
    ).toBe('Character Eco');
    expect(
      resolveIkonSeasonModelKey(
        mk({
          title: 'Ikon Character Ultra (Nordman SZ2) 94W',
          model: 'Character Ultra (Nordman SZ2)',
        }),
        summerWl
      )
    ).toBe('Character Ultra');
    expect(
      resolveIkonSeasonModelKey(
        mk({
          title: 'Ikon Character Ice 8 (Nordman 8) 95T',
          model: 'Character Ice 8 (Nordman 8)',
          season: 'w',
        }),
        winterWl
      )
    ).toBe('Character Ice 8');
    expect(
      resolveIkonSeasonModelKey(
        mk({
          title: 'Ikon Character Snow 2 (Nordman RS2) 94R',
          model: 'Character Snow 2 (Nordman RS2)',
          season: 'w',
        }),
        winterWl
      )
    ).toBe('Character Snow 2');
    expect(
      resolveIkonSeasonModelKey(
        mk({
          title: 'Ikon Nordman SX3 (Character Eco) 91H',
          model: 'Nordman SX3 (Character Eco)',
        }),
        summerWl
      )
    ).toBeNull();
    expect(
      resolveIkonSeasonModelKey(
        mk({
          title: 'Ikon Character Aqua SUV (Nordman S2 SUV) 109V',
          model: 'Character Aqua SUV (Nordman S2 SUV)',
        }),
        summerWl
      )
    ).toBeNull();
  });

  test('Character Eco C2 does not match Character Eco; plain Eco does', () => {
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Character Eco C2 91H' }),
        summerWl
      )
    ).toBeNull();
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Character Eco C2', model: 'Character Eco C2' }),
        summerWl
      )
    ).toBeNull();
    expect(
      resolveIkonSeasonModelKey(mk({ title: 'Ikon Character Eco 91H' }), summerWl)
    ).toBe('Character Eco');
    expect(
      resolveIkonSeasonModelKey(
        mk({ title: 'Ikon Character Eco', model: 'Character Eco' }),
        summerWl
      )
    ).toBe('Character Eco');
  });

  test('spreadPreferredItems breaks adjacent Ikon when others exist', () => {
    const items = [
      mk({ id: 1, title: 'Ikon Character Eco 91H' }),
      mk({ id: 2, title: 'Ikon Autograph Eco 3 91V' }),
      mk({ id: 3, title: 'Ikon Autograph Aqua 3 94V' }),
      mk({
        id: 10,
        brand: 'Michelin',
        title: 'Michelin Primacy 4 91V',
        model: 'Primacy 4',
      }),
      mk({
        id: 11,
        brand: 'Pirelli',
        title: 'Pirelli Cinturato P7 91V',
        model: 'Cinturato P7',
      }),
      mk({
        id: 12,
        brand: 'Continental',
        title: 'Continental PremiumContact 6 91V',
        model: 'PremiumContact 6',
      }),
    ];
    const spread = spreadPreferredItems(items, (item) => item.brand === 'Ikon');
    for (let i = 1; i < spread.length; i += 1) {
      expect(
        spread[i - 1].brand === 'Ikon' && spread[i].brand === 'Ikon'
      ).toBe(false);
    }
    expect(spread.filter((i) => i.brand === 'Ikon')).toHaveLength(3);
  });

  test('seeded pickMixedSeasonHits / buildTireShowcase: same seed → same order', () => {
    const summerPool = [
      mk({ id: 1, title: 'Ikon Character Eco 91H', diameter: 'R15' }),
      mk({ id: 2, title: 'Ikon Autograph Eco 3 91V', diameter: 'R17' }),
      mk({ id: 3, title: 'Ikon Autograph Aqua 3 94V', diameter: 'R18' }),
      mk({ id: 4, title: 'Ikon Character Aqua 91V', diameter: 'R16' }),
      mk({ id: 5, title: 'Ikon Character Ultra 94W', diameter: 'R17' }),
      mk({ id: 6, title: 'Ikon Autograph Ultra 2 94W', diameter: 'R18' }),
      ...Array.from({ length: 24 }, (_, i) =>
        mk({
          id: 100 + i,
          brand: `Brand${i}`,
          title: `Brand${i} Model${i} 91V`,
          model: `Model${i}`,
        })
      ),
    ];

    const a = pickMixedSeasonHits({
      pool: summerPool,
      season: 's',
      limit: 30,
      whitelist: summerWl,
      seed: 'snap-v1',
    });
    const b = pickMixedSeasonHits({
      pool: summerPool,
      season: 's',
      limit: 30,
      whitelist: summerWl,
      seed: 'snap-v1',
    });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));

    const c = pickMixedSeasonHits({
      pool: summerPool,
      season: 's',
      limit: 30,
      whitelist: summerWl,
      seed: 'snap-v2',
    });
    expect([...c.map((i) => i.id)].sort()).toEqual([...a.map((i) => i.id)].sort());
    expect(c.map((i) => i.id)).not.toEqual(a.map((i) => i.id));

    const shelfA = buildTireShowcase({
      candidates: summerPool,
      isEmpty: false,
      now: new Date('2026-06-15'),
      seed: 'workspace|snap:2026-08-24T12:10:00Z',
    });
    const shelfB = buildTireShowcase({
      candidates: summerPool,
      isEmpty: false,
      now: new Date('2026-06-15'),
      seed: 'workspace|snap:2026-08-24T12:10:00Z',
    });
    expect(shelfA.shelves[0].items.map((i) => i.id)).toEqual(
      shelfB.shelves[0].items.map((i) => i.id)
    );
  });

  test('winter whitelist has 8 models without Snow Pro', () => {
    expect(winterWl).toHaveLength(8);
    expect(winterWl).toContain('Autograph Ice 10');
    expect(winterWl).toContain('Autograph Snow 3');
    expect(winterWl).toContain('Autograph Snow 5');
    expect(winterWl.some((m) => /pro/i.test(m))).toBe(false);
    expect(summerWl).toHaveLength(6);
  });

  test('summer mix: all whitelist Ikon + others up to limit, shuffled', () => {
    const summerPool = [
      mk({ id: 1, title: 'Ikon Character Eco 91H', diameter: 'R15' }),
      mk({ id: 2, title: 'Ikon Character Eco 91H', diameter: 'R16' }),
      mk({ id: 3, title: 'Ikon Autograph Eco 3 91V', diameter: 'R17' }),
      mk({ id: 4, title: 'Ikon Autograph Aqua 3 94V', diameter: 'R18' }),
      mk({ id: 5, title: 'Ikon Character Aqua 91V', diameter: 'R16' }),
      mk({ id: 6, title: 'Ikon Character Ultra 94W', diameter: 'R17' }),
      mk({ id: 7, title: 'Ikon Autograph Ultra 2 94W', diameter: 'R18' }),
      mk({ id: 8, title: 'Ikon Autograph Eco C3 104R', model: 'Autograph Eco C3' }),
      mk({ id: 9, title: 'Ikon Character Eco C2 91H', model: 'Character Eco C2' }),
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
      limit: 30,
      whitelist: summerWl,
      seed: 'test-summer-mix',
    });
    // 6 unique Ikon whitelist + 12 unique others (Michelin collapsed) = 18
    expect(mixed).toHaveLength(18);
    expect(mixed.filter((i) => i.brand === 'Ikon')).toHaveLength(6);
    expect(mixed.some((i) => i.brand !== 'Ikon')).toBe(true);
    expect(mixed.some((i) => /Eco C3|Eco C2|SUV/i.test(i.title))).toBe(false);
    expect(mixed.filter((i) => /Character Eco/i.test(i.title))).toHaveLength(1);
    // Ikon могут стоять подряд — порядок только от seed, без spreadPreferredItems

    const aliased = pickMixedSeasonHits({
      pool: [
        mk({
          id: 31,
          title: 'Ikon Character Eco (Nordman SX3) 91H',
          model: 'Character Eco (Nordman SX3)',
          diameter: 'R15',
        }),
        mk({
          id: 32,
          title: 'Ikon Character Ultra (Nordman SZ2) 94W',
          model: 'Character Ultra (Nordman SZ2)',
          diameter: 'R17',
        }),
        mk({ id: 33, title: 'Ikon Autograph Eco 3 91V', diameter: 'R16' }),
        mk({
          id: 34,
          brand: 'Michelin',
          title: 'Michelin Primacy 4 91V',
          model: 'Primacy 4',
        }),
        mk({
          id: 35,
          brand: 'Pirelli',
          title: 'Pirelli Cinturato P7 91V',
          model: 'Cinturato P7',
        }),
      ],
      season: 's',
      limit: 30,
      whitelist: summerWl,
      seed: 'test-aliased',
    });
    expect(aliased.filter((i) => i.brand === 'Ikon')).toHaveLength(3);
    expect(aliased.some((i) => /Character Eco/i.test(i.model || i.title))).toBe(
      true
    );
    expect(aliased.some((i) => /Character Ultra/i.test(i.model || i.title))).toBe(
      true
    );
    expect(aliased.some((i) => i.brand !== 'Ikon')).toBe(true);

    const fewIkon = pickMixedSeasonHits({
      pool: summerPool.filter(
        (i) => i.brand !== 'Ikon' || /Character Eco 91H/i.test(i.title)
      ),
      season: 's',
      limit: 30,
      whitelist: summerWl,
    });
    expect(fewIkon.filter((i) => i.brand === 'Ikon')).toHaveLength(1);
    expect(fewIkon.some((i) => i.brand !== 'Ikon')).toBe(true);
    expect(fewIkon.length).toBeGreaterThan(1);
  });

  test('does not pad with extra Ikon when others exist but are short', () => {
    const pool = [
      mk({ id: 1, title: 'Ikon Character Eco 91H' }),
      mk({ id: 2, title: 'Ikon Autograph Eco 3 91V', diameter: 'R17' }),
      mk({
        id: 10,
        brand: 'Michelin',
        title: 'Michelin Primacy 4 91V',
        model: 'Primacy 4',
      }),
      // Non-whitelist Ikon must not fill remaining slots while others exist
      mk({ id: 99, title: 'Ikon Character SomeOther 91H', model: 'Character SomeOther' }),
    ];
    const mixed = pickMixedSeasonHits({
      pool,
      season: 's',
      limit: 30,
      whitelist: summerWl,
    });
    expect(mixed.filter((i) => i.brand === 'Ikon')).toHaveLength(2);
    expect(mixed.some((i) => i.brand === 'Michelin')).toBe(true);
    expect(mixed.some((i) => /SomeOther/i.test(i.title))).toBe(false);
    expect(mixed).toHaveLength(3);
  });

  test('buildTireShowcase summer/winter target 30 with mix', () => {
    const summerPool = Array.from({ length: 40 }, (_, i) => {
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
    expect(sItems).toHaveLength(30);
    expect(sItems.filter((i) => i.brand === 'Ikon')).toHaveLength(6);
    expect(sItems.some((i) => i.brand !== 'Ikon')).toBe(true);

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
        title: 'Ikon Autograph Ice 9 94T',
        season: 'w',
        spikes: true,
      }),
      mk({
        id: 105,
        title: 'Ikon Autograph Ice 10 95T',
        season: 'w',
        spikes: true,
        diameter: 'R18',
      }),
      mk({
        id: 106,
        title: 'Ikon Autograph Snow 3 94T',
        season: 'w',
        spikes: false,
        diameter: 'R15',
      }),
      ...Array.from({ length: 28 }, (_, i) =>
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
    expect(wItems).toHaveLength(30);
    const wIkon = wItems.filter((i) => i.brand === 'Ikon');
    expect(wIkon.length).toBe(6);
    expect(wItems.some((i) => i.brand !== 'Ikon')).toBe(true);
  });
});
