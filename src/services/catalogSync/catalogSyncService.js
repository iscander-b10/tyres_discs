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

async function fetchJson(url, signal) {
  const res = await fetch(url, { cache: 'no-store', signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError')
  );
}

/**
 * Сверка meta → при новой version скачать snapshot → IndexedDB.
 * Один writer на origin+storeId через withCatalogSyncLock.
 * @returns {Promise<{ status: 'skipped'|'up-to-date'|'applied'|'offline'|'disabled'|'error', version?: string, error?: string }>}
 */
export async function checkAndSyncCatalog({
  force = false,
  storeId: requestedStoreId,
  signal,
} = {}) {
  const storeId = resolveCatalogStoreId(requestedStoreId);

  return withCatalogSyncLock(storeId, async () => {
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
      const meta = await fetchJson(metaUrl(storeId), signal);
      assertCatalogStoreActive(storeId, generation);
      if (!meta?.version) {
        return { status: 'skipped', error: 'meta empty' };
      }

      const local = await getPersistedCatalogVersion();
      assertCatalogStoreActive(storeId, generation);
      const catalogEmpty = await isLocalCatalogEmpty();
      assertCatalogStoreActive(storeId, generation);
      if (!force && !catalogEmpty && local && meta.version <= local) {
        return { status: 'up-to-date', version: meta.version };
      }

      const snapshot = await fetchJson(snapshotUrl(storeId), signal);
      assertCatalogStoreActive(storeId, generation);
      if (!snapshot?.version) {
        return { status: 'skipped', error: 'snapshot empty' };
      }

      if (!force && !catalogEmpty && local && snapshot.version <= local) {
        return { status: 'up-to-date', version: snapshot.version };
      }

      await applyCatalogSnapshot(snapshot, { storeId, generation });

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
  });
}
