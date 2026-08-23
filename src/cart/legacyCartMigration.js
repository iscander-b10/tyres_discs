import {
  createCartEnvelope,
  getCartStorageKey,
  parseCartEnvelope,
  readCartEnvelope,
  validateCartItems,
  writeCartEnvelope,
} from './cartStorage';

export const LEGACY_CART_KEYS = Object.freeze([
  'cart.staff.v2',
  'cart.staff.v1',
  'ivanor.cart.v1',
]);

const MARKER_PREFIX = 'cart.staff.v3.legacy-decision.';

const readLegacyItems = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return validateCartItems(parsed);
    if (
      parsed &&
      (parsed.version === 1 || parsed.version === 2) &&
      Array.isArray(parsed.items)
    ) {
      return validateCartItems(parsed.items);
    }
  } catch {
    return null;
  }
  return null;
};

const getMarkerKey = (accountId, keys) =>
  `${MARKER_PREFIX}${accountId}.${keys.map(encodeURIComponent).join('.')}`;

export function detectLegacyCart(storage, accountId) {
  const sources = [];
  try {
    LEGACY_CART_KEYS.forEach((key) => {
      const raw = storage.getItem(key);
      if (raw != null) sources.push({ key, raw });
    });
  } catch {
    return null;
  }
  if (sources.length === 0) return null;

  const keys = sources.map(({ key }) => key);
  const markerKey = getMarkerKey(accountId, keys);
  try {
    if (storage.getItem(markerKey)) return null;
  } catch {
    return null;
  }

  const parsedSources = sources.map(({ key, raw }) => ({
    key,
    items: readLegacyItems(raw),
  }));
  const selectedSource = parsedSources[0];

  return {
    accountId,
    keys,
    sources,
    markerKey,
    status: selectedSource.items ? 'valid' : 'corrupted',
    items: selectedSource.items ?? null,
  };
}

const writeMarker = (storage, detection, decision) => {
  storage.setItem(
    detection.markerKey,
    JSON.stringify({ decision, decidedAt: Date.now() })
  );
};

const removeLegacyKeys = (storage, keys) => {
  keys.forEach((key) => storage.removeItem(key));
};

const restoreLegacySources = (storage, sources) => {
  sources.forEach(({ key, raw }) => storage.setItem(key, raw));
};

const commitLegacyDecision = (storage, detection, decision) => {
  try {
    removeLegacyKeys(storage, detection.keys);
    writeMarker(storage, detection, decision);
  } catch (error) {
    try {
      storage.removeItem(detection.markerKey);
      restoreLegacySources(storage, detection.sources);
    } catch {
      /* best-effort rollback */
    }
    throw error;
  }
};

export function migrateLegacyCart(storage, detection) {
  if (!detection || detection.status !== 'valid' || !detection.items) {
    throw new TypeError('Legacy cart cannot be migrated');
  }

  const previousRaw = storage.getItem(getCartStorageKey(detection.accountId));
  const previousEnvelope = parseCartEnvelope(previousRaw);
  const existingItems = previousEnvelope?.items ?? [];
  const existingKeys = new Set(existingItems.map((item) => item.key));
  const mergedItems = [
    ...existingItems,
    ...detection.items.filter((item) => !existingKeys.has(item.key)),
  ];
  const envelope = createCartEnvelope({
    items: mergedItems,
    revision: (previousEnvelope?.revision ?? 0) + 1,
    updatedAt: Date.now(),
  });

  try {
    writeCartEnvelope(storage, detection.accountId, envelope);
    const verified = readCartEnvelope(storage, detection.accountId);
    if (
      !verified ||
      verified.revision !== envelope.revision ||
      JSON.stringify(verified.items) !== JSON.stringify(envelope.items)
    ) {
      throw new Error('Cart verification failed');
    }
  } catch (error) {
    try {
      if (previousRaw == null) {
        storage.removeItem(getCartStorageKey(detection.accountId));
      } else {
        storage.setItem(getCartStorageKey(detection.accountId), previousRaw);
      }
    } catch {
      /* best-effort rollback */
    }
    throw error;
  }

  try {
    commitLegacyDecision(storage, detection, 'migrated');
  } catch (error) {
    try {
      if (previousRaw == null) {
        storage.removeItem(getCartStorageKey(detection.accountId));
      } else {
        storage.setItem(getCartStorageKey(detection.accountId), previousRaw);
      }
    } catch {
      /* best-effort rollback */
    }
    throw error;
  }
  return envelope;
}

export function discardLegacyCart(storage, detection) {
  if (!detection) throw new TypeError('Legacy cart is required');
  commitLegacyDecision(storage, detection, 'discarded');
}
