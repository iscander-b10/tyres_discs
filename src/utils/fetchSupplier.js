/**
 * В dev относительные /api/... идут в setupProxy.js.
 * На GitHub Pages — через REACT_APP_CORS_PROXY (Yandex API Gateway), если задан.
 *
 * Старые пути шлюза (`/`, `/b2b`, `/z34`, `/vershina`) закрыты:
 * открытая вкладка со старым JS больше не может грузить прайсы.
 */
const CORS_PROXY = process.env.REACT_APP_CORS_PROXY?.trim() || '';
/** Актуальный префикс API Gateway. Старые клиенты ходят без него и получают 403. */
const CORS_PROXY_API_PREFIX = '/v2';
/** Включить ?debug=1 в запросах к облачной функции (только для маршрутов с ?url=) */
const CORS_PROXY_DEBUG = process.env.REACT_APP_CORS_PROXY_DEBUG === '1';

const RETRY_ATTEMPTS_WITH_PROXY = 1;
const RETRY_ATTEMPTS_DEFAULT = 2;
const RETRY_BASE_DELAY_MS = 1500;

// Поставщики, для которых используется прямой прокси (без облачной функции)
const DIRECT_PROXY_MAP = {
  'b2b.4tochki.ru': '/b2b',
  'z34.ru': '/z34',
  'vershinatyres.ru': '/vershina',
};

/** Базовые origin для относительных photoUrl по label поставщика */
const SUPPLIER_ORIGINS = {
  'Вершина': 'https://vershinatyres.ru',
  'ШинаСу': 'https://shina.su',
  'Форточки': 'https://api-b2b.pwrs.ru',
  'Семисотнов': 'https://z34.ru',
  'Шинсервис': 'https://duplo-s0.shinservice.ru',
};

export function usesCorsProxy() {
  return Boolean(CORS_PROXY);
}

function corsProxyBase() {
  return `${CORS_PROXY.replace(/\/$/, '')}${CORS_PROXY_API_PREFIX}`;
}

/**
 * Преобразует URL поставщика в URL прокси (через Yandex API Gateway).
 * - Для поставщиков из DIRECT_PROXY_MAP – формирует прямой путь, пробрасывая query-параметры.
 * - Для всех остальных (shina.su, shinservice) – использует параметр ?url=.
 */
export function resolveSupplierFetchUrl(targetUrl, { purpose = 'price' } = {}) {
  if (!targetUrl || targetUrl.startsWith('/')) {
    return targetUrl;
  }

  if (!CORS_PROXY) {
    return targetUrl; // без прокси
  }

  // Пытаемся распознать хост
  let hostname;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    // некорректный URL – оставляем как есть
    return targetUrl;
  }

  // Если хост есть в DIRECT_PROXY_MAP – строим прямой маршрут
  if (hostname && DIRECT_PROXY_MAP[hostname]) {
    const proxyPath = DIRECT_PROXY_MAP[hostname];
    // Убираем origin (протокол + хост), оставляем путь и query
    const remaining = targetUrl.replace(/^https?:\/\/[^/]+/, '');
    return `${corsProxyBase()}${proxyPath}${remaining}`;
  }

  // Для всех остальных – облачная функция с ?url=
  const debugSuffix = CORS_PROXY_DEBUG ? '&debug=1' : '';
  return `${corsProxyBase()}?url=${encodeURIComponent(targetUrl)}&purpose=${encodeURIComponent(purpose)}${debugSuffix}`;
}

/**
 * Нормализует photoUrl: делает абсолютным и в production проксирует через API Gateway
 * (иначе <img> грузится напрямую с домена поставщика и блокируется hotlink/CORS).
 */
export function resolvePhotoUrl(rawUrl, supplierLabel) {
  const raw = String(rawUrl ?? '').trim();
  if (!raw || raw === 'undefined' || raw === 'null') return '';

  let absolute = raw;
  if (raw.startsWith('//')) {
    absolute = `https:${raw}`;
  } else if (!/^https?:\/\//i.test(raw)) {
    const origin = SUPPLIER_ORIGINS[supplierLabel];
    if (origin) {
      absolute = raw.startsWith('/') ? `${origin}${raw}` : `${origin}/${raw}`;
    }
  }

  if (!usesCorsProxy() || !/^https?:\/\//i.test(absolute)) {
    return absolute;
  }

  return resolveSupplierFetchUrl(absolute, { purpose: 'image' });
}

export function createCatalogLoadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `load-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function compactSupplierLoadResults(results = []) {
  return results
    .map((result) => {
      const failedParts =
        result.status === 'rejected'
          ? result.reason?.failedParts || []
          : result.value?.failedParts || [];
      const failed = Array.isArray(failedParts) ? failedParts.filter(Boolean).join('+') : '';
      const status = result.status === 'fulfilled' && !failed ? 'ok' : 'fail';
      return failed ? `${result.key}:${status}:${failed}` : `${result.key}:${status}`;
    })
    .join(',');
}

/**
 * Пишет в логи Cloud Function одно событие кнопки «Загрузить данные».
 * Не блокирует загрузку каталога.
 */
export function reportCatalogLoadMetric({
  event,
  loadId,
  ok,
  hadClientErrors,
  hadSaveErrors,
  suppliers,
} = {}) {
  if (!CORS_PROXY || !event || !loadId) return;

  const params = new URLSearchParams({ metricEvent: event, loadId });
  if (event === 'load-finish') {
    params.set('ok', ok ? 'true' : 'false');
    params.set('hadClientErrors', hadClientErrors ? 'true' : 'false');
    params.set('hadSaveErrors', hadSaveErrors ? 'true' : 'false');
    if (suppliers) params.set('suppliers', suppliers);
  }

  const url = `${corsProxyBase()}/metrics/load?${params.toString()}`;
  try {
    void fetch(url, { method: 'GET', cache: 'no-store', keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableResponse(response) {
  if (response.status === 503 || response.status === 504) return false;
  return response.status >= 500 || response.status === 429;
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
  const url = resolveSupplierFetchUrl(targetUrl, { purpose: 'price' });
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