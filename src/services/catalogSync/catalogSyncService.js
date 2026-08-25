/**
 * Автосинхронизация каталога из Yandex Object Storage (через API Gateway).
 *
 * Триггеры: старт приложения, слот+10 МСК, visibilitychange→visible, online.
 * Без UI-кнопки и без toast-уведомлений — только console при отладке.
 */

import indexedDBService from '../indexedDBService';
import { appLog } from '../../utils/appLog';
import { postCatalogApplied } from './catalogSyncChannel';
import { withCatalogSyncLock } from './catalogSyncLock';
import {
  getCatalogVersionKey,
  resolveCatalogStoreId,
} from './catalogStoreNamespace';
import { validateAndNormalizeCatalogSnapshot } from './catalogSnapshotValidation';

export {
  validateAndNormalizeCatalogSnapshot,
  validateCatalogSnapshot,
} from './catalogSnapshotValidation';

/** Проверки meta в МСК: слот Timer + 10 минут. */
export const CATALOG_SYNC_CHECK_SLOTS = [
  { hour: 8, minute: 10 },
  { hour: 9, minute: 40 },
  { hour: 12, minute: 10 },
  { hour: 15, minute: 10 },
];

function catalogApiBase() {
  const explicit = process.env.REACT_APP_CATALOG_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const cors = process.env.REACT_APP_CORS_PROXY?.trim();
  if (cors) return cors.replace(/\/$/, '');
  return '';
}

export function isCatalogSyncConfigured(storeId) {
  return Boolean(catalogApiBase() && resolveCatalogStoreId(storeId));
}

export function getCatalogStoreId(storeId) {
  return resolveCatalogStoreId(storeId);
}

function metaUrl(storeId) {
  return `${catalogApiBase()}/v2/catalog/${encodeURIComponent(storeId)}/meta`;
}

function snapshotUrl(storeId) {
  return `${catalogApiBase()}/v2/catalog/${encodeURIComponent(storeId)}/snapshot`;
}

export function getLocalCatalogVersion(storeId) {
  try {
    return window.localStorage.getItem(getCatalogVersionKey(storeId)) || '';
  } catch {
    return '';
  }
}

export function setLocalCatalogVersion(version, storeId) {
  try {
    if (version) {
      window.localStorage.setItem(getCatalogVersionKey(storeId), version);
    }
  } catch {
    /* ignore */
  }
}

function getMoscowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  if (map.hour === '24') map.hour = '00';
  return map;
}

/**
 * Миллисекунды до ближайшего слота проверки (сегодня/завтра, МСК).
 */
export function msUntilNextSyncCheck(now = new Date()) {
  const m = getMoscowParts(now);
  const nowMin = Number(m.hour) * 60 + Number(m.minute);
  const nowSec = Number(m.second) || 0;

  let bestMin = null;
  for (const slot of CATALOG_SYNC_CHECK_SLOTS) {
    const slotMin = slot.hour * 60 + slot.minute;
    if (slotMin > nowMin || (slotMin === nowMin && nowSec === 0)) {
      bestMin = slotMin;
      break;
    }
  }

  if (bestMin == null) {
    // следующий день — первый слот 08:10
    const first = CATALOG_SYNC_CHECK_SLOTS[0];
    const minutesUntilMidnight = 24 * 60 - nowMin;
    const minutesAfterMidnight = first.hour * 60 + first.minute;
    return (minutesUntilMidnight + minutesAfterMidnight) * 60 * 1000 - nowSec * 1000;
  }

  const deltaMin = bestMin - nowMin;
  return deltaMin * 60 * 1000 - nowSec * 1000;
}

/**
 * Сначала валидирует и нормализует snapshot целиком, затем применяет
 * нормализованные команды одной транзакцией CatalogDatabase.
 */
const activateCatalogStore = (storeId) =>
  typeof indexedDBService.setActiveStore === 'function'
    ? indexedDBService.setActiveStore(storeId)
    : undefined;

const isCatalogStoreActive = (storeId, generation) =>
  typeof indexedDBService.isActiveStore !== 'function' ||
  indexedDBService.isActiveStore(storeId, generation);

const assertCatalogStoreActive = (storeId, generation) => {
  if (!isCatalogStoreActive(storeId, generation)) {
    const error = new Error('Результат синхронизации относится к неактивному магазину');
    error.name = 'StaleCatalogStoreError';
    throw error;
  }
};

const normalizeApplyOptions = (options) =>
  typeof options === 'string' ? { storeId: options } : options || {};

export async function applyCatalogSnapshot(snapshot, options = {}) {
  const normalizedOptions = normalizeApplyOptions(options);
  const storeId = resolveCatalogStoreId(normalizedOptions.storeId);
  const generation =
    normalizedOptions.generation ?? activateCatalogStore(storeId);
  assertCatalogStoreActive(storeId, generation);

  const { commands, report } = validateAndNormalizeCatalogSnapshot(snapshot);
  if (!report.valid) {
    const first = report.errors[0];
    const message = first
      ? `Некорректный snapshot: ${first.path || 'snapshot'} — ${first.message}`
      : 'Некорректный snapshot';
    const error = new Error(message);
    error.validationReport = report;
    throw error;
  }

  const result = await indexedDBService.applyCatalogSnapshot(
    commands,
    snapshot.version
  );
  assertCatalogStoreActive(storeId, generation);
  if (result.applied) {
    setLocalCatalogVersion(snapshot.version, storeId);
    postCatalogApplied(snapshot.version, storeId);
  }
  return {
    ...result,
    validationReport: report,
  };
}

/** Локальный каталог пуст (после wipe IDB) — нужно качать snapshot даже при совпадении version. */
async function isLocalCatalogEmpty() {
  try {
    return indexedDBService.isCatalogEmpty();
  } catch {
    return true;
  }
}

async function getPersistedCatalogVersion() {
  try {
    return indexedDBService.getPersistedCatalogVersion();
  } catch {
    return '';
  }
}

const SYNC_PROGRESS = {
  metaStart: 1,
  metaEnd: 3,
  downloadStart: 5,
  downloadEnd: 80,
  parse: 86,
  applyStart: 91,
  applyEnd: 96,
};

const UNKNOWN_DOWNLOAD_SCALE_BYTES = 2 * 1024 * 1024;

function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError')
  );
}

function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function clampSyncProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.min(99, numeric);
}

function parseDeclaredByteTotal(headers) {
  if (!headers || typeof headers.get !== 'function') return null;
  const encoding = String(headers.get('content-encoding') || '')
    .toLowerCase()
    .trim();
  if (encoding && encoding !== 'identity') return null;
  const length = Number.parseInt(headers.get('content-length'), 10);
  if (!Number.isFinite(length) || length <= 0) return null;
  return length;
}

function isTrustedByteTotal(totalBytes, receivedBytes) {
  return (
    Number.isFinite(totalBytes) &&
    totalBytes > 0 &&
    receivedBytes <= totalBytes
  );
}

function downloadProgressPercent(receivedBytes, totalBytes) {
  const start = SYNC_PROGRESS.downloadStart;
  const span = SYNC_PROGRESS.downloadEnd - start;
  if (isTrustedByteTotal(totalBytes, receivedBytes)) {
    return start + span * (receivedBytes / totalBytes);
  }
  const ratio =
    1 - Math.exp(-(receivedBytes || 0) / UNKNOWN_DOWNLOAD_SCALE_BYTES);
  return start + span * ratio;
}

function concatUint8Chunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { cache: 'no-store', signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function readSnapshotFromResponse(
  res,
  { signal, onDownloadProgress, onParseStart } = {}
) {
  const reader = res.body?.getReader?.();
  if (!reader) {
    onDownloadProgress?.({
      receivedBytes: 0,
      totalBytes: parseDeclaredByteTotal(res.headers),
      complete: true,
    });
    onParseStart?.();
    return res.json();
  }

  let totalBytes = parseDeclaredByteTotal(res.headers);
  const chunks = [];
  let receivedBytes = 0;

  const emitDownload = (complete = false) => {
    if (totalBytes != null && receivedBytes > totalBytes) {
      totalBytes = null;
    }
    onDownloadProgress?.({ receivedBytes, totalBytes, complete });
  };

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw createAbortError();
      }
      const { done, value } = await reader.read();
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw createAbortError();
      }
      if (done) break;
      if (value && value.byteLength) {
        chunks.push(value);
        receivedBytes += value.byteLength;
        emitDownload(false);
      }
    }
  } catch (err) {
    await reader.cancel().catch(() => {});
    if (isAbortError(err) || signal?.aborted) {
      throw isAbortError(err) ? err : createAbortError();
    }
    throw err;
  }

  emitDownload(true);
  onParseStart?.();
  const text = new TextDecoder('utf-8').decode(concatUint8Chunks(chunks));
  if (!text) return null;
  return JSON.parse(text);
}

async function fetchSnapshot(url, options = {}) {
  const res = await fetch(url, { cache: 'no-store', signal: options.signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return readSnapshotFromResponse(res, options);
}

/**
 * Сверка meta → при новой version скачать snapshot → IndexedDB.
 * Один writer на origin+storeId через withCatalogSyncLock.
 * @param {object} [options]
 * @param {boolean} [options.force]
 * @param {string} [options.storeId]
 * @param {AbortSignal} [options.signal]
 * @param {(event: { phase: 'meta'|'download'|'parse'|'apply', receivedBytes: number, totalBytes: number|null, progress: number }) => void} [options.onProgress]
 * @param {() => void} [options.onLockWaiting]
 * @returns {Promise<{ status: 'skipped'|'up-to-date'|'applied'|'offline'|'disabled'|'error', version?: string, error?: string }>}
 */
export async function checkAndSyncCatalog({
  force = false,
  storeId: requestedStoreId,
  signal,
  onProgress,
  onLockWaiting,
} = {}) {
  const storeId = resolveCatalogStoreId(requestedStoreId);
  let lastProgress = 0;
  const reportProgress = ({
    phase,
    receivedBytes = 0,
    totalBytes = null,
    progress,
  }) => {
    const nextProgress = clampSyncProgress(
      Math.max(lastProgress, progress ?? 0)
    );
    lastProgress = nextProgress;
    try {
      onProgress?.({
        phase,
        receivedBytes,
        totalBytes,
        progress: nextProgress,
      });
    } catch {
      /* UI progress must not fail the sync */
    }
  };

  return withCatalogSyncLock(
    storeId,
    async () => {
    const generation = activateCatalogStore(storeId);
    if (!isCatalogSyncConfigured(storeId)) {
      return { status: 'disabled' };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { status: 'offline' };
    }

    if (signal?.aborted) {
      return { status: 'skipped', error: 'aborted' };
    }

    try {
      reportProgress({
        phase: 'meta',
        progress: SYNC_PROGRESS.metaStart,
      });
      const meta = await fetchJson(metaUrl(storeId), signal);
      assertCatalogStoreActive(storeId, generation);
      if (!meta?.version) {
        return { status: 'skipped', error: 'meta empty' };
      }
      reportProgress({
        phase: 'meta',
        progress: SYNC_PROGRESS.metaEnd,
      });

      const local = await getPersistedCatalogVersion();
      assertCatalogStoreActive(storeId, generation);
      const catalogEmpty = await isLocalCatalogEmpty();
      assertCatalogStoreActive(storeId, generation);
      if (!force && !catalogEmpty && local && meta.version <= local) {
        return { status: 'up-to-date', version: meta.version };
      }

      reportProgress({
        phase: 'download',
        progress: SYNC_PROGRESS.downloadStart,
      });
      const snapshot = await fetchSnapshot(snapshotUrl(storeId), {
        signal,
        onDownloadProgress: ({ receivedBytes, totalBytes, complete }) => {
          reportProgress({
            phase: 'download',
            receivedBytes,
            totalBytes,
            progress: complete
              ? SYNC_PROGRESS.downloadEnd
              : downloadProgressPercent(receivedBytes, totalBytes),
          });
        },
        onParseStart: () => {
          reportProgress({
            phase: 'parse',
            progress: SYNC_PROGRESS.parse,
          });
        },
      });
      assertCatalogStoreActive(storeId, generation);
      if (!snapshot?.version) {
        return { status: 'skipped', error: 'snapshot empty' };
      }

      if (!force && !catalogEmpty && local && snapshot.version <= local) {
        return { status: 'up-to-date', version: snapshot.version };
      }

      reportProgress({
        phase: 'apply',
        progress: SYNC_PROGRESS.applyStart,
      });
      await applyCatalogSnapshot(snapshot, { storeId, generation });
      reportProgress({
        phase: 'apply',
        progress: SYNC_PROGRESS.applyEnd,
      });

      console.info('catalog sync applied', {
        storeId,
        version: snapshot.version,
        slot: snapshot.slot,
      });

      return { status: 'applied', version: snapshot.version };
    } catch (err) {
      if (err?.name === 'StaleCatalogStoreError') {
        return { status: 'skipped', error: 'stale store' };
      }
      if (isAbortError(err) || signal?.aborted) {
        return { status: 'skipped', error: 'aborted' };
      }

      const report = err?.validationReport;
      if (report && report.valid === false) {
        const first = report.errors?.[0];
        appLog.error({
          code: 'catalog.snapshot_invalid',
          domain: 'catalogSync',
          message: 'Catalog snapshot validation failed',
          error: err,
          context: {
            storeId,
            validationPath: first?.path,
            validationMessage: first?.message,
            errorCount: Array.isArray(report.errors)
              ? report.errors.length
              : undefined,
          },
        });
      } else {
        appLog.error({
          code: 'catalog.sync_failed',
          domain: 'catalogSync',
          message: 'Catalog sync failed',
          error: err,
          context: { storeId },
        });
      }

      return { status: 'error', error: err?.message || String(err) };
    }
    },
    {
      onWaiting: () => {
        try {
          onLockWaiting?.();
        } catch {
          /* UI status must not fail the sync */
        }
      },
    }
  );
}
