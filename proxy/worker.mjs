/**
 * CORS-прокси + KV-кэш.
 * Браузер получает только из кэша (быстро). Пополнение — /warm и cron.
 */

import { WARM_URLS } from './warm-urls.mjs';

const ALLOWED_HOSTS = [
  'z34.ru',
  'b2b.4tochki.ru',
  'shina.su',
  'vershinatyres.ru',
  'duplo-api.shinservice.ru',
];

const UPSTREAM_TIMEOUT_MS = 120_000;
const CACHE_TTL_SECONDS = 7200;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(status, data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
}

/** Одинаковый ключ для warm и для ?url= из приложения */
export function cacheKeyFor(input) {
  const url = typeof input === 'string' ? new URL(input) : new URL(input.toString());
  url.hash = '';
  const sorted = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  const query = new URLSearchParams(sorted).toString();
  return `v2:${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

function guessContentType(url) {
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (path.includes('xml') || url.searchParams.get('export_format') === 'XML') {
    return 'application/xml';
  }
  return 'application/octet-stream';
}

function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('upstream-timeout'), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

async function readFromCache(env, targetUrl) {
  if (!env.SUPPLIER_CACHE) return null;

  const key = cacheKeyFor(targetUrl);
  const metaEntry = await env.SUPPLIER_CACHE.getWithMetadata(key);
  if (!metaEntry?.value) return null;

  const stream = await env.SUPPLIER_CACHE.get(key, 'stream');
  if (!stream) return null;

  return {
    body: stream,
    contentType: metaEntry.metadata?.contentType || guessContentType(targetUrl),
    cachedAt: metaEntry.metadata?.cachedAt || null,
  };
}

async function writeToCache(env, targetUrl, body, contentType) {
  if (!env.SUPPLIER_CACHE) return;
  const key = cacheKeyFor(targetUrl);
  await env.SUPPLIER_CACHE.put(key, body, {
    expirationTtl: CACHE_TTL_SECONDS,
    metadata: {
      contentType,
      cachedAt: new Date().toISOString(),
    },
  });
}

async function fetchUpstream(targetUrl, acceptHeader) {
  const upstream = await fetchWithTimeout(
    targetUrl.toString(),
    {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: acceptHeader || '*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; tyres-discs-proxy/1.2)',
      },
    },
    UPSTREAM_TIMEOUT_MS
  );

  const contentType = upstream.headers.get('Content-Type') || guessContentType(targetUrl);
  const body = await upstream.arrayBuffer();

  return { upstream, body, contentType };
}

async function warmOneUrl(env, urlString) {
  let targetUrl;
  try {
    targetUrl = new URL(urlString);
  } catch {
    return { url: urlString, ok: false, error: 'invalid url' };
  }

  if (!isAllowedHost(targetUrl.hostname)) {
    return { url: urlString, ok: false, error: 'host not allowed' };
  }

  try {
    const { upstream, body, contentType } = await fetchUpstream(targetUrl, '*/*');
    if (upstream.ok) {
      await writeToCache(env, targetUrl, body, contentType);
      return {
        url: urlString,
        ok: true,
        status: upstream.status,
        bytes: body.byteLength,
        cacheKey: cacheKeyFor(targetUrl),
      };
    }
    return {
      url: urlString,
      ok: false,
      status: upstream.status,
      error: `HTTP ${upstream.status}`,
    };
  } catch (error) {
    return { url: urlString, ok: false, error: error.message || String(error) };
  }
}

async function warmAll(env) {
  const results = [];
  for (const url of WARM_URLS) {
    results.push(await warmOneUrl(env, url));
  }
  return results;
}

/** Запросы из браузера — только KV. Без долгого upstream (иначе ERR_TIMED_OUT). */
async function proxyRequest(targetUrl, env) {
  const cached = await readFromCache(env, targetUrl);
  if (cached) {
    return new Response(cached.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': cached.contentType,
        'X-Cache': 'HIT',
        'X-Cache-At': cached.cachedAt || '',
      },
    });
  }

  return jsonResponse(503, {
    error:
      'Нет данных в кэше для этого URL. С компьютера выполните: curl "https://<ваш-worker>/warm" и дождитесь JSON, затем повторите загрузку в приложении.',
    host: targetUrl.hostname,
    cacheKey: cacheKeyFor(targetUrl),
  });
}

export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (requestUrl.pathname === '/health' || requestUrl.pathname === '/health/') {
      let cachedCount = 0;
      const details = [];
      if (env.SUPPLIER_CACHE) {
        for (const url of WARM_URLS) {
          const key = cacheKeyFor(url);
          const hit = await env.SUPPLIER_CACHE.get(key);
          if (hit) cachedCount += 1;
          details.push({ url, cached: Boolean(hit), cacheKey: key });
        }
      }
      return jsonResponse(200, {
        ok: true,
        kv: Boolean(env.SUPPLIER_CACHE),
        cachedUrls: cachedCount,
        warmTotal: WARM_URLS.length,
        cacheMode: 'browser-cache-only',
        upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS,
        cacheTtlSeconds: CACHE_TTL_SECONDS,
        details,
      });
    }

    if (requestUrl.pathname === '/warm' || requestUrl.pathname === '/warm/') {
      if (request.method !== 'GET') {
        return jsonResponse(405, { error: 'Use GET /warm' });
      }
      const results = await warmAll(env);
      const ok = results.filter((r) => r.ok).length;
      return jsonResponse(200, {
        warmed: ok,
        total: results.length,
        results,
      });
    }

    if (request.method !== 'GET') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    const target = requestUrl.searchParams.get('url');
    if (!target) {
      return jsonResponse(400, {
        error: 'Missing url query parameter. Example: /?url=https%3A%2F%2Fexample.com',
      });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return jsonResponse(400, { error: 'Invalid url' });
    }

    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return jsonResponse(400, { error: 'Invalid protocol' });
    }

    if (!isAllowedHost(targetUrl.hostname)) {
      return jsonResponse(403, { error: `Host not allowed: ${targetUrl.hostname}` });
    }

    return proxyRequest(targetUrl, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(warmAll(env));
  },
};
