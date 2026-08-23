import {
  CART_SYNC_CHANNEL,
  CART_SYNC_STORAGE_KEY,
  createCartSync,
} from './cartSync';
import { createCartEnvelope } from './cartStorage';

const envelope = (revision) =>
  createCartEnvelope({ items: [], revision, updatedAt: revision });

describe('cartSync', () => {
  let listeners;
  let windowObject;

  beforeEach(() => {
    listeners = new Set();
    windowObject = {
      BroadcastChannel: undefined,
      addEventListener: jest.fn((type, listener) => listeners.add(listener)),
      removeEventListener: jest.fn((type, listener) => listeners.delete(listener)),
    };
  });

  test('BroadcastChannel принимает только свой accountId', () => {
    const channels = [];
    class FakeBroadcastChannel {
      constructor(name) {
        this.name = name;
        this.postMessage = jest.fn();
        this.close = jest.fn();
        channels.push(this);
      }
    }
    const onEnvelope = jest.fn();
    const sync = createCartSync({
      accountId: 'a',
      windowObject,
      storage: localStorage,
      BroadcastChannelClass: FakeBroadcastChannel,
      onEnvelope,
    });
    expect(channels[0].name).toBe(CART_SYNC_CHANNEL);

    channels[0].onmessage({
      data: { accountId: 'b', envelope: envelope(1) },
    });
    channels[0].onmessage({
      data: { accountId: 'a', envelope: envelope(2) },
    });
    channels[0].onmessage({ data: { accountId: 'a', envelope: {} } });

    expect(onEnvelope).toHaveBeenCalledTimes(1);
    expect(onEnvelope).toHaveBeenCalledWith(envelope(2));
    sync.publish(envelope(3));
    expect(channels[0].postMessage).toHaveBeenCalledWith({
      accountId: 'a',
      envelope: envelope(3),
    });
    sync.close();
    expect(channels[0].close).toHaveBeenCalled();
  });

  test('storage fallback публикует и принимает событие без ретрансляции', () => {
    const storage = {
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const onEnvelope = jest.fn();
    const sync = createCartSync({
      accountId: 'a',
      windowObject,
      storage,
      BroadcastChannelClass: undefined,
      onEnvelope,
    });
    expect(sync.publish(envelope(1))).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      CART_SYNC_STORAGE_KEY,
      JSON.stringify({ accountId: 'a', envelope: envelope(1) })
    );
    expect(storage.removeItem).toHaveBeenCalledWith(CART_SYNC_STORAGE_KEY);

    const writesBeforeReceive = storage.setItem.mock.calls.length;
    listeners.forEach((listener) =>
      listener({
        key: CART_SYNC_STORAGE_KEY,
        newValue: JSON.stringify({
          accountId: 'a',
          envelope: envelope(2),
        }),
      })
    );
    expect(onEnvelope).toHaveBeenCalledWith(envelope(2));
    expect(storage.setItem).toHaveBeenCalledTimes(writesBeforeReceive);
  });

  test('после close отложенные события игнорируются', () => {
    const onEnvelope = jest.fn();
    const sync = createCartSync({
      accountId: 'a',
      windowObject,
      storage: localStorage,
      BroadcastChannelClass: undefined,
      onEnvelope,
    });
    const listener = [...listeners][0];
    sync.close();
    listener({
      key: CART_SYNC_STORAGE_KEY,
      newValue: JSON.stringify({ accountId: 'a', envelope: envelope(1) }),
    });
    expect(onEnvelope).not.toHaveBeenCalled();
  });
});
