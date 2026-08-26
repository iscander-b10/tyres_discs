export const isValidCatalogKey = (value) =>
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isFinite(value));

/**
 * IndexedDB structured-clone check without calling structuredClone.
 * JSON.parse snapshot items are plain data; cloning tens of thousands of SKU
 * on the main thread freezes the store PC during cold-start apply.
 */
export const isIndexedDbCloneable = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return true;
  const type = typeof value;
  if (
    type === 'string' ||
    type === 'boolean' ||
    type === 'bigint' ||
    type === 'number'
  ) {
    return true;
  }
  if (type === 'function' || type === 'symbol') return false;
  if (type !== 'object') return false;
  if (seen.has(value)) return true;
  if (
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof Promise
  ) {
    return false;
  }
  if (value instanceof Date) return true;

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        if (!isIndexedDbCloneable(value[i], seen)) return false;
      }
      return true;
    }
    const keys = Reflect.ownKeys(value);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (typeof key === 'symbol') return false;
      if (!isIndexedDbCloneable(value[key], seen)) return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const canBeStoredInIndexedDB = (value) => isIndexedDbCloneable(value);

export const isValidCatalogItem = (item) =>
  item !== null &&
  typeof item === 'object' &&
  !Array.isArray(item) &&
  isValidCatalogKey(item.id) &&
  isValidCatalogKey(item.supplier) &&
  canBeStoredInIndexedDB(item);

export const validateCatalogItemsForSupplier = (
  items,
  supplier,
  entityName = 'товары'
) => {
  if (!isValidCatalogKey(supplier)) {
    throw new TypeError(`Поставщик для категории «${entityName}» обязателен`);
  }
  if (!Array.isArray(items)) {
    throw new TypeError(`Данные ${entityName} должны быть массивом`);
  }

  items.forEach((item, index) => {
    if (!isValidCatalogItem(item)) {
      throw new TypeError(
        `Некорректный товар ${entityName} с индексом ${index}`
      );
    }
    if (item.supplier !== supplier) {
      throw new Error(
        `Поставщик товара ${entityName} с индексом ${index} не совпадает с явным supplier`
      );
    }
  });
};

export const prepareCatalogItems = (items, entityName) => {
  if (!Array.isArray(items)) {
    throw new TypeError(`Данные ${entityName} должны быть массивом`);
  }
  if (items.length === 0) {
    return { validItems: [], supplier: null, skipped: 0 };
  }

  const individuallyValid = items.filter(isValidCatalogItem);
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
