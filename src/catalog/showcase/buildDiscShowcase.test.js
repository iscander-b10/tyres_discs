import { SHOWCASE_CONFIG } from './showcaseConfig';
import { buildDiscShowcase } from './buildDiscShowcase';
import { shuffleItems } from './showcaseSeed';

const mk = (over) => ({
  id: over.id,
  brand: over.brand ?? 'Replay',
  title: over.title ?? `Disc ${over.id}`,
  model: over.model ?? `Model${over.id}`,
  diameter: over.diameter ?? 'R16',
  amount: over.amount ?? 8,
  photoUrl: 'x',
  sellingPrice: over.sellingPrice ?? 9000,
  diskType: over.diskType ?? SHOWCASE_CONFIG.discs.diskType,
  supplier: over.supplier ?? SHOWCASE_CONFIG.showcaseSupplier,
  ...over,
});

describe('buildDiscShowcase', () => {
  test('пул: только литые Шинсервиса с amount >= minAmount; на полке popularModelsCount; seed стабилен', () => {
    const { minAmount, popularModelsCount, diskType } = SHOWCASE_CONFIG.discs;
    const shelfLimit = popularModelsCount.max;
    const cast = Array.from({ length: 40 }, (_, i) =>
      mk({
        id: `cast-${i}`,
        brand: `Brand${i % 7}`,
        model: `M${i}`,
        diameter: `R${14 + (i % 5)}`,
        amount: minAmount + (i % 3),
      })
    );
    const stamped = Array.from({ length: 10 }, (_, i) =>
      mk({
        id: `stamp-${i}`,
        diskType: 'Штампованный',
        amount: 10,
      })
    );
    const lowStock = mk({ id: 'low', amount: minAmount - 1 });
    const otherSupplier = mk({
      id: 'other-sup',
      supplier: 'Другой',
      amount: 20,
    });

    const candidates = [...cast, ...stamped, lowStock, otherSupplier];
    const a = buildDiscShowcase({
      candidates,
      isEmpty: false,
      seed: 'store-a|snap:v1',
    });
    const b = buildDiscShowcase({
      candidates,
      isEmpty: false,
      seed: 'store-a|snap:v1',
    });

    expect(popularModelsCount).toEqual({ min: 15, max: 15 });
    expect(minAmount).toBe(4);
    expect(diskType).toBe('Литой');
    expect(a.shelves).toHaveLength(1);
    expect(a.shelves[0].id).toBe('popular-models');
    expect(a.shelves[0].title).toBe('Литые диски в наличии');
    expect(a.shelves[0].items).toHaveLength(shelfLimit);
    expect(a.shelves[0].items.every((i) => i.diskType === diskType)).toBe(true);
    expect(a.shelves[0].items.every((i) => i.amount >= minAmount)).toBe(true);
    expect(
      a.shelves[0].items.every(
        (i) => i.supplier === SHOWCASE_CONFIG.showcaseSupplier
      )
    ).toBe(true);
    expect(a.shelves[0].items.some((i) => i.id.startsWith('stamp-'))).toBe(
      false
    );
    expect(a.shelves[0].items.some((i) => i.id === 'low')).toBe(false);
    expect(a.shelves[0].items.some((i) => i.id === 'other-sup')).toBe(false);
    expect(a.shelves[0].items.map((i) => i.id)).toEqual(
      b.shelves[0].items.map((i) => i.id)
    );

    const c = buildDiscShowcase({
      candidates,
      isEmpty: false,
      seed: 'store-a|snap:v2',
    });
    expect(c.shelves[0].items).toHaveLength(shelfLimit);
    expect(c.shelves[0].items.map((i) => i.id)).not.toEqual(
      a.shelves[0].items.map((i) => i.id)
    );
    // тот же набор из пула не обязателен (случайная пятнашка), но все — из cast
    expect(
      c.shelves[0].items.every((i) => String(i.id).startsWith('cast-'))
    ).toBe(true);
  });

  test('пул < popularModelsCount: показать все литые без добивки', () => {
    const candidates = Array.from({ length: 7 }, (_, i) =>
      mk({ id: `few-${i}`, amount: SHOWCASE_CONFIG.discs.minAmount })
    );
    const result = buildDiscShowcase({
      candidates,
      isEmpty: false,
      seed: 'seed',
    });
    expect(result.shelves[0].items).toHaveLength(7);
  });

  test('не использует pickTopDiverse: порядок = seeded shuffle пула', () => {
    const shelfLimit = SHOWCASE_CONFIG.discs.popularModelsCount.max;
    const castPool = Array.from({ length: 20 }, (_, i) =>
      mk({
        id: i + 1,
        brand: 'SameBrand',
        model: `Dup${i}`,
        amount: SHOWCASE_CONFIG.discs.minAmount,
        // низкий score у первых id — pickTopDiverse взял бы «лучшие»
        photoUrl: i < 5 ? null : 'x',
        sellingPrice: i < 5 ? 100 : 9000,
      })
    );
    const seed = 'order-check';
    const expected = shuffleItems(castPool, seed).slice(0, shelfLimit);
    const built = buildDiscShowcase({
      candidates: castPool,
      isEmpty: false,
      seed,
    });
    expect(built.shelves[0].items.map((i) => i.id)).toEqual(
      expected.map((i) => i.id)
    );
  });
});
