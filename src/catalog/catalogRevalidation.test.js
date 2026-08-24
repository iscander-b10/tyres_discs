const createLatestRequestRunner = () => {
  let latestRequestId = 0;
  let mounted = true;
  let hasVisibleLoading = false;
  const state = { value: 'initial', error: null, loading: false };

  const run = async (task, { background = false } = {}) => {
    const requestId = ++latestRequestId;
    let ignored = false;
    if (!background) {
      hasVisibleLoading = true;
      state.loading = true;
    }

    try {
      const result = await task();
      if (!mounted || requestId !== latestRequestId) {
        ignored = true;
      } else {
        state.value = result;
        state.error = null;
      }
    } catch (error) {
      if (!mounted || requestId !== latestRequestId) {
        ignored = true;
      } else if (!background) {
        state.error = error.message;
      }
    } finally {
      if (mounted && requestId === latestRequestId && hasVisibleLoading) {
        hasVisibleLoading = false;
        state.loading = false;
      }
    }

    return { ignored, state: { ...state } };
  };

  run.unmount = () => {
    mounted = false;
    latestRequestId += 1;
  };

  return run;
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('catalog revalidation race guard', () => {
  test('фоновая revalidation не очищает текущее значение', async () => {
    const run = createLatestRequestRunner();
    const first = await run(async () => ['v1']);
    const background = run(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(['v2']), 10);
        }),
      { background: true }
    );

    expect(first.state.value).toEqual(['v1']);
    await expect(background).resolves.toMatchObject({
      ignored: false,
      state: { value: ['v2'], error: null },
    });
  });

  test('устаревший async response не перезаписывает более новый', async () => {
    const run = createLatestRequestRunner();
    const slowDeferred = createDeferred();
    const fastDeferred = createDeferred();
    const slow = run(() => slowDeferred.promise);
    const fast = run(() => fastDeferred.promise);

    fastDeferred.resolve(['fast']);
    slowDeferred.resolve(['slow']);

    await expect(fast).resolves.toMatchObject({
      ignored: false,
      state: { value: ['fast'] },
    });
    await expect(slow).resolves.toMatchObject({ ignored: true });
  });

  test('foreground loading выключается после завершения актуального background', async () => {
    const run = createLatestRequestRunner();
    const foregroundDeferred = createDeferred();
    const backgroundDeferred = createDeferred();

    const foreground = run(() => foregroundDeferred.promise);
    const background = run(() => backgroundDeferred.promise, { background: true });

    foregroundDeferred.resolve(['old']);
    await expect(foreground).resolves.toMatchObject({
      ignored: true,
      state: { loading: true },
    });

    backgroundDeferred.resolve(['fresh']);
    await expect(background).resolves.toMatchObject({
      ignored: false,
      state: { value: ['fresh'], loading: false },
    });
  });

  test('ошибка background revalidation сохраняет предыдущее значение', async () => {
    const run = createLatestRequestRunner();
    await run(async () => ['stable']);
    const failed = await run(async () => {
      throw new Error('read failed');
    }, { background: true });

    expect(failed.state.value).toEqual(['stable']);
    expect(failed.state.error).toBeNull();
  });

  test('background success обновляет value без стартового wipe', async () => {
    const run = createLatestRequestRunner();
    await run(async () => ['stable']);

    const backgroundDeferred = createDeferred();
    const background = run(() => backgroundDeferred.promise, { background: true });

    backgroundDeferred.resolve(['updated']);
    await expect(background).resolves.toMatchObject({
      ignored: false,
      state: { value: ['updated'], error: null, loading: false },
    });
  });

  test('после unmount late result игнорируется без setState', async () => {
    const run = createLatestRequestRunner();
    const deferred = createDeferred();
    const pending = run(() => deferred.promise);

    run.unmount();
    deferred.resolve(['after-unmount']);

    await expect(pending).resolves.toMatchObject({ ignored: true });
  });
});
