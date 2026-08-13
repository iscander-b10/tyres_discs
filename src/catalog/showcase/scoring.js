const toAmount = (item) => {
  const n = Number(item?.amount);
  return Number.isFinite(n) ? n : 0;
};

const toPrice = (item) => {
  const raw = item?.sellingPrice ?? item?.price ?? item?.cost;
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Простой retail-score: наличие → фото → цена → бренд. */
export const scoreCatalogItem = (item) => {
  let score = 0;
  const amount = toAmount(item);

  if (amount >= 4) score += 40;
  else if (amount >= 1) score += 22;

  if (item?.photoUrl) score += 14;
  if (item?.brand) score += 6;

  const price = toPrice(item);
  if (price != null) {
    score += 18;
    if (price >= 2500 && price <= 25000) score += 8;
  }

  return score;
};

/**
 * Берёт топ по score с ограничением на бренд (разнообразие ряда).
 * @param {object[]} items
 * @param {(item: object) => number} scoreFn
 * @param {number} limit
 * @param {{ maxPerBrand?: number }} [opts]
 */
export const pickTopDiverse = (items, scoreFn, limit, { maxPerBrand = 2 } = {}) => {
  if (!Array.isArray(items) || limit <= 0) return [];

  const ranked = items
    .map((item) => ({ item, score: scoreFn(item) }))
    .sort((a, b) => b.score - a.score || toAmount(b.item) - toAmount(a.item));

  const picked = [];
  const brandCounts = new Map();
  const usedIds = new Set();

  const tryPick = (enforceBrandCap) => {
    for (const { item } of ranked) {
      if (picked.length >= limit) break;
      const id = item?.id;
      if (id != null && usedIds.has(id)) continue;

      const brand = String(item?.brand ?? '');
      if (enforceBrandCap) {
        const count = brandCounts.get(brand) || 0;
        if (brand && count >= maxPerBrand) continue;
        brandCounts.set(brand, count + 1);
      }

      if (id != null) usedIds.add(id);
      picked.push(item);
    }
  };

  tryPick(true);
  if (picked.length < limit) tryPick(false);

  return picked;
};

export const isStocked = (item, minAmount = 1) => toAmount(item) >= minAmount;
