import {
  getCatalogVersionKey,
  resolveCatalogStoreId,
} from './catalogStoreNamespace';

const CHANNEL_NAME = 'ivanor.catalog.sync';

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

/**
 * Уведомляет другие вкладки об успешном commit snapshot.
 * @param {string} version
 * @param {string} [storeId]
 */
export function postCatalogApplied(version, storeId) {
  if (!version) return;

  try {
    getChannel()?.postMessage({
      type: 'catalog-applied',
      storeId: resolveCatalogStoreId(storeId),
      version,
    });
  } catch {
    /* ignore */
  }
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
