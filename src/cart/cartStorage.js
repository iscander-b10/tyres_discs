export const CART_STORAGE_VERSION = 3;
export const CART_KEY_PREFIX = 'cart.staff.v3.';

const OPTIONAL_NUMERIC_FIELDS = Object.freeze([
  'amount',
  'maxStock',
  'price',
  'sellingPrice',
  'websitePrice',
]);

const isFiniteNumberLike = (value) => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || !value.trim()) return false;
  return /^[+-]?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)$/.test(value.trim());
};

export const getCartStorageKey = (accountId) =>
  `${CART_KEY_PREFIX}${String(accountId ?? '').trim()}`;

export const isValidCartItem = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (typeof item.key !== 'string' || !item.key.trim()) return false;
  if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return false;

  return OPTIONAL_NUMERIC_FIELDS.every((field) => {
    if (item[field] == null || item[field] === '') return true;
    if (!isFiniteNumberLike(item[field])) return false;
    return Number(String(item[field]).replace(',', '.')) >= 0;
  });
};

export const validateCartItems = (items) => {
  if (!Array.isArray(items) || !items.every(isValidCartItem)) return null;
  const keys = items.map((item) => item.key);
  return new Set(keys).size === keys.length ? items : null;
};

export const validateCartEnvelope = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.version !== CART_STORAGE_VERSION) return null;
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) return null;
  if (!Number.isFinite(value.updatedAt) || value.updatedAt < 0) return null;
  if (!validateCartItems(value.items)) return null;
  return value;
};

export const parseCartEnvelope = (raw) => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return validateCartEnvelope(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const readCartEnvelope = (storage, accountId) =>
  parseCartEnvelope(storage.getItem(getCartStorageKey(accountId)));

export const createCartEnvelope = ({
  items,
  revision = 0,
  updatedAt = Date.now(),
}) => {
  const envelope = {
    version: CART_STORAGE_VERSION,
    revision,
    updatedAt,
    items,
  };
  if (!validateCartEnvelope(envelope)) {
    throw new TypeError('Invalid cart snapshot');
  }
  return envelope;
};

export const writeCartEnvelope = (storage, accountId, envelope) => {
  const validEnvelope = validateCartEnvelope(envelope);
  if (!String(accountId ?? '').trim() || !validEnvelope) {
    throw new TypeError('Invalid cart write');
  }
  storage.setItem(getCartStorageKey(accountId), JSON.stringify(validEnvelope));
};

export const isEnvelopeNewer = (candidate, current) => {
  if (!validateCartEnvelope(candidate)) return false;
  if (!current) return true;
  return (
    candidate.revision > current.revision ||
    (candidate.revision === current.revision &&
      candidate.updatedAt > current.updatedAt)
  );
};
