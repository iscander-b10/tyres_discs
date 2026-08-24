import { mergePreferredShowcaseCandidates } from './mergePreferredShowcaseCandidates';

const mk = (over) => ({
  id: over.id,
  brand: over.brand ?? 'Ikon',
  title: over.title ?? `Item ${over.id}`,
  ...over,
});

describe('mergePreferredShowcaseCandidates', () => {
  test('preferred впереди', () => {
    const preferred = [
      mk({ id: 1, title: 'Ikon A' }),
      mk({ id: 2, title: 'Ikon B' }),
    ];
    const others = Array.from({ length: 10 }, (_, i) =>
      mk({ id: 100 + i, brand: `Brand${i}` })
    );

    const merged = mergePreferredShowcaseCandidates(preferred, others, 5);
    expect(merged.slice(0, 2).map((item) => item.id)).toEqual([1, 2]);
  });

  test('preferred не режутся лимитом', () => {
    const preferred = Array.from({ length: 8 }, (_, i) =>
      mk({ id: i + 1 })
    );
    const others = Array.from({ length: 10 }, (_, i) =>
      mk({ id: 100 + i, brand: `Brand${i}` })
    );

    const merged = mergePreferredShowcaseCandidates(preferred, others, 5);
    expect(merged.filter((item) => item.brand === 'Ikon')).toHaveLength(8);
  });

  test('others добивают до limit', () => {
    const preferred = [
      mk({ id: 1 }),
      mk({ id: 2 }),
    ];
    const others = Array.from({ length: 20 }, (_, i) =>
      mk({ id: 100 + i, brand: `Brand${i}` })
    );

    const merged = mergePreferredShowcaseCandidates(preferred, others, 5);
    expect(merged).toHaveLength(5);
    expect(merged.filter((item) => item.brand !== 'Ikon')).toHaveLength(3);
  });
});
