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

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(data),
    isBase64Encoded: false,
  };
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
  // Заменили log на error
  console.error('Incoming request:', event?.httpMethod || event?.requestContext?.http?.method, event?.queryStringParameters?.url);

  try {
    const method = (event?.httpMethod || event?.requestContext?.http?.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      return { statusCode: 204, headers: { ...CORS_HEADERS }, body: '', isBase64Encoded: false };
    }

    if (method !== 'GET') {
      return json(405, { error: 'Method not allowed' });
    }

    const allowedHosts = parseAllowedHostsEnv();
    const timeoutMs = getTimeoutMs();
    const maxRedirects = getMaxRedirects();
    const maxBytes = getMaxResponseBytes();

    const rawUrl = event?.queryStringParameters?.url;
    if (!rawUrl) {
      return json(400, { error: 'Missing url query parameter. Example: /?url=https%3A%2F%2Fexample.com' });
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return json(400, { error: 'Invalid url' });
    }

    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return json(400, { error: 'Invalid protocol' });
    }

    if (!isAllowedHost(targetUrl.hostname, allowedHosts)) {
      console.error('Blocked host:', targetUrl.hostname);   // warn → error
      return json(403, { error: `Host not allowed: ${targetUrl.hostname}` });
    }

    console.error('Fetching:', targetUrl.toString());   // log → error
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
      console.error('Upstream responded with', upstream.status, 'in', fetchDuration, 'ms');   // log → error

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

      const responseSize = JSON.stringify(responseObj).length;
      console.error('Response size:', responseSize, 'bytes');   // log → error

      if (event?.queryStringParameters?.debug === '1') {
        console.error('Debug info:', {   // log → error
          targetUrl: targetUrl.toString(),
          upstreamStatus: upstream.status,
          contentType,
          responseSize,
          fetchDurationMs: fetchDuration,
          memoryUsage: process.memoryUsage(),
        });
      }

      return responseObj;
    } catch (e) {
      const fetchDuration = Date.now() - startTime;
      console.error('proxy error', {   // уже error, оставляем
        error: e?.message || String(e),
        code: e?.code,
        status: e?.status,
        url: targetUrl?.toString(),
        fetchDurationMs: fetchDuration,
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
    console.error('handler crash', e);
    const msg = e?.message || String(e);
    return json(502, { error: 'Handler crash', detail: msg });
  }
};