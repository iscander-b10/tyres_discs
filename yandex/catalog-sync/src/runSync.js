import {
  getStoreId,
  readSnapshot,
  writeMeta,
  writeSnapshot,
} from './storage.js';
import { loadAllSuppliersData, getSupplierLabel, SUPPLIER_LOAD_ORDER } from './suppliers/loadAll.js';
import { formatSyncTelegramMessage, isTelegramConfigured, sendTelegramMessage } from './telegram.js';
import { resolveSlot, versionForSlot } from './time.js';

function logJson(payload) {
  console.log(JSON.stringify(payload));
}

/**
 * Частичный успех: успешных пишем заново; у упавших оставляем предыдущую удачную версию.
 */
function mergeSnapshotSuppliers(previousSnapshot, loadResults) {
  const prevMap = previousSnapshot?.suppliers || {};
  const next = {};
  const metaSuppliers = [];

  for (const key of SUPPLIER_LOAD_ORDER) {
    const result = loadResults.find((r) => r.key === key);
    const label = getSupplierLabel(key);
    const prev = prevMap[key];

    if (result?.status === 'fulfilled' && result.value) {
      next[key] = {
        key,
        label: result.value.label || label,
        ok: true,
        tyres: result.value.tyres || [],
        discs: result.value.discs || [],
      };
      metaSuppliers.push({ key, label: next[key].label, ok: true });
      continue;
    }

    const error = result?.reason?.message || String(result?.reason || 'unknown error');
    if (prev && (prev.tyres?.length > 0 || prev.discs?.length > 0)) {
      next[key] = {
        key,
        label: prev.label || label,
        ok: false,
        keptPrevious: true,
        error,
        tyres: prev.tyres || [],
        discs: prev.discs || [],
      };
      metaSuppliers.push({
        key,
        label: next[key].label,
        ok: false,
        error,
        keptPrevious: true,
      });
    } else {
      next[key] = {
        key,
        label,
        ok: false,
        keptPrevious: false,
        error,
        tyres: [],
        discs: [],
      };
      metaSuppliers.push({ key, label, ok: false, error, keptPrevious: false });
    }
  }

  return { suppliers: next, metaSuppliers };
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
  const { suppliers, metaSuppliers } = mergeSnapshotSuppliers(previous, loadResults);

  const okCount = metaSuppliers.filter((s) => s.ok).length;
  const failCount = metaSuppliers.length - okCount;

  const snapshot = {
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
