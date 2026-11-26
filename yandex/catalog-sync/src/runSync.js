import {
  getStoreId,
  readSnapshot,
  writeMeta,
  writeSnapshot,
} from './storage.js';
import {
  buildSnapshotSuppliers,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
} from './snapshotCommands.js';
import { loadAllSuppliersData, getSupplierLabel, SUPPLIER_LOAD_ORDER } from './suppliers/loadAll.js';
import { resolveSlot, versionForPublication } from './time.js';

function logJson(payload) {
  console.log(JSON.stringify(payload));
}

/**
 * @param {{ slot?: string }} [opts]
 */
export async function runCatalogSync(opts = {}) {
  const storeId = getStoreId();
  const slot = resolveSlot(opts.slot);

  logJson({ event: 'catalog-sync-start', storeId, slot });

  const previous = await readSnapshot(storeId);
  const loadResults = await loadAllSuppliersData(storeId);
  const { suppliers, metaSuppliers } = buildSnapshotSuppliers({
    previousSnapshot: previous,
    loadResults,
    supplierKeys: SUPPLIER_LOAD_ORDER,
    getSupplierLabel,
  });

  const okCount = metaSuppliers.filter((s) => s.ok).length;
  const failCount = metaSuppliers.length - okCount;
  const version = versionForPublication();

  const snapshot = {
    schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
    storeId,
    version,
    slot,
    suppliers,
  };

  const meta = {
    storeId,
    version,
    slot,
    suppliers: metaSuppliers.map(({ key, label, ok, error, keptPrevious }) => ({
      key,
      label,
      ok,
      ...(error ? { error } : {}),
      ...(keptPrevious ? { keptPrevious: true } : {}),
    })),
    okCount,
    failCount,
  };

  const snapshotBytes = await writeSnapshot(storeId, snapshot);
  await writeMeta(storeId, meta);

  logJson({
    event: 'catalog-sync-finish',
    storeId,
    slot,
    version,
    okCount,
    failCount,
    snapshotBytes,
    suppliers: metaSuppliers.map((s) => `${s.key}:${s.ok ? 'ok' : 'fail'}`).join(','),
  });

  return { meta };
}
