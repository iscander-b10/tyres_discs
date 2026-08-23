import { mergePreferredShowcaseCandidates } from './preferredCandidates';
import { pickMixedSeasonHits } from './ikonSeasonHits';
import { SHOWCASE_CONFIG } from './showcaseConfig';
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

describe('preferred Ikon candidates', () => {
  test('merge puts Ikon first and keeps them even past limit', () => {
    const preferred = [
      mk({ id: 1, title: 'Ikon Character Eco 91H' }),
      mk({ id: 2, title: 'Ikon Autograph Aqua 3 94V', diameter: 'R17' }),
    ];
    const others = Array.from({ length: 20 }, (_, i) =>
      mk({
        id: 100 + i,
        brand: `Brand${i}`,
        title: `Brand${i} Model${i} 91V`,
        model: `Model${i}`,
      })
    );

    const merged = mergePreferredShowcaseCandidates(preferred, others, 5);
    expect(merged.slice(0, 2).map((i) => i.id)).toEqual([1, 2]);
    expect(merged).toHaveLength(5);
    expect(merged.filter((i) => i.brand === 'Ikon')).toHaveLength(2);
  });

  test('Ikon buried after 480 others still reach summer/winter shelf', () => {
    const buriedIkon = [
      mk({
        id: 901,
        title: 'Ikon Character Eco 91H',
        season: 's',
        diameter: 'R15',
      }),
      mk({
        id: 902,
        title: 'Ikon Autograph Eco 3 91V',
        season: 's',
        diameter: 'R16',
      }),
      mk({
        id: 903,
        title: 'Ikon Autograph Aqua 3 94V',
        season: 's',
        diameter: 'R17',
      }),
      mk({
        id: 904,
        title: 'Ikon Character Aqua 91V',
        season: 's',
        diameter: 'R18',
      }),
    ];
    const frontOthers = Array.from({ length: 500 }, (_, i) =>
      mk({
        id: i + 1,
        brand: `Other${i}`,
        title: `Other${i} Model${i} 91V`,
        model: `Model${i}`,
        season: 's',
      })
    );

    const candidates = mergePreferredShowcaseCandidates(
      buriedIkon,
      frontOthers,
      480
    );
    expect(candidates.slice(0, 4).every((i) => i.brand === 'Ikon')).toBe(true);
    expect(candidates).toHaveLength(480);

    const summer = buildTireShowcase({
      candidates,
      isEmpty: false,
      now: new Date('2026-06-15'),
    });
    const sIkon = summer.shelves[0].items.filter((i) => i.brand === 'Ikon');
    expect(sIkon.length).toBeGreaterThanOrEqual(4);
    expect(new Set(sIkon.map((i) => i.title)).size).toBe(sIkon.length);

    const winterIkon = [
      mk({
        id: 911,
        title: 'Ikon Character Ice 8 95T',
        season: 'w',
        spikes: true,
        diameter: 'R15',
      }),
      mk({
        id: 912,
        title: 'Ikon Character Ice 7 99T',
        season: 'w',
        spikes: true,
        diameter: 'R16',
      }),
      mk({
        id: 913,
        title: 'Ikon Character Snow 2 94R',
        season: 'w',
        spikes: false,
        diameter: 'R17',
      }),
      mk({
        id: 914,
        title: 'Ikon Autograph Ice 9 94T',
        season: 'w',
        spikes: true,
        diameter: 'R18',
      }),
    ];
    const winterOthers = Array.from({ length: 500 }, (_, i) =>
      mk({
        id: 2000 + i,
        brand: `WOther${i}`,
        title: `WOther${i} WModel${i} 95T`,
        model: `WModel${i}`,
        season: 'w',
        spikes: i % 2 === 0,
      })
    );
    const winterCandidates = mergePreferredShowcaseCandidates(
      winterIkon,
      winterOthers,
      480
    );
    const winter = buildTireShowcase({
      candidates: winterCandidates,
      isEmpty: false,
      now: new Date('2026-01-15'),
    });
    const wIkon = winter.shelves[0].items.filter((i) => i.brand === 'Ikon');
    expect(wIkon).toHaveLength(4);
    expect(new Set(wIkon.map((i) => i.diameter)).size).toBe(4);
  });

  test('summer/winter mix still unique models then size spread (existing whitelist)', () => {
    const summerPool = [
      mk({ id: 1, title: 'Ikon Character Eco 91H', diameter: 'R15' }),
      mk({ id: 2, title: 'Ikon Character Eco 91H', diameter: 'R16' }),
      mk({ id: 3, title: 'Ikon Autograph Eco 3 91V', diameter: 'R17' }),
      mk({ id: 4, title: 'Ikon Autograph Aqua 3 94V', diameter: 'R18' }),
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
        diameter: 'R17',
      }),
    ];
    const mixed = pickMixedSeasonHits({
      pool: summerPool,
      season: 's',
      limit: 6,
      whitelist: summerWl,
    });
    expect(mixed.some((i) => i.brand === 'Ikon')).toBe(true);
    expect(mixed.some((i) => i.brand !== 'Ikon')).toBe(true);
    expect(mixed.filter((i) => /Character Eco/i.test(i.title))).toHaveLength(1);

    const winterPool = [
      mk({
        id: 21,
        title: 'Ikon Character Ice 8 95T',
        season: 'w',
        spikes: true,
        diameter: 'R15',
      }),
      mk({
        id: 22,
        title: 'Ikon Character Ice 8 95T',
        season: 'w',
        spikes: true,
        diameter: 'R16',
      }),
      mk({
        id: 23,
        title: 'Ikon Character Ice 7 99T',
        season: 'w',
        spikes: true,
        diameter: 'R17',
      }),
      mk({
        id: 30,
        brand: 'Gislaved',
        title: 'Gislaved Nord Frost 95T',
        model: 'Nord Frost',
        season: 'w',
        spikes: true,
      }),
    ];
    const winterMixed = pickMixedSeasonHits({
      pool: winterPool,
      season: 'w',
      limit: 6,
      whitelist: winterWl,
    });
    expect(winterMixed.filter((i) => /Character Ice 8/i.test(i.title))).toHaveLength(
      1
    );
    expect(winterMixed.some((i) => i.brand === 'Ikon')).toBe(true);
    expect(winterMixed.some((i) => i.brand === 'Gislaved')).toBe(true);
  });
});
