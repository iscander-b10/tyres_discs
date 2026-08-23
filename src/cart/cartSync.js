import { validateCartEnvelope } from './cartStorage';

export const CART_SYNC_CHANNEL = 'cart.staff.v3.sync';
export const CART_SYNC_STORAGE_KEY = 'cart.staff.v3.sync.event';

const parseMessage = (value) => {
  if (!value || typeof value !== 'object') return null;
  const accountId =
    typeof value.accountId === 'string' ? value.accountId.trim() : '';
  if (!accountId || !validateCartEnvelope(value.envelope)) return null;
  return { accountId, envelope: value.envelope };
};

export function createCartSync({
  accountId,
  storage = window.localStorage,
  windowObject = window,
  BroadcastChannelClass = window.BroadcastChannel,
  onEnvelope,
}) {
  let channel = null;
  let closed = false;

  const receive = (rawMessage) => {
    if (closed) return;
    const message = parseMessage(rawMessage);
    if (!message || message.accountId !== accountId) return;
    onEnvelope(message.envelope);
  };

  const onStorage = (event) => {
    if (event.key !== CART_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      /* malformed foreign event */
    }
  };

  windowObject.addEventListener('storage', onStorage);
  if (typeof BroadcastChannelClass === 'function') {
    try {
      channel = new BroadcastChannelClass(CART_SYNC_CHANNEL);
      channel.onmessage = (event) => receive(event.data);
    } catch {
      channel = null;
    }
  }

  return {
    publish(envelope) {
      if (closed || !validateCartEnvelope(envelope)) return false;
      const message = { accountId, envelope };
      if (channel) {
        channel.postMessage(message);
        return true;
      }
      try {
        storage.setItem(CART_SYNC_STORAGE_KEY, JSON.stringify(message));
        storage.removeItem(CART_SYNC_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
    close() {
      if (closed) return;
      closed = true;
      windowObject.removeEventListener('storage', onStorage);
      if (channel) channel.close();
    },
  };
}
