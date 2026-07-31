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

class IndexedDBService {
  constructor() {
    this.dbName = 'TireDatabase';
    this.discDbName = 'DiscDatabase';
    this.version = 1;
    this.discVersion = 2; // Увеличена версия для добавления новых индексов
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
        
        const tireStore = db.createObjectStore('tires', { 
          keyPath: 'id'
        });
    
        tireStore.createIndex('supplier', 'supplier', { unique: false });
        tireStore.createIndex('brand', 'brand', { unique: false });
        tireStore.createIndex('title', 'title', { unique: false });
        tireStore.createIndex('photoUrl', 'photoUrl', { unique: false });
        tireStore.createIndex('width', 'width', { unique: false });
        tireStore.createIndex('profile', 'profile', { unique: false });
        tireStore.createIndex('diameter', 'diameter', { unique: false });
        tireStore.createIndex('season', 'season', { unique: false });
        tireStore.createIndex('spikes', 'spikes', { unique: false });
        tireStore.createIndex('price', 'price', { unique: false });
        tireStore.createIndex('amount', 'amount', { unique: false });
      };
    });
  }

  async saveTires(tires) {
  try {
    if (!this.db) {
      await this.openDatabase();
    }

    if (!tires || !Array.isArray(tires) || tires.length === 0) {
      return Promise.resolve();
    }

    // Определяем поставщика из первой шины
    const supplier = tires[0]?.supplier;
    if (!supplier) {
      throw new Error('Не указан поставщик в данных шин');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tires'], 'readwrite');
      const store = transaction.objectStore('tires');
      let addErrors = [];
      
      transaction.onerror = () =>
        reject(transaction.error || new Error('Ошибка транзакции IndexedDB при сохранении шин'));
      
      transaction.oncomplete = () => {
        if (addErrors.length > 0) {
          reject(new Error(`Не удалось добавить ${addErrors.length} шин`));
        } else {
          resolve();
        }
      };
      
      // Очищаем старые записи поставщика
      const clearRequest = store.index('supplier').openCursor(IDBKeyRange.only(supplier));
      
      clearRequest.onsuccess = () => {
        const cursor = clearRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Когда очистка завершена - добавляем новые шины
          if (tires.length === 0) {
            resolve();
            return;
          }
          
          tires.forEach(tire => {
            // put вместо add: не падаем на дублях id, а перезаписываем
            const addRequest = store.put(tire);
            addRequest.onerror = (event) => {
              // иначе любая ошибка request по умолчанию абортит всю транзакцию
              event?.preventDefault?.();
              event?.stopPropagation?.();
              addErrors.push({
                tire: tire.title || tire.id,
                error: addRequest.error
              });
            };
          });
        }
      };
      
      clearRequest.onerror = () => reject(clearRequest.error || new Error('Ошибка IndexedDB при очистке шин поставщика'));
    });
  } catch (error) {
    throw error;
  }
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
  try {
    if (!this.discDb) {
      await this.openDiscDatabase();
    }

    if (!discs || !Array.isArray(discs) || discs.length === 0) {
      return Promise.resolve();
    }

    // Определяем поставщика из первого диска
    const supplier = discs[0]?.supplier;
    if (!supplier) {
      throw new Error('Не указан поставщик в данных дисков');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.discDb.transaction(['discs'], 'readwrite');
      const store = transaction.objectStore('discs');
      let addErrors = [];
      
      transaction.onerror = () =>
        reject(transaction.error || new Error('Ошибка транзакции IndexedDB при сохранении дисков'));
      
      transaction.oncomplete = () => {
        if (addErrors.length > 0) {
          reject(new Error(`Не удалось добавить ${addErrors.length} дисков`));
        } else {
          resolve();
        }
      };
      
      // Очищаем старые записи поставщика
      const clearRequest = store.index('supplier').openCursor(IDBKeyRange.only(supplier));
      
      clearRequest.onsuccess = () => {
        const cursor = clearRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Когда очистка завершена - добавляем новые диски
          if (discs.length === 0) {
            resolve();
            return;
          }
          
          discs.forEach(disc => {
            // put вместо add: не падаем на дублях id, а перезаписываем
            const addRequest = store.put(disc);
            addRequest.onerror = (event) => {
              event?.preventDefault?.();
              event?.stopPropagation?.();
              addErrors.push({
                disc: disc.title || disc.id,
                error: addRequest.error
              });
            };
          });
        }
      };
      
      clearRequest.onerror = () => reject(clearRequest.error || new Error('Ошибка IndexedDB при очистке дисков поставщика'));
    });
  } catch (error) {
    throw error;
  }
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