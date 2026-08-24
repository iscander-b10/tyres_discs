import {
  CATALOG_SYNC_LS_LOCK_PREFIX,
  getCatalogSyncLockName,
  withCatalogSyncLock,
} from './catalogSyncLock';

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const flushMicrotasks = async (times = 8) => {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const createFakeWebLocks = () => {
  const queues = new Map();

  const pump = (name) => {
    const queue = queues.get(name) || [];
    const head = queue[0];
    if (!head || head.started) return;
    head.started = true;
    Promise.resolve()
      .then(() => head.cb())
      .then(
        (value) => {
          if (!head.abandoned) head.resolve(value);
        },
        (err) => {
          if (!head.abandoned) head.reject(err);
        }
      )
      .finally(() => {
        if (head.abandoned) return;
        queue.shift();
        pump(name);
      });
  };

  return {
    request(name, options, callback) {
      const cb = typeof options === 'function' ? options : callback;
      return new Promise((resolve, reject) => {
        const queue = queues.get(name) || [];
        queues.set(name, queue);
        queue.push({ resolve, reject, cb, started: false, abandoned: false });
        pump(name);
      });
    },
    /** Закрытие вкладки-holder: снять lock без завершения callback. */
    releaseHolder(name) {
      const queue = queues.get(name) || [];
      const head = queue[0];
      if (!head) return;
      head.abandoned = true;
      head.reject(new Error('tab closed'));
      queue.shift();
      pump(name);
    },
  };
};

describe('withCatalogSyncLock', () => {
  const originalLocks = navigator.locks;

  afterEach(() => {
    if (originalLocks === undefined) {
      delete navigator.locks;
    } else {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: originalLocks,
      });
    }
    window.localStorage.clear();
    jest.useRealTimers();
  });

  test('Web Locks: второй ждёт, после завершения первого входит', async () => {
    const locks = createFakeWebLocks();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: locks,
    });

    const order = [];
    const first = deferred();

    const p1 = withCatalogSyncLock('store-a', async () => {
      order.push('enter-1');
      await first.promise;
      order.push('leave-1');
      return 'one';
    });

    await flushMicrotasks();
    expect(order).toEqual(['enter-1']);

    const p2 = withCatalogSyncLock('store-a', async () => {
      order.push('enter-2');
      return 'two';
    });

    await flushMicrotasks();
    expect(order).toEqual(['enter-1']);

    first.resolve();
    await expect(p1).resolves.toBe('one');
    await expect(p2).resolves.toBe('two');
    expect(order).toEqual(['enter-1', 'leave-1', 'enter-2']);
    expect(getCatalogSyncLockName('store-a')).toBe('ivanor.catalog.sync.store-a');
  });

  test('Web Locks: после crash первого второй входит', async () => {
    const locks = createFakeWebLocks();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: locks,
    });

    const held = deferred();
    let secondEntered = false;
    const lockName = getCatalogSyncLockName('store-a');

    const firstPromise = withCatalogSyncLock('store-a', () => held.promise);
    await flushMicrotasks();

    const secondPromise = withCatalogSyncLock('store-a', async () => {
      secondEntered = true;
      return 'recovered';
    });
    await flushMicrotasks();
    expect(secondEntered).toBe(false);

    locks.releaseHolder(lockName);

    await expect(firstPromise).rejects.toThrow('tab closed');
    await expect(secondPromise).resolves.toBe('recovered');
    expect(secondEntered).toBe(true);
  });

  test('без Web Locks: LS-lease, steal по TTL', async () => {
    delete navigator.locks;
    jest.useFakeTimers();

    const storage = window.localStorage;
    const key = `${CATALOG_SYNC_LS_LOCK_PREFIX}store-b`;
    let now = 1_000;
    storage.setItem(
      key,
      JSON.stringify({ owner: 'dead-tab', expiresAt: 5_000 })
    );

    let entered = false;
    const run = withCatalogSyncLock(
      'store-b',
      async () => {
        entered = true;
        return 'stolen';
      },
      {
        ttlMs: 1_000,
        pollMs: 100,
        heartbeatMs: 10_000,
        storage,
        now: () => now,
      }
    );

    await flushMicrotasks();
    expect(entered).toBe(false);

    now = 5_001;
    jest.advanceTimersByTime(100);
    await flushMicrotasks();

    await expect(run).resolves.toBe('stolen');
    expect(entered).toBe(true);
    expect(storage.getItem(key)).toBeNull();
  });
});
