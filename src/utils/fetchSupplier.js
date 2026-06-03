/**
 * В dev относительные /api/... идут в setupProxy.js.
 * На GitHub Pages — через REACT_APP_CORS_PROXY (Cloudflare Worker), если задан.
 */
const CORS_PROXY = process.env.REACT_APP_CORS_PROXY?.trim() || '';

const RETRY_ATTEMPTS_WITH_PROXY = 1;
const RETRY_ATTEMPTS_DEFAULT = 2;
const RETRY_BASE_DELAY_MS = 1500;

export function usesCorsProxy() {
  return Boolean(CORS_PROXY);
}

export function resolveSupplierFetchUrl(targetUrl) {
  if (!targetUrl) {
    return targetUrl;
  }

  if (targetUrl.startsWith('/')) {
    return targetUrl;
  }

  if (CORS_PROXY) {
    const proxyBase = CORS_PROXY.endsWith('/') ? CORS_PROXY : `${CORS_PROXY}/`;
    return `${proxyBase}?url=${encodeURIComponent(targetUrl)}`;
  }

  return targetUrl;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableResponse(response) {
  if (response.status === 503 || response.status === 504) return false;
  return response.status >= 500 || response.status === 429;
}

async function readProxyError(response) {
  try {
    const data = await response.clone().json();
    if (data?.error) return data.error;
  } catch {
    /* not JSON */
  }
  return `HTTP ${response.status}`;
}

function isRetryableError(error) {
  if (!error) return false;
  const message = error.message || '';
  return (
    error.name === 'TypeError' ||
    /failed to fetch|network|timeout|timed out|aborted/i.test(message)
  );
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {{ maxAttempts?: number }} [options]
 */
export async function fetchWithRetry(url, init = {}, options = {}) {
  const maxAttempts = options.maxAttempts ?? (usesCorsProxy() ? RETRY_ATTEMPTS_WITH_PROXY : RETRY_ATTEMPTS_DEFAULT);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);

      if (!response.ok) {
        if (isRetryableResponse(response) && attempt < maxAttempts) {
          await delay(RETRY_BASE_DELAY_MS * attempt);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error;
      if (isRetryableError(error) && attempt < maxAttempts) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Не удалось выполнить запрос');
}

export function describeFetchTarget(targetUrl) {
  if (!targetUrl) return 'неизвестный URL';
  if (targetUrl.startsWith('/')) return targetUrl.split('?')[0];
  try {
    return new URL(targetUrl).hostname;
  } catch {
    return targetUrl;
  }
}

export async function fetchSupplier(targetUrl, init = {}) {
  const url = resolveSupplierFetchUrl(targetUrl);
  const { headers = {}, ...rest } = init;

  const safeHeaders = { ...headers };
  if (!rest.method || rest.method.toUpperCase() === 'GET') {
    delete safeHeaders['Content-Type'];
    delete safeHeaders['content-type'];
  }

  try {
    return await fetchWithRetry(url, { ...rest, headers: safeHeaders });
  } catch (error) {
    const host = describeFetchTarget(targetUrl);
    const attempts = usesCorsProxy() ? RETRY_ATTEMPTS_WITH_PROXY : RETRY_ATTEMPTS_DEFAULT;
    throw new Error(
      `${host}: ${error.message || 'сетевая ошибка'} (попыток: ${attempts})`,
      { cause: error }
    );
  }
}
