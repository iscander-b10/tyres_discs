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
import { formatSyncTelegramMessage, isTelegramConfigured, sendTelegramMessage } from './telegram.js';
import { resolveSlot, versionForSlot } from './time.js';

function logJson(payload) {
  console.log(JSON.stringify(payload));
}

/**
 * @param {{ slot?: string }} [opts]
 */
export async function runCatalogSync(opts = {}) {
  const storeId = getStoreId();
  const slot = resolveSlot(opts.slot);
  const version = versionForSlot(slot);

  logJson({ event: 'catalog-sync-start', storeId, slot, version });

  const previous = await readSnapshot(storeId);
  const loadResults = await loadAllSuppliersData();
  const { suppliers, metaSuppliers } = buildSnapshotSuppliers({
    previousSnapshot: previous,
    loadResults,
    supplierKeys: SUPPLIER_LOAD_ORDER,
    getSupplierLabel,
  });

  const okCount = metaSuppliers.filter((s) => s.ok).length;
  const failCount = metaSuppliers.length - okCount;

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

  let telegram = { sent: false, skipped: true };
  if (isTelegramConfigured()) {
    telegram = await sendTelegramMessage(formatSyncTelegramMessage(meta));
    logJson({
      event: 'catalog-sync-telegram',
      sent: telegram.sent,
      skipped: Boolean(telegram.skipped),
      error: telegram.error || null,
    });
  } else {
    logJson({ event: 'catalog-sync-telegram', skipped: true });
  }

  return { meta, telegram };
}
