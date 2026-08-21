import { isIkonBrand } from '../../components/shared/ikonPromoBadges';
import { resolveCatalogModel } from '../../components/shared/catalogCopy';
import { pickTopDiverse, scoreCatalogItem } from './scoring';

/** ~⅓ слотов под Ikon (фиксируем round). */
export const ikonSlotsForLimit = (limit) => {
  if (limit <= 0) return 0;
  return Math.round(limit / 3);
};

export const normalizeIkonModelText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const EXCLUDED_IKON_RE = /\b(?:suv|suf|sav|eco\s*c\s*3|nordman)\b/i;

export const isExcludedIkonModel = (modelText) =>
  EXCLUDED_IKON_RE.test(normalizeIkonModelText(modelText));

const modelTextOf = (item) =>
  resolveCatalogModel(item) || String(item?.title || '').trim();

/**
 * Сопоставляет карточку с ключом whitelist (длинные ключи важнее).
 * @returns {string|null} канонический ключ из whitelist
 */
export const resolveIkonSeasonModelKey = (item, whitelist = []) => {
  if (!isIkonBrand(item) || !Array.isArray(whitelist) || whitelist.length === 0) {
    return null;
  }

  const modelText = modelTextOf(item);
  if (!modelText || isExcludedIkonModel(modelText)) return null;

  const normalized = normalizeIkonModelText(modelText);
  if (!normalized) return null;

  const ranked = [...whitelist].sort(
    (a, b) => normalizeIkonModelText(b).length - normalizeIkonModelText(a).length
  );

  for (const key of ranked) {
    const needle = normalizeIkonModelText(key);
    if (!needle) continue;
    if (normalized === needle || normalized.startsWith(`${needle} `)) {
      return key;
    }
  }

  return null;
};

const sizeKey = (item) =>
  `${item?.width ?? ''}/${item?.profile ?? ''}/${item?.diameter ?? ''}`;

const brandModelKey = (item) => {
  const brand = normalizeIkonModelText(item?.brand);
  const model = normalizeIkonModelText(modelTextOf(item));
  return `${brand}|${model}`;
};

const amountOf = (item) => {
  const n = Number(item?.amount);
  return Number.isFinite(n) ? n : 0;
};

const betterItem = (a, b, scoreFn) => {
  const sa = scoreFn(a);
  const sb = scoreFn(b);
  if (sa !== sb) return sa > sb ? a : b;
  return amountOf(a) >= amountOf(b) ? a : b;
};

/**
 * Одна карточка на уникальный ключ группы; внутри группы — лучший score.
 */
const collapseByKey = (items, keyFn, scoreFn) => {
  const best = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const prev = best.get(key);
    best.set(key, prev ? betterItem(prev, item, scoreFn) : item);
  }
  return [...best.entries()].map(([key, item]) => ({ key, item }));
};

/**
 * Топ уникальных моделей с разбросом размеров (diameter).
 */
const pickWithSizeSpread = (grouped, limit, scoreFn) => {
  if (limit <= 0 || grouped.length === 0) return [];

  const ranked = [...grouped].sort(
    (a, b) =>
      scoreFn(b.item) - scoreFn(a.item) || amountOf(b.item) - amountOf(a.item)
  );

  const picked = [];
  const usedKeys = new Set();
  const usedDiameters = new Set();

  const tryPick = (preferNewDiameter) => {
    for (const { key, item } of ranked) {
      if (picked.length >= limit) break;
      if (usedKeys.has(key)) continue;
      const dia = String(item?.diameter ?? '');
      if (preferNewDiameter && dia && usedDiameters.has(dia)) continue;
      usedKeys.add(key);
      if (dia) usedDiameters.add(dia);
      picked.push(item);
    }
  };

  tryPick(true);
  if (picked.length < limit) tryPick(false);
  return picked;
};

/**
 * Уникальные Ikon для партнёрской квоты.
 * Лето: только whitelist. Зима: whitelist, затем любые уникальные модели без SUV/C3.
 */
export const pickUniqueIkonHits = (
  pool,
  whitelist,
  limit,
  {
    scoreFn = scoreCatalogItem,
    allowAnyUnique = false,
  } = {}
) => {
  if (!Array.isArray(pool) || limit <= 0) return [];

  const eligible = pool.filter((item) => {
    if (!isIkonBrand(item)) return false;
    return !isExcludedIkonModel(modelTextOf(item));
  });

  const whitelisted = collapseByKey(
    eligible.filter((item) => resolveIkonSeasonModelKey(item, whitelist)),
    (item) => resolveIkonSeasonModelKey(item, whitelist),
    scoreFn
  );

  let picked = pickWithSizeSpread(whitelisted, limit, scoreFn);
  if (picked.length >= limit || !allowAnyUnique) return picked;

  const usedModels = new Set(
    picked.map((item) => normalizeIkonModelText(modelTextOf(item)))
  );
  const usedIds = new Set(picked.map((item) => item.id).filter((id) => id != null));

  const remainderPool = eligible.filter((item) => {
    if (item.id != null && usedIds.has(item.id)) return false;
    const model = normalizeIkonModelText(modelTextOf(item));
    if (!model || usedModels.has(model)) return false;
    // Уже в whitelist-группе — не дублируем другим ключом
    if (resolveIkonSeasonModelKey(item, whitelist)) return false;
    return true;
  });

  const remainderGrouped = collapseByKey(
    remainderPool,
    (item) => normalizeIkonModelText(modelTextOf(item)),
    scoreFn
  );
  const extra = pickWithSizeSpread(
    remainderGrouped,
    limit - picked.length,
    scoreFn
  );
  return [...picked, ...extra];
};

/** Уникальные brand+model для блока «остальные». */
export const collapseUniqueBrandModel = (items, scoreFn = scoreCatalogItem) =>
  collapseByKey(items, brandModelKey, scoreFn).map(({ item }) => item);

/**
 * Зимний микс шипы/фрикция внутри already-unique пула others.
 */
export const pickWinterDiverse = (pool, limit, scoreFn = scoreCatalogItem) => {
  const withSpikes = pool.filter((item) => item.spikes === true);
  const withoutSpikes = pool.filter((item) => item.spikes !== true);

  if (withSpikes.length === 0 || withoutSpikes.length === 0) {
    return pickTopDiverse(pool, scoreFn, limit);
  }

  const spikesSlots = Math.ceil(limit / 2);
  const frictionSlots = limit - spikesSlots;
  const fromSpikes = pickTopDiverse(withSpikes, scoreFn, spikesSlots);
  const fromFriction = pickTopDiverse(withoutSpikes, scoreFn, frictionSlots);
  const mixed = [...fromSpikes, ...fromFriction];

  if (mixed.length >= limit) return mixed.slice(0, limit);

  const usedIds = new Set(mixed.map((item) => item.id).filter((id) => id != null));
  const remainder = pickTopDiverse(
    pool.filter((item) => item.id == null || !usedIds.has(item.id)),
    scoreFn,
    limit - mixed.length
  );
  return [...mixed, ...remainder];
};

/**
 * Сборка полки: сначала Ikon (~⅓), затем others (~⅔).
 * Порядок: блок Ikon, затем others.
 */
export const pickMixedSeasonHits = ({
  pool,
  season,
  limit,
  whitelist,
  scoreFn = scoreCatalogItem,
}) => {
  if (!Array.isArray(pool) || limit <= 0) return [];

  const ikonCap = ikonSlotsForLimit(limit);
  const otherTarget = limit - ikonCap;

  const ikonPool = pool.filter((item) => isIkonBrand(item));
  const otherPool = pool.filter((item) => !isIkonBrand(item));

  const ikonPicked = pickUniqueIkonHits(ikonPool, whitelist, ikonCap, {
    scoreFn,
    allowAnyUnique: season === 'w',
  });

  const uniqueOthers = collapseUniqueBrandModel(otherPool, scoreFn);
  const othersNeeded = limit - ikonPicked.length;
  const othersPicked =
    season === 'w'
      ? pickWinterDiverse(uniqueOthers, othersNeeded, scoreFn)
      : pickTopDiverse(uniqueOthers, scoreFn, othersNeeded);

  let result = [...ikonPicked, ...othersPicked];

  // Недобор others при пустом/исчерпанном other-пуле — добираем уникальным Ikon сверх квоты.
  if (result.length < limit && uniqueOthers.length === 0) {
    const usedIds = new Set(result.map((item) => item.id).filter((id) => id != null));
    const usedModels = new Set(
      result
        .filter((item) => isIkonBrand(item))
        .map((item) => normalizeIkonModelText(modelTextOf(item)))
    );
    const moreIkon = pickUniqueIkonHits(
      ikonPool.filter((item) => {
        if (item.id != null && usedIds.has(item.id)) return false;
        const model = normalizeIkonModelText(modelTextOf(item));
        return model && !usedModels.has(model);
      }),
      whitelist,
      limit - result.length,
      { scoreFn, allowAnyUnique: true }
    );
    result = [...result, ...moreIkon];
  }

  return result.slice(0, limit);
};
