import {
  DISC_FACET_IRRELEVANT_FIELDS,
  TIRE_FACET_IRRELEVANT_FIELDS,
  beginCatalogSearchRequest,
  didOnlyIrrelevantSearchFieldsChange,
  invalidateCatalogSearchRequest,
  settleCatalogSearchLoading,
} from './searchFormCascade';

describe('searchFormCascade', () => {
  test('шины: бренд, поставщик, чекбоксы и шипы не требуют пересчёта facets', () => {
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { brand: ['Ikon'] },
        TIRE_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(true);
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { onlyAmountFrom4: true, onlyRunflat: true },
        TIRE_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(true);
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { spikes: false },
        TIRE_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(true);
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { width: 205 },
        TIRE_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(false);
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { season: 'w' },
        TIRE_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(false);
  });

  test('диски: бренд и «от 4 шт» не требуют каскада, supplier и diameter требуют', () => {
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { brand: ['OZ'] },
        DISC_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(true);
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { onlyAmountFrom4: true },
        DISC_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(true);
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { supplier: 'A' },
        DISC_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(false);
    expect(
      didOnlyIrrelevantSearchFieldsChange(
        { diameter: 'R16' },
        DISC_FACET_IRRELEVANT_FIELDS
      )
    ).toBe(false);
  });

  test('settle гасит spinner, если foreground сменил background', () => {
    const searchRequestIdRef = { current: 1 };
    const foregroundRequestIdRef = { current: 1 };
    const mountedRef = { current: true };
    const workspaceKeyRef = { current: 'store-a' };
    const setLoadingSearch = jest.fn();

    searchRequestIdRef.current = 2;
    settleCatalogSearchLoading({
      background: false,
      requestId: 1,
      searchRequestIdRef,
      foregroundRequestIdRef,
      mountedRef,
      requestedWorkspaceKey: 'store-a',
      workspaceKeyRef,
      setLoadingSearch,
    });

    expect(setLoadingSearch).toHaveBeenCalledWith(false);
  });

  test('begin помечает только foreground как владельца spinner', () => {
    const searchRequestIdRef = { current: 0 };
    const foregroundRequestIdRef = { current: 0 };
    const fg = beginCatalogSearchRequest({
      searchRequestIdRef,
      foregroundRequestIdRef,
      background: false,
    });
    expect(fg).toBe(1);
    expect(foregroundRequestIdRef.current).toBe(1);

    const bg = beginCatalogSearchRequest({
      searchRequestIdRef,
      foregroundRequestIdRef,
      background: true,
    });
    expect(bg).toBe(2);
    expect(foregroundRequestIdRef.current).toBe(1);
  });

  test('invalidate делает in-flight поиск stale и гасит spinner', () => {
    const searchRequestIdRef = { current: 1 };
    const foregroundRequestIdRef = { current: 1 };
    const setLoadingSearch = jest.fn();

    invalidateCatalogSearchRequest({
      searchRequestIdRef,
      foregroundRequestIdRef,
      setLoadingSearch,
    });

    expect(searchRequestIdRef.current).toBe(2);
    expect(foregroundRequestIdRef.current).toBe(0);
    expect(setLoadingSearch).toHaveBeenCalledWith(false);
  });

  test('после invalidate late settle не трогает spinner', () => {
    const searchRequestIdRef = { current: 1 };
    const foregroundRequestIdRef = { current: 1 };
    const mountedRef = { current: true };
    const workspaceKeyRef = { current: 'store-a' };
    const setLoadingSearch = jest.fn();

    invalidateCatalogSearchRequest({
      searchRequestIdRef,
      foregroundRequestIdRef,
      setLoadingSearch,
    });
    setLoadingSearch.mockClear();

    settleCatalogSearchLoading({
      background: false,
      requestId: 1,
      searchRequestIdRef,
      foregroundRequestIdRef,
      mountedRef,
      requestedWorkspaceKey: 'store-a',
      workspaceKeyRef,
      setLoadingSearch,
    });

    expect(setLoadingSearch).not.toHaveBeenCalled();
  });
});
