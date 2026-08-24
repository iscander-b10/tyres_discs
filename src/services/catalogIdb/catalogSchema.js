import { getSafeCatalogStoreId } from '../catalogSync/catalogStoreNamespace';

export const CATALOG_DB_NAME = 'CatalogDatabase';
export const CATALOG_DB_VERSION = 1;
export const getCatalogDatabaseName = (storeId) =>
  `${CATALOG_DB_NAME}.${getSafeCatalogStoreId(storeId)}`;
export const CATALOG_STORES = {
  tires: 'tires',
  discs: 'discs',
  metadata: 'metadata',
};
export const CATALOG_METADATA_KEYS = {
  snapshotVersion: 'snapshotVersion',
  migrationMarker: 'migrationMarker',
  schemaVersion: 'schemaVersion',
};
export const LEGACY_DB_NAMES = {
  tires: 'TireDatabase',
  discs: 'DiscDatabase',
};
export const LEGACY_MIGRATION_MARKER = 'legacy-v1-completed';
export const CATALOG_SCHEMA_VERSION = 1;

export const TIRE_INDEXES = [
  ['supplier', 'supplier'],
  ['brand', 'brand'],
  ['model', 'model'],
  ['title', 'title'],
  ['photoUrl', 'photoUrl'],
  ['width', 'width'],
  ['profile', 'profile'],
  ['diameter', 'diameter'],
  ['season', 'season'],
  ['spikes', 'spikes'],
  ['price', 'price'],
  ['amount', 'amount'],
];

export const DISC_INDEXES = [
  ['supplier', 'supplier'],
  ['brand', 'brand'],
  ['model', 'model'],
  ['title', 'title'],
  ['photoUrl', 'photoUrl'],
  ['diameter', 'diameter'],
  ['width', 'width'],
  ['pcd', 'pcd'],
  ['et', 'et'],
  ['cb', 'cb'],
  ['pn', 'pn'],
  ['diskType', 'diskType'],
  ['price', 'price'],
  ['amount', 'amount'],
];

export const ALL_CATALOG_STORES = [
  CATALOG_STORES.tires,
  CATALOG_STORES.discs,
  CATALOG_STORES.metadata,
];
