export const isValidCatalogKey = (value) =>
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

export const canBeStoredInIndexedDB = (value) => {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.structuredClone === 'function'
    ) {
      window.structuredClone(value);
      return true;
    }
    return isStructuredCloneableFallback(value);
  } catch {
    return false;
  }
};

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
