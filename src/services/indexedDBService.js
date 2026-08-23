import { mergePreferredShowcaseCandidates } from '../catalog/showcase/preferredCandidates';

const isActiveFilterValue = (value) => {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const matchesBrandFilter = (itemBrand, brandFilter) => {
  if (!isActiveFilterValue(brandFilter)) return true;
  if (Array.isArray(brandFilter)) return brandFilter.includes(itemBrand);
  return itemBrand === brandFilter;
};

const getSingleBrandForIndex = (brandFilter) => {
  if (Array.isArray(brandFilter)) {
    return brandFilter.length === 1 ? brandFilter[0] : null;
  }
  return brandFilter || null;
};

const normalizeNumericFieldValue = (value) => {
  const num = parseFloat(value);
  return Number.isNaN(num) ? null : num;
};

const sortDiameterValues = (values) =>
  [...values].sort((a, b) => {
    const strA = a.toString();
    const strB = b.toString();
    const numA = parseFloat(strA) || 0;
    const numB = parseFloat(strB) || 0;

    if (numA !== numB) {
      return numA - numB;
    }

    return strA.localeCompare(strB);
  });

const sortNumericValues = (values) => [...values].sort((a, b) => a - b);

const sortDiscDiameterValues = (values) =>
  [...values].sort((a, b) => {
    const strA = a.toString();
    const strB = b.toString();
    const numA = parseFloat(strA.replace(/[^\d.]/g, '')) || 0;
    const numB = parseFloat(strB.replace(/[^\d.]/g, '')) || 0;

    if (numA !== numB) {
      return numA - numB;
    }

    return strA.localeCompare(strB);
  });

const sortDiscNumericValues = (values) =>
  [...values].sort((a, b) => {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numA - numB;
  });

const isValidCatalogKey = (value) =>
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isFinite(value));

const isStructuredCloneableFallback = (value, seen = new Set()) => {
  if (
    value === null ||
    value === undefined ||
    ['string', 'number', 'boolean', 'bigint'].includes(typeof value)
  ) {
    return true;
  }
  if (['function', 'symbol'].includes(typeof value)) return false;
  if (seen.has(value)) return true;
  if (
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof Promise
  ) {
    return false;
  }

  seen.add(value);
  try {
    return Reflect.ownKeys(value).every(
      (key) =>
        typeof key !== 'symbol' &&
        isStructuredCloneableFallback(value[key], seen)
    );
  } catch {
    return false;
  }
};

const canBeStoredInIndexedDB = (value) => {
  try {
    if (typeof globalThis.structuredClone === 'function') {
      globalThis.structuredClone(value);
      return true;
    }
    return isStructuredCloneableFallback(value);
  } catch {
    return false;
  }
};

const prepareCatalogItems = (items, entityName) => {
  if (!Array.isArray(items)) {
    throw new TypeError(`Данные ${entityName} должны быть массивом`);
  }
  if (items.length === 0) {
    return { validItems: [], supplier: null, skipped: 0 };
  }

  const individuallyValid = items.filter(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      isValidCatalogKey(item.id) &&
      isValidCatalogKey(item.supplier) &&
      canBeStoredInIndexedDB(item)
  );
  const supplier = individuallyValid[0]?.supplier;
  const validItems = individuallyValid.filter(
    (item) => item.supplier === supplier
  );

  if (validItems.length === 0) {
    throw new Error(`Все входные ${entityName} некорректны`);
  }

  return {
    validItems,
    supplier,
    skipped: items.length - validItems.length,
  };
};

const matchesTireDiameter = (itemDiameter, filterDiameter) => {
  if (!isActiveFilterValue(filterDiameter)) return true;
  return String(itemDiameter) === String(filterDiameter);
};

const matchesTireNumericField = (itemValue, filterValue) => {
  if (!isActiveFilterValue(filterValue)) return true;
  return Number(itemValue) === Number(filterValue);
};

const matchesTireParameterFilters = (item, filters = {}) => {
  if (!matchesTireNumericField(item.width, filters.width)) return false;
  if (!matchesTireNumericField(item.profile, filters.profile)) return false;
  if (!matchesTireDiameter(item.diameter, filters.diameter)) return false;
  if (filters.season && item.season !== filters.season) return false;
  return true;
};

const matchesDiscStringField = (itemValue, filterValue) => {
  if (!isActiveFilterValue(filterValue)) return true;
  return String(itemValue) === String(filterValue);
};

const matchesDiscRange = (itemValue, from, to) => {
  if (!isActiveFilterValue(from) && !isActiveFilterValue(to)) return true;
  const num = itemValue === undefined || itemValue === null ? NaN : Number(itemValue);
  if (Number.isNaN(num)) return false;
  if (isActiveFilterValue(from) && num < Number(from)) return false;
  if (isActiveFilterValue(to) && num > Number(to)) return false;
  return true;
};

const matchesDiscParameterFilters = (item, filters = {}) => {
  if (!matchesBrandFilter(item.brand, filters.brand)) return false;
  if (!matchesDiscStringField(item.supplier, filters.supplier)) return false;
  if (!matchesTireDiameter(item.diameter, filters.diameter)) return false;
  if (!matchesTireNumericField(item.pcd, filters.pcd)) return false;
  if (!matchesTireNumericField(item.pn, filters.pn)) return false;
  if (!matchesDiscStringField(item.diskType, filters.diskType)) return false;
  if (!matchesDiscRange(item.width, filters.widthFrom, filters.widthTo)) return false;
  if (!matchesDiscRange(item.cb, filters.cbFrom, filters.cbTo)) return false;
  if (!matchesDiscRange(item.et, filters.etFrom, filters.etTo)) return false;
  return true;
};

const addUniqueValue = (set, value) => {
  if (value != null) {
    set.add(value);
  }
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
const collectShowcaseCandidatesFromStore = (
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

class IndexedDBService {
  constructor() {
    this.dbName = 'TireDatabase';
    this.discDbName = 'DiscDatabase';
    this.version = 2; // + индекс model
    this.discVersion = 3; // + индекс model
    this.db = null;
    this.discDb = null;
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;

        let tireStore;
        if (!db.objectStoreNames.contains('tires')) {
          tireStore = db.createObjectStore('tires', {
            keyPath: 'id'
          });
        } else {
          tireStore = transaction.objectStore('tires');
        }

        const ensureTireIndex = (name, keyPath) => {
          if (!tireStore.indexNames.contains(name)) {
            tireStore.createIndex(name, keyPath, { unique: false });
          }
        };

        ensureTireIndex('supplier', 'supplier');
        ensureTireIndex('brand', 'brand');
        ensureTireIndex('model', 'model');
        ensureTireIndex('title', 'title');
        ensureTireIndex('photoUrl', 'photoUrl');
        ensureTireIndex('width', 'width');
        ensureTireIndex('profile', 'profile');
        ensureTireIndex('diameter', 'diameter');
        ensureTireIndex('season', 'season');
        ensureTireIndex('spikes', 'spikes');
        ensureTireIndex('price', 'price');
        ensureTireIndex('amount', 'amount');
      };
    });
  }

  async saveTires(tires) {
    return this.saveCatalogItems({
      items: tires,
      dbProperty: 'db',
      openDatabase: () => this.openDatabase(),
      storeName: 'tires',
      entityName: 'шины',
    });
  }

  async saveCatalogItems({
    items,
    dbProperty,
    openDatabase,
    storeName,
    entityName,
  }) {
    const { validItems, supplier, skipped } = prepareCatalogItems(
      items,
      entityName
    );
    if (validItems.length === 0) {
      return { saved: 0, skipped: 0 };
    }

    if (!this[dbProperty]) {
      await openDatabase();
    }

    return new Promise((resolve, reject) => {
      const transaction = this[dbProperty].transaction(
        [storeName],
        'readwrite'
      );
      const store = transaction.objectStore(storeName);
      let abortCause = null;

      const abortTransaction = (error) => {
        abortCause = error;
        try {
          transaction.abort();
        } catch {
          // Если транзакция уже aborting, итоговая ошибка придёт через onabort.
        }
      };

      transaction.oncomplete = () =>
        resolve({ saved: validItems.length, skipped });
      transaction.onabort = () =>
        reject(
          abortCause ||
            transaction.error ||
            new Error(`Транзакция IndexedDB для ${entityName} отменена`)
        );

      try {
        const clearRequest = store
          .index('supplier')
          .openCursor(IDBKeyRange.only(supplier));

        clearRequest.onsuccess = () => {
          try {
            const cursor = clearRequest.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
              return;
            }

            validItems.forEach((item) => store.put(item));
          } catch (error) {
            abortTransaction(error);
          }
        };
      } catch (error) {
        abortTransaction(error);
      }
    });
  }

  async searchTires(filters) {
  if (!this.db) await this.openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction(['tires'], 'readonly');
    const store = transaction.objectStore('tires');
    
    let request;
    const filterCount = Object.keys(filters).filter((key) => isActiveFilterValue(filters[key])).length;
    const singleBrand = getSingleBrandForIndex(filters.brand);

    if (filterCount === 0) {
      request = store.openCursor();
    } else if (isActiveFilterValue(filters.diameter)) {
      // diameter хранится строкой ("R15"); индекс надёжен по типу
      request = store.index('diameter').openCursor(IDBKeyRange.only(filters.diameter));
    } else if (isActiveFilterValue(filters.season)) {
      // width/profile в store могут быть number|string — не используем IDBKeyRange.only по ним
      request = store.index('season').openCursor(IDBKeyRange.only(filters.season));
    } else if (singleBrand) {
      request = store.index('brand').openCursor(IDBKeyRange.only(singleBrand));
    } else if (isActiveFilterValue(filters.supplier)) {
      request = store.index('supplier').openCursor(IDBKeyRange.only(filters.supplier));
    } else {
      // spikes / width / profile / minAmount / runflat — полный скан + matches
      request = store.openCursor();
    }
    
    const results = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const tire = cursor.value;
        const tireAmountNumber = Number(tire.amount);
        const minAmountNumber = filters.minAmount === undefined || filters.minAmount === null ? null : Number(filters.minAmount);
        
        const matches = (
          matchesTireParameterFilters(tire, filters) &&
          matchesBrandFilter(tire.brand, filters.brand) &&
          (!filters.supplier || tire.supplier === filters.supplier) &&
          (filters.spikes === undefined || tire.spikes === filters.spikes) &&
          (filters.runflat !== true || tire.runflat === true) &&
          (minAmountNumber === null || (!Number.isNaN(tireAmountNumber) && tireAmountNumber >= minAmountNumber))
        );
        
        if (matches) {
          results.push(tire);
        }
        
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

  async getAvailableParameterOptions(filters = {}) {
    if (!this.db) {
      await this.openDatabase();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tires'], 'readonly');
      const store = transaction.objectStore('tires');
      const request = store.getAll();

      request.onsuccess = () => {
        const widths = new Set();
        const profiles = new Set();
        const diameters = new Set();
        const seasons = new Set();
        const brands = new Set();
        const suppliers = new Set();

        request.result.forEach((item) => {
          if (filters.season && item.season !== filters.season) return;

          const matchWidth = matchesTireNumericField(item.width, filters.width);
          const matchProfile = matchesTireNumericField(item.profile, filters.profile);
          const matchDiameter = matchesTireDiameter(item.diameter, filters.diameter);

          // Опции поля X — без фильтра по X
          if (matchProfile && matchDiameter) {
            addUniqueValue(widths, normalizeNumericFieldValue(item.width));
          }
          if (matchWidth && matchDiameter) {
            addUniqueValue(profiles, normalizeNumericFieldValue(item.profile));
          }
          if (matchWidth && matchProfile) {
            addUniqueValue(diameters, item.diameter);
          }

          // brands/suppliers — по полному совпадению выбранных размеров
          if (matchWidth && matchProfile && matchDiameter) {
            addUniqueValue(seasons, item.season);
            addUniqueValue(brands, item.brand);
            addUniqueValue(suppliers, item.supplier);
          }
        });

        resolve({
          widths: sortNumericValues(widths),
          profiles: sortNumericValues(profiles),
          diameters: sortDiameterValues(diameters),
          seasons: Array.from(seasons).sort(),
          brands: Array.from(brands).sort(),
          suppliers: Array.from(suppliers).sort(),
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Методы для работы с дисками
  async openDiscDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.discDbName, this.discVersion);
      
      request.onerror = () => {
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.discDb = request.result;
        resolve(this.discDb);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;
        
        let discStore;
        if (!db.objectStoreNames.contains('discs')) {
          discStore = db.createObjectStore('discs', { 
            keyPath: 'id'
          });
        } else {
          discStore = transaction.objectStore('discs');
        }
      
        // Создаем индексы, если они еще не существуют
        if (!discStore.indexNames.contains('supplier')) {
          discStore.createIndex('supplier', 'supplier', { unique: false });
        }
        if (!discStore.indexNames.contains('brand')) {
          discStore.createIndex('brand', 'brand', { unique: false });
        }
        if (!discStore.indexNames.contains('model')) {
          discStore.createIndex('model', 'model', { unique: false });
        }
        if (!discStore.indexNames.contains('title')) {
          discStore.createIndex('title', 'title', { unique: false });
        }
        if (!discStore.indexNames.contains('photoUrl')) {
          discStore.createIndex('photoUrl', 'photoUrl', { unique: false });
        }
        if (!discStore.indexNames.contains('diameter')) {
          discStore.createIndex('diameter', 'diameter', { unique: false });
        }
        if (!discStore.indexNames.contains('width')) {
          discStore.createIndex('width', 'width', { unique: false });
        }
        if (!discStore.indexNames.contains('pcd')) {
          discStore.createIndex('pcd', 'pcd', { unique: false });
        }
        if (!discStore.indexNames.contains('et')) {
          discStore.createIndex('et', 'et', { unique: false });
        }
        if (!discStore.indexNames.contains('cb')) {
          discStore.createIndex('cb', 'cb', { unique: false });
        }
        if (!discStore.indexNames.contains('pn')) {
          discStore.createIndex('pn', 'pn', { unique: false });
        }
        if (!discStore.indexNames.contains('diskType')) {
          discStore.createIndex('diskType', 'diskType', { unique: false });
        }
        if (!discStore.indexNames.contains('price')) {
          discStore.createIndex('price', 'price', { unique: false });
        }
        if (!discStore.indexNames.contains('amount')) {
          discStore.createIndex('amount', 'amount', { unique: false });
        }
      };
    });
  }

  async saveDiscs(discs) {
    return this.saveCatalogItems({
      items: discs,
      dbProperty: 'discDb',
      openDatabase: () => this.openDiscDatabase(),
      storeName: 'discs',
      entityName: 'диски',
    });
  }

  async searchDiscs(filters) {
    if (!this.discDb) await this.openDiscDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.discDb.transaction(['discs'], 'readonly');
      const store = transaction.objectStore('discs');
      
      let request;
      const filterCount = Object.keys(filters).filter((key) => isActiveFilterValue(filters[key])).length;
      const singleBrand = getSingleBrandForIndex(filters.brand);

      if (filterCount === 0) {
        request = store.openCursor();
      } else if (isActiveFilterValue(filters.diameter)) {
        // diameter хранится строкой ("R15")
        request = store.index('diameter').openCursor(IDBKeyRange.only(filters.diameter));
      } else if (isActiveFilterValue(filters.diskType)) {
        request = store.index('diskType').openCursor(IDBKeyRange.only(filters.diskType));
      } else if (singleBrand) {
        request = store.index('brand').openCursor(IDBKeyRange.only(singleBrand));
      } else if (isActiveFilterValue(filters.supplier)) {
        request = store.index('supplier').openCursor(IDBKeyRange.only(filters.supplier));
      } else {
        // pn/pcd/width/cb/et могут быть number|string — не используем IDBKeyRange.only
        request = store.openCursor();
      }
      
      const results = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const disc = cursor.value;
          const discAmountNumber = Number(disc.amount);
          const minAmountNumber = filters.minAmount === undefined || filters.minAmount === null ? null : Number(filters.minAmount);
          
          const matches = (
            matchesDiscParameterFilters(disc, filters) &&
            (minAmountNumber === null || (!Number.isNaN(discAmountNumber) && discAmountNumber >= minAmountNumber))
          );
          
          if (matches) {
            results.push(disc);
          }
          
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Кандидаты для автовитрины шин: без полного getAll в React.
   * Обычно ограничен `options.supplier` (полки только из Шинсервиса).
   * `options.preferItem` — приоритетный пул (Ikon) в начале candidates.
   */
  async collectTireShowcaseCandidates(options = {}) {
    if (!this.db) await this.openDatabase();
    const transaction = this.db.transaction(['tires'], 'readonly');
    return collectShowcaseCandidatesFromStore(transaction.objectStore('tires'), options);
  }

  /**
   * Кандидаты для автовитрины дисков: ранний лимит.
   * Обычно ограничен `options.supplier` (полки только из Шинсервиса).
   */
  async collectDiscShowcaseCandidates(options = {}) {
    if (!this.discDb) await this.openDiscDatabase();
    const transaction = this.discDb.transaction(['discs'], 'readonly');
    return collectShowcaseCandidatesFromStore(transaction.objectStore('discs'), options);
  }

  async getAvailableDiscParameterOptions(filters = {}) {
    if (!this.discDb) {
      await this.openDiscDatabase();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.discDb.transaction(['discs'], 'readonly');
      const store = transaction.objectStore('discs');
      const request = store.getAll();

      request.onsuccess = () => {
        const brands = new Set();
        const suppliers = new Set();
        const diameters = new Set();
        const widths = new Set();
        const cbValues = new Set();
        const etValues = new Set();
        const pcdValues = new Set();
        const pnValues = new Set();
        const diskTypes = new Set();

        request.result.forEach((item) => {
          const matchSupplier = matchesDiscStringField(item.supplier, filters.supplier);
          const matchDiameter = matchesTireDiameter(item.diameter, filters.diameter);
          const matchPcd = matchesTireNumericField(item.pcd, filters.pcd);
          const matchPn = matchesTireNumericField(item.pn, filters.pn);
          const matchDiskType = matchesDiscStringField(item.diskType, filters.diskType);
          const matchWidth = matchesDiscRange(item.width, filters.widthFrom, filters.widthTo);
          const matchCb = matchesDiscRange(item.cb, filters.cbFrom, filters.cbTo);
          const matchEt = matchesDiscRange(item.et, filters.etFrom, filters.etTo);

          // Опции поля X — без фильтра по X (диапазоны width/cb/et считаются парой)
          if (matchSupplier && matchPcd && matchPn && matchDiskType && matchWidth && matchCb && matchEt) {
            addUniqueValue(diameters, item.diameter);
          }
          if (matchSupplier && matchDiameter && matchPcd && matchDiskType && matchWidth && matchCb && matchEt) {
            addUniqueValue(pnValues, normalizeNumericFieldValue(item.pn));
          }
          if (matchSupplier && matchDiameter && matchPn && matchDiskType && matchWidth && matchCb && matchEt) {
            addUniqueValue(pcdValues, normalizeNumericFieldValue(item.pcd));
          }
          if (matchSupplier && matchDiameter && matchPcd && matchPn && matchDiskType && matchCb && matchEt) {
            addUniqueValue(widths, normalizeNumericFieldValue(item.width));
          }
          if (matchSupplier && matchDiameter && matchPcd && matchPn && matchDiskType && matchWidth && matchEt) {
            addUniqueValue(cbValues, normalizeNumericFieldValue(item.cb));
          }
          if (matchSupplier && matchDiameter && matchPcd && matchPn && matchDiskType && matchWidth && matchCb) {
            addUniqueValue(etValues, normalizeNumericFieldValue(item.et));
          }

          // brands/suppliers — по полному совпадению выбранных фильтров
          if (matchSupplier && matchDiameter && matchPcd && matchPn && matchDiskType && matchWidth && matchCb && matchEt) {
            addUniqueValue(brands, item.brand);
            addUniqueValue(suppliers, item.supplier);
            addUniqueValue(diskTypes, item.diskType);
          }
        });

        resolve({
          brands: Array.from(brands).sort(),
          suppliers: Array.from(suppliers).sort(),
          diameters: sortDiscDiameterValues(diameters),
          widths: sortDiscNumericValues(widths),
          cb: sortDiscNumericValues(cbValues),
          et: sortDiscNumericValues(etValues),
          pcd: sortDiscNumericValues(pcdValues),
          pn: sortDiscNumericValues(pnValues),
          diskTypes: Array.from(diskTypes).sort(),
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

}

const indexedDBService = new IndexedDBService();
export default indexedDBService;