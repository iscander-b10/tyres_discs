export const CART_CATEGORIES = Object.freeze({
  tyres: 'tyres',
  discs: 'discs',
});

export const isCartCategory = (category) =>
  category === CART_CATEGORIES.tyres || category === CART_CATEGORIES.discs;

/** Stable cart line key. IDs are unique only inside a catalog category. */
export const getCartItemKey = (item, category = item?.category) => {
  if (!item) return null;
  if (!isCartCategory(category)) return null;
  if (item.id == null || String(item.id).trim() === '') return null;
  return `${category}:${String(item.id)}`;
};

/**
 * Строгая нормализация числа для корзины: вся строка должна быть числом.
 * Допускает десятичную запятую и окружающие пробелы.
 */
const parseStrictNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)$/.test(trimmed)) return null;
  const num = Number(trimmed.replace(',', '.'));
  return Number.isFinite(num) ? num : null;
};

export const parseStock = (amount) => {
  if (amount == null || amount === '') return 0;
  const num = parseStrictNumber(amount);
  if (num == null || num <= 0) return 0;
  return Math.floor(num);
};

/** Default qty: min(4, stock). Zero stock → 0 (cannot add). */
export const getDefaultCartQty = (amount) => {
  const stock = parseStock(amount);
  if (stock <= 0) return 0;
  return Math.min(4, stock);
};

const parsePositivePrice = (raw) => {
  if (raw == null || raw === '') return 0;
  const num = parseStrictNumber(raw);
  return num != null && num > 0 ? num : 0;
};

/**
 * Цена продажи: сначала sellingPrice, при невалидном — fallback на price.
 * Невалидный sellingPrice не блокирует валидный price.
 */
export const getUnitSellingPrice = (item) => {
  if (!item) return 0;
  const selling = parsePositivePrice(item.sellingPrice);
  if (selling > 0) return selling;
  return parsePositivePrice(item.price);
};

export const getUnitB2bPrice = (item) => {
  if (!item) return 0;
  return parsePositivePrice(item.price);
};

export const getUnitWebsitePrice = (item) => {
  if (!item) return 0;
  return parsePositivePrice(item.websitePrice);
};

/**
 * Товар можно добавить в корзину только при stock > 0 и положительной цене.
 */
export const isCatalogItemSellable = (item, category = item?.category) => {
  if (!item) return false;
  if (!getCartItemKey(item, category)) return false;
  if (parseStock(item.amount) <= 0) return false;
  return getUnitSellingPrice(item) > 0;
};

export const clampCartQty = (qty, maxStock) => {
  const stock = parseStock(maxStock);
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n) || n < 1) return 1;
  if (stock > 0) return Math.min(n, stock);
  return n;
};

export const snapshotCartItem = (item, category, quantity) => {
  const key = getCartItemKey(item, category);
  const maxStock = parseStock(item?.amount);
  return {
    ...item,
    key,
    category,
    quantity: clampCartQty(quantity, maxStock || quantity),
    maxStock,
    id: String(item.id),
  };
};

const matchesLegacyIdentity = (line, item) => {
  if (!line?.supplier || !line?.code) return false;
  return (
    String(item?.supplier ?? '') === String(line.supplier) &&
    String(item?.code ?? '') === String(line.code)
  );
};

const resolveCatalogMatch = (line, result) => {
  if (isCartCategory(line.category)) {
    return {
      category: line.category,
      item: result.matches?.[line.category] ?? null,
    };
  }

  const candidates = Object.entries(result.matches || {}).filter(
    ([category, item]) => isCartCategory(category) && item
  );
  if (candidates.length === 1) {
    return { category: candidates[0][0], item: candidates[0][1] };
  }
  if (candidates.length !== 2) return null;

  const identityMatches = candidates.filter(([, item]) =>
    matchesLegacyIdentity(line, item)
  );
  if (identityMatches.length !== 1) return null;
  return { category: identityMatches[0][0], item: identityMatches[0][1] };
};

/**
 * Pure cart reconciliation. Lines absent from the read scope are preserved:
 * they may have been added while IndexedDB was being read.
 */
export const reconcileCartItems = (currentItems, catalogResults) => {
  const resultsByRequestKey = new Map(
    (catalogResults || []).map((result) => [result.requestKey, result])
  );

  return currentItems.flatMap((line) => {
    const requestKey = line.category
      ? getCartItemKey(line, line.category)
      : line.key;
    const result = resultsByRequestKey.get(requestKey);
    if (!result) return [line];

    const match = resolveCatalogMatch(line, result);
    if (!match || !isCatalogItemSellable(match.item, match.category)) return [];

    return [
      snapshotCartItem(
        match.item,
        match.category,
        clampCartQty(line.quantity, match.item.amount)
      ),
    ];
  });
};
