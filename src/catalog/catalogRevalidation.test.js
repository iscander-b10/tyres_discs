const createLatestRequestRunner = () => {
  let latestRequestId = 0;
  const state = { value: 'initial', error: null, loading: false };

  return async (task, { background = false } = {}) => {
    const requestId = ++latestRequestId;
    if (!background) {
      state.loading = true;
    }

    try {
      const result = await task();
      if (requestId !== latestRequestId) {
        return { ignored: true, state: { ...state } };
      }
      state.value = result;
      state.error = null;
      return { ignored: false, state: { ...state } };
    } catch (error) {
      if (requestId !== latestRequestId) {
        return { ignored: true, state: { ...state } };
      }
      if (!background) {
        state.error = error.message;
      }
      return { ignored: false, state: { ...state } };
    } finally {
      if (!background && requestId === latestRequestId) {
        state.loading = false;
      }
    }
  };
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
    const slow = run(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(['slow']), 30);
        })
    );
    const fast = run(async () => ['fast']);

    await expect(fast).resolves.toMatchObject({
      ignored: false,
      state: { value: ['fast'] },
    });
    await expect(slow).resolves.toMatchObject({ ignored: true });
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
});
