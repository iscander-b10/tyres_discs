/**
 * CORS-прокси для GitHub Pages. Деплой (один раз):
 *   cd proxy
 *   npx wrangler deploy
 * Затем в .env.production: REACT_APP_CORS_PROXY=https://<worker>.<поддомен-аккаунта>.workers.dev
 * (URL целиком копируйте из вывода wrangler deploy — не сокращайте до *.workers.dev)
 */

const ALLOWED_HOSTS = [
  'z34.ru',
  'b2b.4tochki.ru',
  'shina.su',
  'vershinatyres.ru',
  'duplo-api.shinservice.ru',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);
    const target = requestUrl.searchParams.get('url');

    if (!target) {
      return new Response('Missing url query parameter', { status: 400, headers: corsHeaders });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid url', { status: 400, headers: corsHeaders });
    }

    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return new Response('Invalid protocol', { status: 400, headers: corsHeaders });
    }

    if (!isAllowedHost(targetUrl.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: corsHeaders });
    }

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: request.headers.get('Accept') || '*/*',
          'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        },
      });

      const responseHeaders = new Headers(corsHeaders);
      const contentType = upstream.headers.get('Content-Type');
      if (contentType) {
        responseHeaders.set('Content-Type', contentType);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(`Upstream error: ${error.message}`, {
        status: 502,
        headers: corsHeaders,
      });
    }
  },
};
