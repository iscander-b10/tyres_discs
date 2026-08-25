import { mergePreferredShowcaseCandidates } from '../../catalog/core';
import {
  getSingleBrandForIndex,
  isActiveFilterValue,
} from './catalogSearchFilters';

export const TIRE_SEARCH_INDEX_HINTS = [
  'width',
  'profile',
  'diameter',
  'brand',
  'supplier',
  'season',
];

export const DISC_SEARCH_INDEX_HINTS = [
  'diameter',
  'pcd',
  'pn',
  'diskType',
  'brand',
  'supplier',
];

/**
 * Первый активный equality-hint. `season` у шин намеренно последний:
 * он почти всегда задан в форме и иначе перебивает селективный `width`.
 */
export const pickEqualityFilterKey = (filters, hintOrder) => {
  const filterCount = Object.keys(filters || {}).filter((key) =>
    isActiveFilterValue(filters[key])
  ).length;

  if (filterCount === 0) {
    return null;
  }

  for (let i = 0; i < hintOrder.length; i += 1) {
    const hint = hintOrder[i];
    if (hint === 'brand') {
      const singleBrand = getSingleBrandForIndex(filters.brand);
      if (singleBrand) {
        return { key: 'brand', value: singleBrand };
      }
    } else if (isActiveFilterValue(filters[hint])) {
      return { key: hint, value: filters[hint] };
    }
  }

  return null;
};

export const pickEqualityIndex = (store, filters, hintOrder) => {
  const picked = pickEqualityFilterKey(filters, hintOrder);
  if (!picked) {
    return store.openCursor();
  }
  return store.index(picked.key).openCursor(IDBKeyRange.only(picked.value));
};

export const replaceSupplierItemsInStore = (
  store,
  supplier,
  items,
  onComplete,
  onError
) => {
  const clearRequest = store.index('supplier').openCursor(IDBKeyRange.only(supplier));
  clearRequest.onerror = () => onError(clearRequest.error);
  clearRequest.onsuccess = () => {
    try {
      const cursor = clearRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }
      items.forEach((item) => store.put(item));
      onComplete();
    } catch (error) {
      onError(error);
    }
  };
};

/**
 * Сбор кандидатов витрины из RAM-массива (тот же контракт, что у cursor helper).
 *
 * `candidateLimit: null` / non-finite — без ранней отсечки (полка дисков).
 * `preferItem` — preferred не режутся лимитом; без него цикл обрывается на limit.
 * `matchesItem` — доп. hard-filter (полка шин: частые размеры) до учёта в лимите.
 */
export const collectShowcaseCandidatesFromItems = (
  items,
  {
    candidateLimit = 480,
    minAmount = 1,
    supplier = null,
    preferItem = null,
    matchesItem = null,
  } = {}
) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { isEmpty: true, candidates: [] };
  }

  const hasPrefer = typeof preferItem === 'function';
  const hasMatch = typeof matchesItem === 'function';
  const unlimited =
    candidateLimit == null || !Number.isFinite(Number(candidateLimit));
  const limit = unlimited ? Number.POSITIVE_INFINITY : Math.max(0, Number(candidateLimit));
  const preferred = [];
  const others = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (supplier && item?.supplier !== supplier) continue;

    const amount = Number(item?.amount);
    if (Number.isNaN(amount) || amount < minAmount) continue;
    if (hasMatch && !matchesItem(item)) continue;

    if (hasPrefer && preferItem(item)) {
      preferred.push(item);
      continue;
    }

    if (others.length < limit) {
      others.push(item);
    } else if (!hasPrefer) {
      break;
    }
  }

  const mergeLimit = unlimited ? preferred.length + others.length : limit;

  return {
    isEmpty: false,
    candidates: hasPrefer
      ? mergePreferredShowcaseCandidates(preferred, others, mergeLimit)
      : unlimited
        ? others
        : others.slice(0, limit),
  };
};

/**
 * Общий сбор кандидатов витрины из object store (ранний лимит).
 *
 * `isEmpty: true` — весь store пуст (каталог не загружен).
 * Если store не пуст, но у `supplier` нет строк / in-stock кандидатов —
 * `isEmpty: false` и `candidates: []`: полки пустые, чипы остаются.
 * При переданном `supplier` обходим только индекс `supplier` (чужие не попадают в пул).
 *
 * `preferItem(item)` — позиции идут в приоритетный пул первым; при его наличии
 * курсор не обрывается на limit, пока не просмотрены все preferred (гарантия Ikon).
 * `matchesItem(item)` — доп. hard-filter до учёта в лимите (как у RAM-helper).
 */
export const collectShowcaseCandidatesFromStore = (
  store,
  {
    candidateLimit = 480,
    minAmount = 1,
    supplier = null,
    preferItem = null,
    matchesItem = null,
  } = {}
) =>
  new Promise((resolve, reject) => {
    const countRequest = store.count();
    countRequest.onerror = () => reject(countRequest.error);

    countRequest.onsuccess = () => {
      const total = countRequest.result || 0;
      if (total === 0) {
        resolve({
          isEmpty: true,
          candidates: [],
        });
        return;
      }

      const preferred = [];
      const others = [];
      let settled = false;
      const hasPrefer = typeof preferItem === 'function';
      const hasMatch = typeof matchesItem === 'function';

      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      const considerItem = (item) => {
        if (supplier && item?.supplier !== supplier) return;

        const amount = Number(item?.amount);
        if (Number.isNaN(amount) || amount < minAmount) return;
        if (hasMatch && !matchesItem(item)) return;

        if (hasPrefer && preferItem(item)) {
          preferred.push(item);
          return;
        }

        if (others.length < candidateLimit) {
          others.push(item);
        }
      };

      const useSupplierIndex =
        Boolean(supplier) && store.indexNames.contains('supplier');
      const request = useSupplierIndex
        ? store.index('supplier').openCursor(IDBKeyRange.only(supplier))
        : store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          finish({
            isEmpty: false,
            candidates: hasPrefer
              ? mergePreferredShowcaseCandidates(
                  preferred,
                  others,
                  candidateLimit
                )
              : others.slice(0, candidateLimit),
          });
          return;
        }

        considerItem(cursor.value);

        // Без prefer — прежний ранний выход. С prefer — дочитываем store,
        // чтобы Ikon не отрезались лимитом 480 чужих SKU.
        if (!hasPrefer && others.length >= candidateLimit) {
          finish({ isEmpty: false, candidates: others.slice(0, candidateLimit) });
          return;
        }

        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    };
  });
