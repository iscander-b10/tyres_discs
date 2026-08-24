import { SHOWCASE_CONFIG } from './showcaseConfig';
import { pickTopDiverse, scoreCatalogItem } from './scoring';

const mk = (over = {}) => ({
  id: over.id ?? 1,
  brand: over.brand ?? 'Ikon',
  amount: over.amount ?? 8,
  photoUrl: over.photoUrl === undefined ? 'x' : over.photoUrl,
  sellingPrice: over.sellingPrice === undefined ? 7000 : over.sellingPrice,
  ...over,
});

describe('scoreCatalogItem', () => {
  const { amountHigh, amountLow, weights, priceBand } = SHOWCASE_CONFIG.scoring;

  test('базовый score: amountHigh + photo + brand + price in band', () => {
    const score = scoreCatalogItem(
      mk({ amount: amountHigh, photoUrl: 'x', brand: 'Ikon', sellingPrice: 7000 })
    );
    expect(score).toBe(
      weights.amountHigh +
        weights.photo +
        weights.brand +
        weights.hasPrice +
        weights.priceInBand
    );
  });

  test('без фото — нет веса photo', () => {
    const withPhoto = scoreCatalogItem(mk({ photoUrl: 'x' }));
    const withoutPhoto = scoreCatalogItem(mk({ photoUrl: null }));
    expect(withPhoto - withoutPhoto).toBe(weights.photo);
  });

  test('amountLow vs amountHigh vs ниже порога', () => {
    const high = scoreCatalogItem(mk({ amount: amountHigh, photoUrl: null, brand: null, sellingPrice: null }));
    const low = scoreCatalogItem(mk({ amount: amountLow, photoUrl: null, brand: null, sellingPrice: null }));
    const none = scoreCatalogItem(mk({ amount: 0, photoUrl: null, brand: null, sellingPrice: null }));
    expect(high).toBe(weights.amountHigh);
    expect(low).toBe(weights.amountLow);
    expect(none).toBe(0);
  });

  test('цена вне band: hasPrice без priceInBand', () => {
    const inBand = scoreCatalogItem(
      mk({
        amount: 0,
        photoUrl: null,
        brand: null,
        sellingPrice: priceBand.min,
      })
    );
    const below = scoreCatalogItem(
      mk({
        amount: 0,
        photoUrl: null,
        brand: null,
        sellingPrice: priceBand.min - 1,
      })
    );
    const above = scoreCatalogItem(
      mk({
        amount: 0,
        photoUrl: null,
        brand: null,
        sellingPrice: priceBand.max + 1,
      })
    );
    expect(inBand).toBe(weights.hasPrice + weights.priceInBand);
    expect(below).toBe(weights.hasPrice);
    expect(above).toBe(weights.hasPrice);
  });

  test('кастомный scoringCfg переопределяет веса', () => {
    const custom = {
      amountHigh: 10,
      amountLow: 1,
      weights: {
        amountHigh: 100,
        amountLow: 1,
        photo: 0,
        brand: 0,
        hasPrice: 0,
        priceInBand: 0,
      },
      priceBand: { min: 0, max: 1 },
    };
    expect(scoreCatalogItem(mk({ amount: 10 }), custom)).toBe(100);
  });
});

describe('pickTopDiverse', () => {
  const scoreFn = (item) => item.score;

  test('соблюдает maxPerBrand, затем добирает без капа', () => {
    const maxPerBrand = SHOWCASE_CONFIG.diversity.maxPerBrand;
    expect(maxPerBrand).toBe(2);

    const items = [
      { id: 1, brand: 'A', score: 100, amount: 5 },
      { id: 2, brand: 'A', score: 99, amount: 5 },
      { id: 3, brand: 'A', score: 98, amount: 5 },
      { id: 4, brand: 'B', score: 50, amount: 5 },
      { id: 5, brand: 'C', score: 40, amount: 5 },
    ];

    const picked = pickTopDiverse(items, scoreFn, 4);
    expect(picked.map((i) => i.id)).toEqual([1, 2, 4, 5]);

    // limit > уникальных брентов*cap → второй проход без капа берёт 3-й A
    const fill = pickTopDiverse(items, scoreFn, 5);
    expect(fill.map((i) => i.id)).toEqual([1, 2, 4, 5, 3]);
  });

  test('явный maxPerBrand=1 ограничивает сильнее', () => {
    const items = [
      { id: 1, brand: 'A', score: 10, amount: 1 },
      { id: 2, brand: 'A', score: 9, amount: 1 },
      { id: 3, brand: 'B', score: 8, amount: 1 },
    ];
    const picked = pickTopDiverse(items, scoreFn, 2, { maxPerBrand: 1 });
    expect(picked.map((i) => i.id)).toEqual([1, 3]);
  });
});
