const CHANNEL_NAME = 'ivanor.catalog.sync';
const STORAGE_KEY = 'ivanor.catalog.cloudVersion';

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
 */
export function postCatalogApplied(version) {
  if (!version) return;

  try {
    getChannel()?.postMessage({ type: 'catalog-applied', version });
  } catch {
    /* ignore */
  }
}

/**
 * Подписка на commit snapshot в других вкладках.
 * @param {(version: string) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeCatalogApplied(listener) {
  const bus = getChannel();
  const onMessage = (event) => {
    if (event?.data?.type === 'catalog-applied' && event.data.version) {
      listener(event.data.version);
    }
  };

  const onStorage = (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
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
