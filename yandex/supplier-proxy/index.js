/**
 * Yandex Cloud Function: supplier-proxy
 *
 * Purpose:
 * - Public CORS proxy for a limited allowlist of supplier hosts.
 * - Accepts: GET /?url=https%3A%2F%2Fexample.com%2Fpath
 * - Blocks SSRF by:
 *   - protocol allowlist (http/https)
 *   - host allowlist (ALLOWED_HOSTS)
 *   - bounded redirects (MAX_REDIRECTS) with host re-check per hop
 *
 * Response format matches API Gateway expectations:
 * { statusCode, headers, body, isBase64Encoded }
 */

const DEFAULT_ALLOWED_HOSTS = [
  'z34.ru',
  'b2b.4tochki.ru',
  'api-b2b.pwrs.ru', // картинки 4tochki (img_big_my)
  'shina.su',
  'vershinatyres.ru',
  'duplo-api.shinservice.ru',
  'duplo-s0.shinservice.ru', // картинки shinservice (photoUrl)
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

// Ensure crash reasons are visible in Cloud Function logs.
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
});

const IMAGE_PATH_RE = /\.(?:jpe?g|png|gif|webp|svg|bmp|avif)(?:$|\?)/i;
const IMAGE_DIR_RE = /\/(?:pictures|photo|photos|catalog|goods|upload)\//i;
const ALLOWED_METRIC_EVENTS = new Set(['load-start', 'load-finish']);

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(data),
    isBase64Encoded: false,
  };
}

function empty(statusCode = 204) {
  return { statusCode, headers: { ...CORS_HEADERS }, body: '', isBase64Encoded: false };
}

function logJson(payload) {
  console.error(JSON.stringify(payload));
}

function queryOf(event) {
  return event?.queryStringParameters || {};
}

function headerOf(event, name) {
  const headers = event?.headers || {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key] || '') : '';
}

function getClientIp(event) {
  const forwarded = headerOf(event, 'x-forwarded-for');
  const first = forwarded.split(',')[0].trim();
  if (first) return first;
  return (
    event?.requestContext?.identity?.sourceIp ||
    event?.requestContext?.http?.sourceIp ||
    event?.requestContext?.sourceIp ||
    ''
  );
}

function looksLikeImageUrl(targetUrl) {
  const path = `${targetUrl.pathname || ''}${targetUrl.search || ''}`;
  return IMAGE_PATH_RE.test(path) || IMAGE_DIR_RE.test(targetUrl.pathname || '');
}

function requestPurpose(event, targetUrl) {
  const raw = String(queryOf(event).purpose || '').toLowerCase();
  if (raw === 'image' || raw === 'price') return raw;
  if (targetUrl && looksLikeImageUrl(targetUrl)) return 'image';
  return 'price';
}

function safeUpstream(targetUrl) {
  if (!targetUrl) return {};
  return { host: targetUrl.hostname, path: targetUrl.pathname };
}

function parseBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

function handleMetricEvent(event) {
  const q = queryOf(event);
  const metricEvent = String(q.metricEvent || '').trim();
  if (!ALLOWED_METRIC_EVENTS.has(metricEvent)) {
    return json(400, { error: 'Unknown metricEvent' });
  }

  const payload = {
    event: metricEvent,
    loadId: String(q.loadId || '').slice(0, 80),
    ip: getClientIp(event),
  };

  if (metricEvent === 'load-finish') {
    payload.ok = parseBool(q.ok);
    payload.hadClientErrors = parseBool(q.hadClientErrors);
    payload.hadSaveErrors = parseBool(q.hadSaveErrors);
    payload.suppliers = String(q.suppliers || '').slice(0, 500);
  }

  logJson(payload);
  return empty(204);
}

function parseAllowedHostsEnv() {
  const raw = (process.env.ALLOWED_HOSTS || '').trim();
  if (!raw) return DEFAULT_ALLOWED_HOSTS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s)).filter(Boolean);
  } catch {
    // ignore, fallback to CSV
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedHost(hostname, allowedHosts) {
  const h = String(hostname || '').toLowerCase();
  return allowedHosts.some((host) => h === host || h.endsWith(`.${host}`));
}

function getTimeoutMs() {
  const n = Number(process.env.UPSTREAM_TIMEOUT_MS || '120000');
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 1000), 240000) : 120000;
}

function getMaxRedirects() {
  const n = Number(process.env.MAX_REDIRECTS || '5');
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.max(n, 0), 10) : 5;
}

function getMaxResponseBytes() {
  const n = Number(process.env.MAX_RESPONSE_BYTES || String(25 * 1024 * 1024));
  return Number.isFinite(n) && n > 0
    ? Math.min(Math.max(n, 1024 * 1024), 200 * 1024 * 1024)
    : 25 * 1024 * 1024;
}

function looksTextual(contentType) {
  const ct = (contentType || '').toLowerCase();
  return (
    ct.startsWith('text/') ||
    ct.includes('application/json') ||
    ct.includes('application/xml') ||
    ct.includes('text/xml') ||
    ct.includes('application/javascript') ||
    ct.includes('application/xhtml+xml')
  );
}

async function readStreamToBuffer(stream, maxBytes) {
  if (!stream) return Buffer.alloc(0);

  // undici/web-streams path
  if (typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          try { await reader.cancel(); } catch { /* ignore */ }
          throw Object.assign(new Error('response too large'), { code: 'RESPONSE_TOO_LARGE', bytes: total, maxBytes });
        }
        chunks.push(Buffer.from(value));
      }
    }
    return Buffer.concat(chunks, total);
  }

  // Node.js Readable fallback
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw Object.assign(new Error('response too large'), { code: 'RESPONSE_TOO_LARGE', bytes: total, maxBytes });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks, total);
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('upstream-timeout')), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFollowingRedirects(initialUrl, init, { timeoutMs, maxRedirects, allowedHosts }) {
  let current = initialUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const resp = await fetchWithTimeout(current.toString(), { ...init, redirect: 'manual' }, timeoutMs);
    const status = resp.status;

    if (status >= 300 && status < 400) {
      const location = resp.headers.get('Location');
      if (!location) return resp;

      const next = new URL(location, current);
      if (next.protocol !== 'https:' && next.protocol !== 'http:') {
        throw Object.assign(new Error('invalid redirect protocol'), { code: 'BAD_REDIRECT' });
      }
      if (!isAllowedHost(next.hostname, allowedHosts)) {
        throw Object.assign(new Error('redirect host not allowed'), { code: 'BAD_REDIRECT_HOST', host: next.hostname });
      }
      current = next;
      continue;
    }

    return resp;
  }

  throw Object.assign(new Error('too many redirects'), { code: 'TOO_MANY_REDIRECTS' });
}

async function readBodyForGateway(upstreamResponse, maxBytes) {
  const contentType = upstreamResponse.headers.get('Content-Type') || 'application/octet-stream';
  const contentLengthHeader = upstreamResponse.headers.get('Content-Length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw Object.assign(new Error('response too large'), { code: 'RESPONSE_TOO_LARGE', bytes: contentLength, maxBytes });
  }

  if (looksTextual(contentType)) {
    const buf = await readStreamToBuffer(upstreamResponse.body, maxBytes);
    const text = buf.toString('utf8');
    return { body: text, isBase64Encoded: false, contentType };
  }

  const buf = await readStreamToBuffer(upstreamResponse.body, maxBytes);
  const b64 = buf.toString('base64');
  return { body: b64, isBase64Encoded: true, contentType };
}

module.exports.handler = async function handler(event) {
  try {
    const method = (event?.httpMethod || event?.requestContext?.http?.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      return empty(204);
    }

    if (method !== 'GET') {
      return json(405, { error: 'Method not allowed' });
    }

    if (queryOf(event).metricEvent) {
      return handleMetricEvent(event);
    }

    const allowedHosts = parseAllowedHostsEnv();
    const timeoutMs = getTimeoutMs();
    const maxRedirects = getMaxRedirects();
    const maxBytes = getMaxResponseBytes();

    const rawUrl = queryOf(event).url;
    if (!rawUrl) {
      return json(400, { error: 'Missing url query parameter. Example: /?url=https%3A%2F%2Fexample.com' });
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return json(400, { error: 'Invalid url' });
    }

    const purpose = requestPurpose(event, targetUrl);
    const ip = getClientIp(event);

    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return json(400, { error: 'Invalid protocol' });
    }

    if (!isAllowedHost(targetUrl.hostname, allowedHosts)) {
      logJson({ event: 'blocked-host', ip, host: targetUrl.hostname, purpose });
      return json(403, { error: `Host not allowed: ${targetUrl.hostname}` });
    }

    const startTime = Date.now();

    try {
      const upstream = await fetchFollowingRedirects(
        targetUrl,
        {
          method: 'GET',
          headers: {
            Accept: event?.headers?.accept || event?.headers?.Accept || '*/*',
            'User-Agent': 'Mozilla/5.0 (compatible; tyres-discs-yc-proxy/1.0)',
          },
        },
        { timeoutMs, maxRedirects, allowedHosts }
      );

      const fetchDuration = Date.now() - startTime;
      const { body, isBase64Encoded, contentType } = await readBodyForGateway(upstream, maxBytes);

      const responseObj = {
        statusCode: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': contentType,
        },
        body,
        isBase64Encoded,
      };

      if (purpose !== 'image' || upstream.status >= 400) {
        logJson({
          event: purpose === 'image' ? 'proxy-image-error' : 'proxy-price',
          ip,
          status: upstream.status,
          ms: fetchDuration,
          bytes: JSON.stringify(responseObj).length,
          ...safeUpstream(targetUrl),
        });
      }

      return responseObj;
    } catch (e) {
      const fetchDuration = Date.now() - startTime;
      logJson({
        event: 'proxy-error',
        ip,
        purpose,
        error: e?.message || String(e),
        code: e?.code,
        ms: fetchDuration,
        ...safeUpstream(targetUrl),
      });
      const msg = e?.message || String(e);
      if (e?.code === 'TOO_MANY_REDIRECTS') return json(502, { error: 'Too many redirects' });
      if (e?.code === 'BAD_REDIRECT') return json(502, { error: 'Bad redirect' });
      if (e?.code === 'BAD_REDIRECT_HOST') return json(502, { error: 'Redirect host not allowed', host: e?.host });
      if (e?.code === 'RESPONSE_TOO_LARGE') {
        return json(413, { error: 'Response too large', bytes: e?.bytes, maxBytes: e?.maxBytes });
      }
      if (/upstream-timeout/i.test(msg)) return json(504, { error: 'Upstream timeout' });
      return json(502, { error: 'Upstream fetch failed', detail: msg });
    }
  } catch (e) {
    logJson({ event: 'handler-crash', error: e?.message || String(e) });
    const msg = e?.message || String(e);
    return json(502, { error: 'Handler crash', detail: msg });
  }
};