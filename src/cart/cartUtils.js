/** Stable cart line key — catalog items already use unique `id` per supplier. */
export const getCartItemKey = (item) => {
  if (!item) return null;
  if (item.id != null && String(item.id).trim() !== '') return String(item.id);
  if (item.key != null && String(item.key).trim() !== '') return String(item.key);
  const supplier = item.supplier != null ? String(item.supplier) : '';
  const code = item.code != null ? String(item.code) : '';
  if (supplier || code) return `${supplier}::${code}`;
  return null;
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
export const isCatalogItemSellable = (item) => {
  if (!item) return false;
  if (!getCartItemKey(item)) return false;
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

export const snapshotCartItem = (item, quantity) => {
  const key = getCartItemKey(item);
  const maxStock = parseStock(item?.amount);
  return {
    key,
    quantity: clampCartQty(quantity, maxStock || quantity),
    maxStock,
    id: item.id ?? null,
    code: item.code ?? null,
    title: item.title ?? '',
    sizeTitle: item.sizeTitle ?? null,
    color: item.color ?? null,
    photoUrl: item.photoUrl ?? null,
    supplier: item.supplier ?? null,
    price: item.price ?? null,
    websitePrice: item.websitePrice ?? null,
    sellingPrice: item.sellingPrice ?? null,
    amount: item.amount ?? null,
    brand: item.brand ?? null,
    model: item.model ?? null,
    width: item.width ?? null,
    profile: item.profile ?? null,
    diameter: item.diameter ?? null,
    loadIndex: item.loadIndex ?? null,
    speedIndex: item.speedIndex ?? null,
    season: item.season ?? null,
    runflat: item.runflat ?? null,
  };
};
