import { mergePreferredShowcaseCandidates } from '../../catalog/core';
import {
  getSingleBrandForIndex,
  isActiveFilterValue,
} from './catalogSearchFilters';

export const TIRE_SEARCH_INDEX_HINTS = [
  'diameter',
  'season',
  'brand',
  'supplier',
];

export const DISC_SEARCH_INDEX_HINTS = [
  'diameter',
  'diskType',
  'brand',
  'supplier',
];

export const pickEqualityIndex = (store, filters, hintOrder) => {
  const filterCount = Object.keys(filters).filter((key) =>
    isActiveFilterValue(filters[key])
  ).length;

  if (filterCount === 0) {
    return store.openCursor();
  }

  for (let i = 0; i < hintOrder.length; i += 1) {
    const hint = hintOrder[i];
    if (hint === 'brand') {
      const singleBrand = getSingleBrandForIndex(filters.brand);
      if (singleBrand) {
        return store.index('brand').openCursor(IDBKeyRange.only(singleBrand));
      }
    } else if (isActiveFilterValue(filters[hint])) {
      return store.index(hint).openCursor(IDBKeyRange.only(filters[hint]));
    }
  }

  return store.openCursor();
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
 * Общий сбор кандидатов витрины из object store (ранний лимит).
 *
 * `isEmpty: true` — весь store пуст (каталог не загружен).
 * Если store не пуст, но у `supplier` нет строк / in-stock кандидатов —
 * `isEmpty: false` и `candidates: []`: полки пустые, чипы остаются.
 * При переданном `supplier` обходим только индекс `supplier` (чужие не попадают в пул).
 *
 * `preferItem(item)` — позиции идут в приоритетный пул первым; при его наличии
 * курсор не обрывается на limit, пока не просмотрены все preferred (гарантия Ikon).
 */
export const collectShowcaseCandidatesFromStore = (
  store,
  {
    candidateLimit = 480,
    minAmount = 1,
    supplier = null,
    preferItem = null,
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

      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      const considerItem = (item) => {
        if (supplier && item?.supplier !== supplier) return;

        const amount = Number(item?.amount);
        if (Number.isNaN(amount) || amount < minAmount) return;

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
