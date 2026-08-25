import {
  getSingleBrandForIndex,
  isActiveFilterValue,
} from './catalogSearchFilters';

export const TIRE_MEMORY_INDEX_FIELDS = [
  'width',
  'profile',
  'diameter',
  'season',
  'brand',
  'supplier',
];

export const DISC_MEMORY_INDEX_FIELDS = [
  'diameter',
  'pcd',
  'pn',
  'diskType',
  'brand',
  'supplier',
];

const NUMERIC_INDEX_FIELDS = new Set(['width', 'profile', 'pcd', 'pn']);

export const canonicalizeIndexKey = (field, value) => {
  if (value === undefined || value === null || value === '') return null;
  if (NUMERIC_INDEX_FIELDS.has(field)) {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }
  return String(value);
};

export const buildEqualityIndexMaps = (items, fields) => {
  const maps = {};
  for (let i = 0; i < fields.length; i += 1) {
    maps[fields[i]] = new Map();
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    for (let j = 0; j < fields.length; j += 1) {
      const field = fields[j];
      const key = canonicalizeIndexKey(field, item[field]);
      if (key === null) continue;
      const bucket = maps[field].get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        maps[field].set(key, [item]);
      }
    }
  }

  return maps;
};

const pushUniqueFacetRow = (seen, rows, key, row) => {
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(row);
};

export const buildTireFacetRows = (items) => {
  const seen = new Set();
  const rows = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    pushUniqueFacetRow(
      seen,
      rows,
      `${item.width}\0${item.profile}\0${item.diameter}\0${item.season}\0${item.brand}\0${item.supplier}`,
      {
        width: item.width,
        profile: item.profile,
        diameter: item.diameter,
        season: item.season,
        brand: item.brand,
        supplier: item.supplier,
      }
    );
  }
  return rows;
};

export const buildDiscFacetRows = (items) => {
  const seen = new Set();
  const rows = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    pushUniqueFacetRow(
      seen,
      rows,
      `${item.diameter}\0${item.width}\0${item.pcd}\0${item.pn}\0${item.cb}\0${item.et}\0${item.diskType}\0${item.brand}\0${item.supplier}`,
      {
        diameter: item.diameter,
        width: item.width,
        pcd: item.pcd,
        pn: item.pn,
        cb: item.cb,
        et: item.et,
        diskType: item.diskType,
        brand: item.brand,
        supplier: item.supplier,
      }
    );
  }
  return rows;
};

export const createCategoryMemory = (items, kind) => {
  const fields =
    kind === 'discs' ? DISC_MEMORY_INDEX_FIELDS : TIRE_MEMORY_INDEX_FIELDS;
  return {
    items,
    indexMaps: buildEqualityIndexMaps(items, fields),
    facetRows:
      kind === 'discs' ? buildDiscFacetRows(items) : buildTireFacetRows(items),
  };
};

const readEqualityFilterValue = (filters, hint) => {
  if (hint === 'brand') {
    return getSingleBrandForIndex(filters.brand);
  }
  if (isActiveFilterValue(filters[hint])) {
    return filters[hint];
  }
  return null;
};

/**
 * Кандидаты поиска: наименьший RAM-bucket среди активных hint-полей,
 * иначе полный массив (нет equality-фильтра из hintOrder).
 */
export const selectIndexedCandidates = (items, indexMaps, filters, hintOrder) => {
  let bestBucket = null;
  let bestSize = Infinity;
  let sawEquality = false;

  for (let i = 0; i < hintOrder.length; i += 1) {
    const hint = hintOrder[i];
    const rawValue = readEqualityFilterValue(filters, hint);
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      continue;
    }

    const key = canonicalizeIndexKey(hint, rawValue);
    if (key === null) continue;

    sawEquality = true;
    const bucket = indexMaps[hint]?.get(key) || [];
    if (bucket.length < bestSize) {
      bestSize = bucket.length;
      bestBucket = bucket;
    }
  }

  return sawEquality ? bestBucket : items;
};

export const filterIndexedItems = (
  items,
  indexMaps,
  filters,
  hintOrder,
  matcher
) => {
  const candidates = selectIndexedCandidates(
    items,
    indexMaps,
    filters,
    hintOrder
  );
  const results = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    if (matcher(item, filters)) {
      results.push(item);
    }
  }
  return results;
};
