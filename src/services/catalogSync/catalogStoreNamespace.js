export const DEFAULT_CATALOG_STORE_ID = 'ElistaIvanor';
export const CATALOG_VERSION_KEY_PREFIX = 'ivanor.catalog.cloudVersion';

export function resolveCatalogStoreId(storeId) {
  const explicitStoreId = String(storeId ?? '').trim();
  if (explicitStoreId) return explicitStoreId;

  return (
    String(process.env.REACT_APP_STORE_ID ?? '').trim() ||
    DEFAULT_CATALOG_STORE_ID
  );
}

export function getSafeCatalogStoreId(storeId) {
  return encodeURIComponent(resolveCatalogStoreId(storeId));
}

export function getCatalogVersionKey(storeId) {
  return `${CATALOG_VERSION_KEY_PREFIX}.${getSafeCatalogStoreId(storeId)}`;
}
