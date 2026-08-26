import {
  CATALOG_SEARCH_LAYOUT,
  resolveCatalogSearchFormLayout,
} from './useCatalogSearchFormLayout';

describe('resolveCatalogSearchFormLayout', () => {
  it('uses stacked layout on mobile widths', () => {
    expect(resolveCatalogSearchFormLayout(320)).toBe(CATALOG_SEARCH_LAYOUT.STACKED);
    expect(resolveCatalogSearchFormLayout(768)).toBe(CATALOG_SEARCH_LAYOUT.STACKED);
  });

  it('uses sidebar when discs 2-row horizontal toolbar would overflow', () => {
    expect(resolveCatalogSearchFormLayout(769)).toBe(CATALOG_SEARCH_LAYOUT.SIDEBAR);
    expect(resolveCatalogSearchFormLayout(866)).toBe(CATALOG_SEARCH_LAYOUT.SIDEBAR);
    expect(resolveCatalogSearchFormLayout(959)).toBe(CATALOG_SEARCH_LAYOUT.SIDEBAR);
  });

  it('uses horizontal layout when panel is wide enough for two rows', () => {
    expect(resolveCatalogSearchFormLayout(960)).toBe(CATALOG_SEARCH_LAYOUT.HORIZONTAL);
    expect(resolveCatalogSearchFormLayout(1380)).toBe(CATALOG_SEARCH_LAYOUT.HORIZONTAL);
  });

  it('treats non-finite width as stacked', () => {
    expect(resolveCatalogSearchFormLayout(NaN)).toBe(CATALOG_SEARCH_LAYOUT.STACKED);
    expect(resolveCatalogSearchFormLayout(undefined)).toBe(CATALOG_SEARCH_LAYOUT.STACKED);
  });
});
