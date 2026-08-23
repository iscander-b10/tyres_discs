/**
 * Автосинхронизация каталога из Yandex Object Storage (через API Gateway).
 *
 * Триггеры: старт приложения, слот+10 МСК, visibilitychange→visible, online.
 * Без UI-кнопки и без toast-уведомлений — только console при отладке.
 */

import indexedDBService, {
  validateCatalogItemsForSupplier,
} from '../indexedDBService';
import { postCatalogApplied } from './catalogSyncChannel';

const STORE_ID = (process.env.REACT_APP_STORE_ID || 'ElistaIvanor').trim();
const LOCAL_VERSION_KEY = 'ivanor.catalog.cloudVersion';

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

export function isCatalogSyncConfigured() {
  return Boolean(catalogApiBase() && STORE_ID);
}

export function getCatalogStoreId() {
  return STORE_ID;
}

function metaUrl() {
  return `${catalogApiBase()}/v2/catalog/${encodeURIComponent(STORE_ID)}/meta`;
}

function snapshotUrl() {
  return `${catalogApiBase()}/v2/catalog/${encodeURIComponent(STORE_ID)}/snapshot`;
}

export function getLocalCatalogVersion() {
  try {
    return window.localStorage.getItem(LOCAL_VERSION_KEY) || '';
  } catch {
    return '';
  }
}

export function setLocalCatalogVersion(version) {
  try {
    if (version) {
      window.localStorage.setItem(LOCAL_VERSION_KEY, version);
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

const CATEGORY_CONFIG = {
  tyres: {
    entityName: 'шины',
    category: 'tyres',
  },
  discs: {
    entityName: 'диски',
    category: 'discs',
  },
};

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function contractError(path, message) {
  return new Error(`Некорректный snapshot: ${path} — ${message}`);
}

function normalizeCategoryCommand(command, path, supplier, entityName) {
  if (Array.isArray(command)) {
    if (command.length === 0) {
      throw contractError(
        path,
        'пустой legacy-массив неоднозначен; используйте явную команду'
      );
    }
    validateCatalogItemsForSupplier(command, supplier, entityName);
    return { action: 'replace', status: 'ok', items: command };
  }

  if (!isRecord(command)) {
    throw contractError(path, 'команда обязательна и не может быть null');
  }

  const { action, status } = command;
  const hasItems = hasOwn(command, 'items');

  if (action === 'replace') {
    if (status !== 'ok') {
      throw contractError(path, 'replace допускает только status "ok"');
    }
    if (!hasItems || !Array.isArray(command.items)) {
      throw contractError(path, 'replace требует массив items');
    }
    validateCatalogItemsForSupplier(command.items, supplier, entityName);
    return { action, status, items: command.items };
  }

  if (action === 'keepPrevious') {
    if (!['failed', 'keptPrevious'].includes(status)) {
      throw contractError(
        path,
        'keepPrevious допускает status "failed" или "keptPrevious"'
      );
    }
    if (hasItems) {
      throw contractError(path, 'keepPrevious не допускает поле items');
    }
    return { action, status };
  }

  if (action === 'purge') {
    if (status !== 'ok') {
      throw contractError(path, 'purge допускает только status "ok"');
    }
    if (hasItems) {
      throw contractError(path, 'purge не допускает поле items');
    }
    return { action, status };
  }

  throw contractError(path, `неизвестный action "${String(action)}"`);
}

export function validateCatalogSnapshot(snapshot) {
  if (
    !isRecord(snapshot) ||
    typeof snapshot.version !== 'string' ||
    !snapshot.version
  ) {
    throw contractError('version', 'непустая строка обязательна');
  }
  if (!isRecord(snapshot.suppliers)) {
    throw contractError('suppliers', 'объект поставщиков обязателен');
  }

  const supplierEntries = Object.entries(snapshot.suppliers);
  if (supplierEntries.length === 0) {
    throw contractError(
      'suppliers',
      'должен содержать хотя бы одного поставщика'
    );
  }

  return supplierEntries.flatMap(([supplierKey, entry]) => {
    const entryPath = `suppliers.${supplierKey}`;
    if (!isRecord(entry)) {
      throw contractError(entryPath, 'описание поставщика должно быть объектом');
    }
    if (typeof entry.supplier !== 'string' || !entry.supplier.trim()) {
      if (typeof entry.label === 'string' && entry.label.trim()) {
        entry.supplier = entry.label.trim();
      } else {
        throw contractError(`${entryPath}.supplier`, 'непустая строка обязательна');
      }
    }

    return Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
      if (!hasOwn(entry, category)) {
        throw contractError(`${entryPath}.${category}`, 'команда отсутствует');
      }
      return {
        supplier: entry.supplier,
        category,
        ...normalizeCategoryCommand(
          entry[category],
          `${entryPath}.${category}`,
          entry.supplier,
          config.entityName
        ),
      };
    });
  });
}

/**
 * Сначала валидирует snapshot целиком, затем применяет его одной транзакцией
 * CatalogDatabase (tires + discs + metadata).
 */
export async function applyCatalogSnapshot(snapshot) {
  const commands = validateCatalogSnapshot(snapshot);
  const result = await indexedDBService.applyCatalogSnapshot(
    commands,
    snapshot.version
  );
  if (result.applied) {
    setLocalCatalogVersion(snapshot.version);
    postCatalogApplied(snapshot.version);
  }
  return result;
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

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Сверка meta → при новой version скачать snapshot → IndexedDB.
 * @returns {Promise<{ status: 'skipped'|'up-to-date'|'applied'|'offline'|'disabled'|'error', version?: string, error?: string }>}
 */
export async function checkAndSyncCatalog({ force = false } = {}) {
  if (!isCatalogSyncConfigured()) {
    return { status: 'disabled' };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'offline' };
  }

  try {
    const meta = await fetchJson(metaUrl());
    if (!meta?.version) {
      return { status: 'skipped', error: 'meta empty' };
    }

    const local = await getPersistedCatalogVersion();
    const catalogEmpty = await isLocalCatalogEmpty();
    if (!force && !catalogEmpty && local && meta.version <= local) {
      return { status: 'up-to-date', version: meta.version };
    }

    const snapshot = await fetchJson(snapshotUrl());
    if (!snapshot?.version) {
      return { status: 'skipped', error: 'snapshot empty' };
    }

    if (!force && !catalogEmpty && local && snapshot.version <= local) {
      return { status: 'up-to-date', version: snapshot.version };
    }

    await applyCatalogSnapshot(snapshot);

    console.info('catalog sync applied', {
      storeId: STORE_ID,
      version: snapshot.version,
      slot: snapshot.slot,
    });

    return { status: 'applied', version: snapshot.version };
  } catch (err) {
    console.warn('catalog sync failed:', err?.message || err);
    return { status: 'error', error: err?.message || String(err) };
  }
}
