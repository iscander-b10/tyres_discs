import { runCatalogSync } from './runSync.js';
import { getStoreId, readMeta, readSnapshot } from './storage.js';
import { resolveSlot } from './time.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
    body: JSON.stringify(data),
    isBase64Encoded: false,
  };
}

function empty(statusCode = 204) {
  return { statusCode, headers: { ...CORS_HEADERS }, body: '', isBase64Encoded: false };
}

function queryOf(event) {
  return event?.queryStringParameters || {};
}

function pathOf(event) {
  return String(event?.path || event?.url || event?.requestContext?.http?.path || '');
}

function methodOf(event) {
  return String(
    event?.httpMethod || event?.requestContext?.httpMethod || event?.requestContext?.http?.method || ''
  ).toUpperCase();
}

function extractSlotFromEvent(event) {
  const q = queryOf(event);
  if (q.slot) return q.slot;

  // Timer / Message Queue payload
  const messages = event?.messages;
  if (Array.isArray(messages) && messages[0]) {
    const details = messages[0].details || messages[0];
    const payload = details.payload || details.message?.body || details.body;
    if (typeof payload === 'string' && payload.trim()) return payload.trim();
    if (payload && typeof payload === 'object' && payload.slot) return payload.slot;
  }

  if (typeof event?.payload === 'string') return event.payload;
  if (event?.slot) return event.slot;

  return undefined;
}

function isTimerOrSyncEvent(event) {
  if (event?.messages) return true;
  if (event?.event_metadata || event?.eventMetadata) return true;
  const q = queryOf(event);
  if (q.action === 'sync') return true;
  const path = pathOf(event);
  if (path.includes('/catalog/sync')) return true;
  // Прямой invoke без HTTP-обёртки
  if (!event?.httpMethod && !event?.requestContext?.http && !path) return true;
  return false;
}

/**
 * Yandex Cloud Function entry.
 * - Timer / invoke / ?action=sync → синхронизация поставщиков → Object Storage
 * - GET meta/snapshot (fallback, если Gateway не ходит в Object Storage напрямую)
 */
async function handler(event = {}, context = {}) {
  try {
    if (methodOf(event) === 'OPTIONS') {
      return empty(204);
    }

    const path = pathOf(event);
    const q = queryOf(event);
    const storeId = (q.storeId || getStoreId()).trim();

    if (path.includes('/catalog/meta') || q.resource === 'meta') {
      const meta = await readMeta(storeId);
      if (!meta) return json(404, { error: 'meta not found', storeId });
      return json(200, meta);
    }

    if (path.includes('/catalog/snapshot') || q.resource === 'snapshot') {
      const snapshot = await readSnapshot(storeId);
      if (!snapshot) return json(404, { error: 'snapshot not found', storeId });
      return json(200, snapshot);
    }

    if (isTimerOrSyncEvent(event) || methodOf(event) === 'POST') {
      const slot = resolveSlot(extractSlotFromEvent(event));
      const result = await runCatalogSync({ slot });
      // Timer не требует HTTP-ответа, но для invoke удобно вернуть meta
      if (event?.httpMethod || event?.requestContext?.http) {
        return json(200, { ok: true, meta: result.meta, telegram: result.telegram });
      }
      return result.meta;
    }

    return json(400, {
      error: 'Unknown request. Use Timer, ?action=sync&slot=08:00, or catalog meta/snapshot routes.',
    });
  } catch (err) {
    console.error('catalog-sync handler error', err);
    if (event?.httpMethod || event?.requestContext?.http) {
      return json(500, { error: err?.message || String(err) });
    }
    throw err;
  }
}

export { handler };
