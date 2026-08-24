import {
  getCatalogVersionKey,
  resolveCatalogStoreId,
} from './catalogStoreNamespace';

const CHANNEL_NAME = 'ivanor.catalog.sync';

/** Отдельный ключ ping (setItem + removeItem), как у корзины. */
export const CATALOG_SYNC_EVENT_KEY = 'ivanor.catalog.sync.event';

let channel = null;

const getChannel = () => {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
};

const pingLocalStorage = (payload) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      CATALOG_SYNC_EVENT_KEY,
      JSON.stringify(payload)
    );
    window.localStorage.removeItem(CATALOG_SYNC_EVENT_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Уведомляет другие вкладки об успешном commit snapshot.
 * BroadcastChannel + LS-ping (даже если cloudVersion не изменился).
 * @param {string} version
 * @param {string} [storeId]
 */
export function postCatalogApplied(version, storeId) {
  if (!version) return;

  const payload = {
    type: 'catalog-applied',
    storeId: resolveCatalogStoreId(storeId),
    version,
  };

  try {
    getChannel()?.postMessage(payload);
  } catch {
    /* ignore */
  }

  pingLocalStorage(payload);
}

/**
 * Подписка на commit snapshot в других вкладках.
 * @param {(version: string) => void} listener
 * @param {string} [storeId]
 * @returns {() => void} unsubscribe
 */
export function subscribeCatalogApplied(listener, storeId) {
  const expectedStoreId = resolveCatalogStoreId(storeId);
  const storageKey = getCatalogVersionKey(expectedStoreId);
  const bus = getChannel();
  const onMessage = (event) => {
    if (
      event?.data?.type === 'catalog-applied' &&
      event.data.storeId === expectedStoreId &&
      event.data.version
    ) {
      listener(event.data.version);
    }
  };

  const onStorage = (event) => {
    if (event.key === storageKey && event.newValue) {
      listener(event.newValue);
      return;
    }
    if (event.key !== CATALOG_SYNC_EVENT_KEY || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      if (
        data?.type === 'catalog-applied' &&
        data.storeId === expectedStoreId &&
        data.version
      ) {
        listener(data.version);
      }
    } catch {
      /* malformed foreign event */
    }
  };

  bus?.addEventListener('message', onMessage);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    bus?.removeEventListener('message', onMessage);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}
