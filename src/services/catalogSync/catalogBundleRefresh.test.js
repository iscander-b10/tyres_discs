import {
  CATALOG_BUNDLE_RELOAD_KEY,
  catalogBundleDiffers,
  ensureFreshCatalogBundle,
  resetCatalogBundleCheckState,
  scriptsFromAssetManifest,
  scriptsFromIndexHtml,
} from './catalogBundleRefresh';

function sessionStorageStub(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

describe('catalogBundleRefresh', () => {
  beforeEach(() => {
    resetCatalogBundleCheckState();
  });

  test('другой скрипт манифеста отличается от текущего бандла', () => {
    expect(
      catalogBundleDiffers(
        ['/static/js/main.old.js'],
        ['static/js/runtime-main.old.js', 'static/js/main.new.js']
      )
    ).toBe(true);
    expect(
      catalogBundleDiffers(
        ['/repo/static/js/main.same.js'],
        ['static/js/main.same.js']
      )
    ).toBe(false);
    expect(catalogBundleDiffers(['/static/js/bundle.js'], [])).toBe(false);
  });

  test('manifest без js падает обратно на скрипты index.html', () => {
    expect(scriptsFromAssetManifest({ entrypoints: ['static/css/main.css'] })).toEqual(
      []
    );
    expect(
      scriptsFromIndexHtml(
        '<html><script src="/static/js/main.abc.js"></script></html>'
      )
    ).toEqual(['/static/js/main.abc.js']);
  });

  test('расхождение даёт один reload за сессию и не зацикливается', async () => {
    const storage = sessionStorageStub();
    const reload = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entrypoints: ['static/css/main.css', 'static/js/main.new.js'],
      }),
    });

    await expect(
      ensureFreshCatalogBundle({
        fetchImpl,
        storage,
        location: { reload },
        currentSrcs: ['/static/js/main.old.js'],
      })
    ).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/asset-manifest.json',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(CATALOG_BUNDLE_RELOAD_KEY)).toBe('1');

    resetCatalogBundleCheckState();
    await expect(
      ensureFreshCatalogBundle({
        force: true,
        fetchImpl,
        storage,
        location: { reload },
        currentSrcs: ['/static/js/main.old.js'],
      })
    ).resolves.toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('тот же бандл не перезагружает вкладку', async () => {
    const storage = sessionStorageStub();
    const reload = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: { 'main.js': '/static/js/main.same.js' },
      }),
    });

    await ensureFreshCatalogBundle({
      fetchImpl,
      storage,
      location: { reload },
      currentSrcs: ['/static/js/main.same.js'],
    });

    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem(CATALOG_BUNDLE_RELOAD_KEY)).toBeNull();
  });

  test('без манифеста сравнивает скрипты index.html', async () => {
    const storage = sessionStorageStub();
    const reload = jest.fn();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<script src="/static/js/main.remote.js"></script>',
      });

    await ensureFreshCatalogBundle({
      fetchImpl,
      storage,
      location: { reload },
      currentSrcs: ['/static/js/main.local.js'],
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      '/index.html',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
