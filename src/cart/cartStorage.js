import {
  getSafeCatalogStoreId,
  resolveCatalogStoreId,
} from '../services/catalogSync/catalogStoreNamespace';

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

/** Legacy account-only key (v3 without storeId). */
export const getCartAccountStorageKey = (accountId) =>
  `${CART_KEY_PREFIX}${String(accountId ?? '').trim()}`;

export const getCartStorageKey = (accountId, storeId) =>
  `${getCartAccountStorageKey(accountId)}.${getSafeCatalogStoreId(storeId)}`;

export const migrateAccountCartToStore = (storage, accountId, storeId) => {
  const resolvedStoreId = resolveCatalogStoreId(storeId);
  const nextKey = getCartStorageKey(accountId, resolvedStoreId);
  const legacyKey = getCartAccountStorageKey(accountId);
  const nextRaw = storage.getItem(nextKey);
  const nextEnvelope = parseCartEnvelope(nextRaw);
  const legacyRaw = storage.getItem(legacyKey);

  if (nextEnvelope) {
    if (legacyRaw != null) {
      try {
        storage.removeItem(legacyKey);
      } catch {
        /* best-effort */
      }
    }
    return nextEnvelope;
  }

  if (legacyRaw == null) return null;

  const legacyEnvelope = parseCartEnvelope(legacyRaw);
  if (!legacyEnvelope) return null;

  storage.setItem(nextKey, legacyRaw);
  storage.removeItem(legacyKey);
  return legacyEnvelope;
};

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

export const readCartEnvelope = (storage, accountId, storeId) =>
  migrateAccountCartToStore(storage, accountId, storeId);

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

export const writeCartEnvelope = (storage, accountId, storeId, envelope) => {
  const validEnvelope = validateCartEnvelope(envelope);
  if (
    !String(accountId ?? '').trim() ||
    !resolveCatalogStoreId(storeId) ||
    !validEnvelope
  ) {
    throw new TypeError('Invalid cart write');
  }
  storage.setItem(
    getCartStorageKey(accountId, storeId),
    JSON.stringify(validEnvelope)
  );
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
