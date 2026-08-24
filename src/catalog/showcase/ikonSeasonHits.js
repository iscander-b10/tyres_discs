import { isIkonBrand, resolveCatalogModel } from '../core';
import { pickTopDiverse, scoreCatalogItem } from './scoring';
import { shuffleItems } from './showcaseSeed';

export { shuffleItems } from './showcaseSeed';

export const normalizeIkonModelText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const EXCLUDED_IKON_RE = /\b(?:suv|suf|sav|eco\s*c\s*[23]|nordman)\b/i;

export const isExcludedIkonModel = (modelText) =>
  EXCLUDED_IKON_RE.test(normalizeIkonModelText(modelText));

const modelTextOf = (item) =>
  resolveCatalogModel(item) || String(item?.title || '').trim();

/** Хвост после ключа whitelist: только индексы нагрузки/скорости, не модельные токены (C2, SUV…). */
const isAllowedWhitelistTail = (rest) => {
  if (!rest) return true;
  return rest
    .split(/\s+/)
    .every((token) => /^\d{2,3}(?:\/\d{2,3})?[a-z]?$/i.test(token));
};

const matchesWhitelistKey = (normalized, needle) => {
  if (normalized === needle) return true;
  if (!normalized.startsWith(`${needle} `)) return false;
  return isAllowedWhitelistTail(normalized.slice(needle.length).trim());
};

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
    if (matchesWhitelistKey(normalized, needle)) return key;
  }

  return null;
};

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

/** После shuffle раздвигает preferred, чтобы они не шли подряд, пока хватает остальных.
 * В сборке полки больше не вызывается (Ikon подряд — нормально); оставлено для тестов. */
export const spreadPreferredItems = (items, isPreferred) => {
  const arr = [...items];
  for (let i = 1; i < arr.length; i += 1) {
    if (!isPreferred(arr[i - 1]) || !isPreferred(arr[i])) continue;
    let swapAt = -1;
    for (let j = i + 1; j < arr.length; j += 1) {
      if (!isPreferred(arr[j])) {
        swapAt = j;
        break;
      }
    }
    if (swapAt < 0) break;
    [arr[i], arr[swapAt]] = [arr[swapAt], arr[i]];
  }
  return arr;
};

/**
 * Уникальные Ikon из whitelist (1 модель = 1 карточка, разброс diameter).
 * `allowAnyUnique` — только fallback, когда в пуле нет не-Ikon.
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
 * Полка до `limit`: уникальные Ikon из whitelist + остальные (brand+model), затем
 * seeded shuffle. Ikon подряд (2–3) — нормально; spreadPreferredItems не вызываем.
 * Сверх whitelist Ikon не добиваем, пока в пуле есть хотя бы один не-Ikon.
 */
export const pickMixedSeasonHits = ({
  pool,
  season,
  limit,
  whitelist,
  scoreFn = scoreCatalogItem,
  seed,
}) => {
  if (!Array.isArray(pool) || limit <= 0) return [];

  const ikonPool = pool.filter((item) => isIkonBrand(item));
  const otherPool = pool.filter((item) => !isIkonBrand(item));

  const ikonCap = Math.min(
    limit,
    Array.isArray(whitelist) ? whitelist.length : 0
  );
  const ikonPicked = pickUniqueIkonHits(ikonPool, whitelist, ikonCap, {
    scoreFn,
    allowAnyUnique: false,
  });

  const uniqueOthers = collapseUniqueBrandModel(otherPool, scoreFn);
  const othersNeeded = limit - ikonPicked.length;
  const othersPicked =
    season === 'w'
      ? pickWinterDiverse(uniqueOthers, othersNeeded, scoreFn)
      : pickTopDiverse(uniqueOthers, scoreFn, othersNeeded);

  let result = [...ikonPicked, ...othersPicked];

  // Нет ни одного не-Ikon в сезонном пуле — единственный допустимый fallback «только Ikon».
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

  return shuffleItems(result.slice(0, limit), seed);
};
