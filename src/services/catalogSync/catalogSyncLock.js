import { resolveCatalogStoreId } from './catalogStoreNamespace';

export const CATALOG_SYNC_LOCK_PREFIX = 'ivanor.catalog.sync.';
export const CATALOG_SYNC_LS_LOCK_PREFIX = 'ivanor.catalog.sync.lock.';

const DEFAULT_LS_TTL_MS = 8_000;
const DEFAULT_LS_POLL_MS = 50;
const DEFAULT_LS_HEARTBEAT_MS = 2_500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getCatalogSyncLockName(storeId) {
  return `${CATALOG_SYNC_LOCK_PREFIX}${resolveCatalogStoreId(storeId)}`;
}

function getLsLockKey(storeId) {
  return `${CATALOG_SYNC_LS_LOCK_PREFIX}${resolveCatalogStoreId(storeId)}`;
}

function readLease(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const owner = typeof parsed.owner === 'string' ? parsed.owner : '';
    const expiresAt = Number(parsed.expiresAt);
    if (!owner || !Number.isFinite(expiresAt)) return null;
    return { owner, expiresAt };
  } catch {
    return null;
  }
}

function writeLease(storage, key, lease) {
  storage.setItem(key, JSON.stringify(lease));
}

function clearLeaseIfOwner(storage, key, owner) {
  const current = readLease(storage, key);
  if (current?.owner === owner) {
    storage.removeItem(key);
  }
}

/**
 * Fallback exclusive lease через localStorage (только если нет navigator.locks).
 * Steal по истечении TTL; heartbeat продлевает lease на время работы.
 */
async function withLocalStorageLease(storeId, fn, options = {}) {
  const {
    ttlMs = DEFAULT_LS_TTL_MS,
    pollMs = DEFAULT_LS_POLL_MS,
    heartbeatMs = DEFAULT_LS_HEARTBEAT_MS,
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    now = () => Date.now(),
  } = options;

  if (!storage) {
    return fn();
  }

  const key = getLsLockKey(storeId);
  const owner = `${now()}-${Math.random().toString(36).slice(2, 10)}`;

  for (;;) {
    const ts = now();
    const current = readLease(storage, key);
    if (!current || current.expiresAt <= ts) {
      writeLease(storage, key, { owner, expiresAt: ts + ttlMs });
      const verified = readLease(storage, key);
      if (verified?.owner === owner) break;
    }
    await sleep(pollMs);
  }

  let heartbeatId = null;
  if (typeof setInterval === 'function') {
    heartbeatId = setInterval(() => {
      const current = readLease(storage, key);
      if (current?.owner !== owner) return;
      writeLease(storage, key, { owner, expiresAt: now() + ttlMs });
    }, heartbeatMs);
  }

  try {
    return await fn();
  } finally {
    if (heartbeatId != null) clearInterval(heartbeatId);
    clearLeaseIfOwner(storage, key, owner);
  }
}

function hasWebLocks() {
  return (
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  );
}

/**
 * Exclusive writer lock на origin+storeId.
 * Основной путь: Web Locks API. Fallback: короткий LS-lease.
 *
 * @template T
 * @param {string} storeId
 * @param {() => Promise<T>|T} fn
 * @param {{ ttlMs?: number, pollMs?: number, heartbeatMs?: number, storage?: Storage, now?: () => number }} [options]
 * @returns {Promise<T>}
 */
export async function withCatalogSyncLock(storeId, fn, options = {}) {
  const resolvedStoreId = resolveCatalogStoreId(storeId);
  const lockName = getCatalogSyncLockName(resolvedStoreId);

  if (hasWebLocks()) {
    return navigator.locks.request(lockName, { mode: 'exclusive' }, () =>
      Promise.resolve().then(fn)
    );
  }

  return withLocalStorageLease(resolvedStoreId, fn, options);
}
