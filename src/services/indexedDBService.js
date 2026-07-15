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

const matchesTireParameterFilters = (item, filters = {}) => {
  if (filters.width && item.width != filters.width) return false;
  if (filters.profile && item.profile != filters.profile) return false;
  if (filters.diameter && item.diameter != filters.diameter) return false;
  if (filters.season && item.season !== filters.season) return false;
  return true;
};

const matchesDiscParameterFilters = (item, filters = {}) => {
  const widthNumber = item.width === undefined || item.width === null ? null : Number(item.width);
  const cbNumber = item.cb === undefined || item.cb === null ? null : Number(item.cb);
  const etNumber = item.et === undefined || item.et === null ? null : Number(item.et);
  const widthFromNumber =
    filters.widthFrom === undefined || filters.widthFrom === null || filters.widthFrom === ''
      ? null
      : Number(filters.widthFrom);
  const widthToNumber =
    filters.widthTo === undefined || filters.widthTo === null || filters.widthTo === ''
      ? null
      : Number(filters.widthTo);
  const cbFromNumber =
    filters.cbFrom === undefined || filters.cbFrom === null || filters.cbFrom === ''
      ? null
      : Number(filters.cbFrom);
  const cbToNumber =
    filters.cbTo === undefined || filters.cbTo === null || filters.cbTo === ''
      ? null
      : Number(filters.cbTo);
  const etFromNumber =
    filters.etFrom === undefined || filters.etFrom === null || filters.etFrom === ''
      ? null
      : Number(filters.etFrom);
  const etToNumber =
    filters.etTo === undefined || filters.etTo === null || filters.etTo === ''
      ? null
      : Number(filters.etTo);

  if (!matchesBrandFilter(item.brand, filters.brand)) return false;
  if (filters.supplier && item.supplier !== filters.supplier) return false;
  if (filters.diameter && item.diameter !== filters.diameter) return false;
  if (filters.pcd && item.pcd !== filters.pcd) return false;
  if (filters.pn && item.pn !== filters.pn) return false;
  if (filters.diskType && item.diskType !== filters.diskType) return false;
  if (widthFromNumber !== null && (Number.isNaN(widthNumber) || widthNumber < widthFromNumber)) return false;
  if (widthToNumber !== null && (Number.isNaN(widthNumber) || widthNumber > widthToNumber)) return false;
  if (cbFromNumber !== null && (Number.isNaN(cbNumber) || cbNumber < cbFromNumber)) return false;
  if (cbToNumber !== null && (Number.isNaN(cbNumber) || cbNumber > cbToNumber)) return false;
  if (etFromNumber !== null && (Number.isNaN(etNumber) || etNumber < etFromNumber)) return false;
  if (etToNumber !== null && (Number.isNaN(etNumber) || etNumber > etToNumber)) return false;
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
      let addsCompleted = 0;
      
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
            addRequest.onsuccess = () => {
              addsCompleted++;
            };
            addRequest.onerror = (event) => {
              // иначе любая ошибка request по умолчанию абортит всю транзакцию
              event?.preventDefault?.();
              event?.stopPropagation?.();
              addErrors.push({
                tire: tire.title || tire.id,
                error: addRequest.error
              });
              addsCompleted++;
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
    } else {
      if (filters.width) {
        request = store.index('width').openCursor(IDBKeyRange.only(filters.width));
      } else if (filters.diameter) {
        request = store.index('diameter').openCursor(IDBKeyRange.only(filters.diameter));
      } else if (filters.profile) {
        request = store.index('profile').openCursor(IDBKeyRange.only(filters.profile));
      } else if (singleBrand) {
        request = store.index('brand').openCursor(IDBKeyRange.only(singleBrand));
      } else if (filters.supplier) {
        request = store.index('supplier').openCursor(IDBKeyRange.only(filters.supplier));
      } else if (filters.season) {
        request = store.index('season').openCursor(IDBKeyRange.only(filters.season));
      } else {
        // Если используется только фильтр spikes или другие фильтры без индекса,
        // открываем курсор по всем записям, фильтрация будет в matches
        request = store.openCursor();
      }
    }
    
    const results = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const tire = cursor.value;
        const tireAmountNumber = Number(tire.amount);
        const minAmountNumber = filters.minAmount === undefined || filters.minAmount === null ? null : Number(filters.minAmount);
        
        const matches = (
          (!filters.profile || tire.profile == filters.profile) &&
          (!filters.diameter || tire.diameter == filters.diameter) &&
          (!filters.season || tire.season === filters.season) &&
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
        const filteredItems = request.result.filter((item) => matchesTireParameterFilters(item, filters));

        const widths = new Set();
        const profiles = new Set();
        const diameters = new Set();
        const seasons = new Set();
        const brands = new Set();
        const suppliers = new Set();

        filteredItems.forEach((item) => {
          addUniqueValue(widths, normalizeNumericFieldValue(item.width));
          addUniqueValue(profiles, normalizeNumericFieldValue(item.profile));
          addUniqueValue(diameters, item.diameter);
          addUniqueValue(seasons, item.season);
          addUniqueValue(brands, item.brand);
          addUniqueValue(suppliers, item.supplier);
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

  async getUniqueValues(fieldName, filters = {}) {
    const options = await this.getAvailableParameterOptions(filters);
    const fieldMap = {
      width: 'widths',
      profile: 'profiles',
      diameter: 'diameters',
      season: 'seasons',
      brand: 'brands',
      supplier: 'suppliers',
    };

    return options[fieldMap[fieldName]] ?? [];
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
      let addsCompleted = 0;
      
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
            addRequest.onsuccess = () => {
              addsCompleted++;
            };
            addRequest.onerror = (event) => {
              event?.preventDefault?.();
              event?.stopPropagation?.();
              addErrors.push({
                disc: disc.title || disc.id,
                error: addRequest.error
              });
              addsCompleted++;
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
      } else {
        if (singleBrand) {
          request = store.index('brand').openCursor(IDBKeyRange.only(singleBrand));
        } else if (filters.supplier) {
          request = store.index('supplier').openCursor(IDBKeyRange.only(filters.supplier));
        } else if (filters.diameter) {
          request = store.index('diameter').openCursor(IDBKeyRange.only(filters.diameter));
        } else if (filters.pcd) {
          request = store.index('pcd').openCursor(IDBKeyRange.only(filters.pcd));
        } else if (filters.pn) {
          request = store.index('pn').openCursor(IDBKeyRange.only(filters.pn));
        } else if (filters.diskType) {
          request = store.index('diskType').openCursor(IDBKeyRange.only(filters.diskType));
        } else {
          request = store.openCursor();
        }
      }
      
      const results = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const disc = cursor.value;
          const discAmountNumber = Number(disc.amount);
          const minAmountNumber = filters.minAmount === undefined || filters.minAmount === null ? null : Number(filters.minAmount);
          const widthNumber = disc.width === undefined || disc.width === null ? null : Number(disc.width);
          const cbNumber = disc.cb === undefined || disc.cb === null ? null : Number(disc.cb);
          const etNumber = disc.et === undefined || disc.et === null ? null : Number(disc.et);
          const widthFromNumber = filters.widthFrom === undefined || filters.widthFrom === null || filters.widthFrom === '' ? null : Number(filters.widthFrom);
          const widthToNumber = filters.widthTo === undefined || filters.widthTo === null || filters.widthTo === '' ? null : Number(filters.widthTo);
          const cbFromNumber = filters.cbFrom === undefined || filters.cbFrom === null || filters.cbFrom === '' ? null : Number(filters.cbFrom);
          const cbToNumber = filters.cbTo === undefined || filters.cbTo === null || filters.cbTo === '' ? null : Number(filters.cbTo);
          const etFromNumber = filters.etFrom === undefined || filters.etFrom === null || filters.etFrom === '' ? null : Number(filters.etFrom);
          const etToNumber = filters.etTo === undefined || filters.etTo === null || filters.etTo === '' ? null : Number(filters.etTo);
          
          const matches = (
            matchesBrandFilter(disc.brand, filters.brand) &&
            (!filters.supplier || disc.supplier === filters.supplier) &&
            (!filters.diameter || disc.diameter === filters.diameter) &&
            (!filters.pcd || disc.pcd === filters.pcd) &&
            (!filters.pn || disc.pn === filters.pn) &&
            (!filters.diskType || disc.diskType === filters.diskType) &&
            (minAmountNumber === null || (!Number.isNaN(discAmountNumber) && discAmountNumber >= minAmountNumber)) &&
            (widthFromNumber === null || (!Number.isNaN(widthNumber) && widthNumber >= widthFromNumber)) &&
            (widthToNumber === null || (!Number.isNaN(widthNumber) && widthNumber <= widthToNumber)) &&
            (cbFromNumber === null || (!Number.isNaN(cbNumber) && cbNumber >= cbFromNumber)) &&
            (cbToNumber === null || (!Number.isNaN(cbNumber) && cbNumber <= cbToNumber)) &&
            (etFromNumber === null || (!Number.isNaN(etNumber) && etNumber >= etFromNumber)) &&
            (etToNumber === null || (!Number.isNaN(etNumber) && etNumber <= etToNumber))
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
        const filteredItems = request.result.filter((item) => matchesDiscParameterFilters(item, filters));

        const brands = new Set();
        const suppliers = new Set();
        const diameters = new Set();
        const widths = new Set();
        const cbValues = new Set();
        const etValues = new Set();
        const pcdValues = new Set();
        const pnValues = new Set();
        const diskTypes = new Set();

        filteredItems.forEach((item) => {
          addUniqueValue(brands, item.brand);
          addUniqueValue(suppliers, item.supplier);
          addUniqueValue(diameters, item.diameter);
          addUniqueValue(widths, normalizeNumericFieldValue(item.width));
          addUniqueValue(cbValues, normalizeNumericFieldValue(item.cb));
          addUniqueValue(etValues, normalizeNumericFieldValue(item.et));
          addUniqueValue(pcdValues, item.pcd);
          addUniqueValue(pnValues, normalizeNumericFieldValue(item.pn));
          addUniqueValue(diskTypes, item.diskType);
        });

        resolve({
          brands: Array.from(brands).sort(),
          suppliers: Array.from(suppliers).sort(),
          diameters: sortDiscDiameterValues(diameters),
          widths: sortDiscNumericValues(widths),
          cb: sortDiscNumericValues(cbValues),
          et: sortDiscNumericValues(etValues),
          pcd: Array.from(pcdValues).sort(),
          pn: sortDiscNumericValues(pnValues),
          diskTypes: Array.from(diskTypes).sort(),
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getUniqueDiscValues(fieldName, filters = {}) {
    const options = await this.getAvailableDiscParameterOptions(filters);
    const fieldMap = {
      brand: 'brands',
      supplier: 'suppliers',
      diameter: 'diameters',
      width: 'widths',
      cb: 'cb',
      et: 'et',
      pcd: 'pcd',
      pn: 'pn',
      diskType: 'diskTypes',
    };

    return options[fieldMap[fieldName]] ?? [];
  }

}

const indexedDBService = new IndexedDBService();
export default indexedDBService;