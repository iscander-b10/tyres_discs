/** Один reload бандла за sessionStorage-сессию вкладки. */
export const CATALOG_BUNDLE_RELOAD_KEY = 'ivanor.catalog.bundleReloaded';

let comparedWhileVisible = false;
let inFlight = null;

export function resetCatalogBundleCheckState() {
  comparedWhileVisible = false;
  inFlight = null;
}

export function noteCatalogBundleHidden() {
  comparedWhileVisible = false;
}

function assetUrl(file) {
  const base = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (!base) return `/${file}`;
  return `${base}/${file}`;
}

export function scriptFileName(src) {
  const raw = String(src || '').trim();
  if (!raw || raw.startsWith('data:')) return '';
  try {
    const url = new URL(raw, 'https://catalog.local');
    const path = url.pathname;
    if (!path.includes('/static/js/')) return '';
    const name = path.split('/').pop() || '';
    return name.endsWith('.js') ? name : '';
  } catch {
    return '';
  }
}

export function scriptsFromAssetManifest(manifest) {
  const entrypoints = Array.isArray(manifest?.entrypoints)
    ? manifest.entrypoints
    : [];
  const fromEntry = entrypoints.filter((item) => scriptFileName(item));
  if (fromEntry.length) return fromEntry;
  const files =
    manifest?.files && typeof manifest.files === 'object'
      ? Object.values(manifest.files)
      : [];
  return files.filter((item) => typeof item === 'string' && scriptFileName(item));
}

export function scriptsFromIndexHtml(html) {
  const srcs = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match = re.exec(String(html || ''));
  while (match) {
    srcs.push(match[1]);
    match = re.exec(String(html || ''));
  }
  return srcs;
}

export function catalogBundleDiffers(currentSrcs, remoteSrcs) {
  const remoteNames = [];
  for (const src of remoteSrcs || []) {
    const name = scriptFileName(src);
    if (name && !remoteNames.includes(name)) remoteNames.push(name);
  }
  if (!remoteNames.length) return false;
  const currentNames = new Set(
    (currentSrcs || []).map((src) => scriptFileName(src)).filter(Boolean)
  );
  return remoteNames.some((name) => !currentNames.has(name));
}

function currentDocumentScripts() {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll('script[src]')).map(
    (node) => node.getAttribute('src') || ''
  );
}

async function loadRemoteScriptSrcs(fetchImpl) {
  try {
    const manifestRes = await fetchImpl(assetUrl('asset-manifest.json'), {
      cache: 'no-store',
    });
    if (manifestRes?.ok) {
      const data = await manifestRes.json();
      const scripts = scriptsFromAssetManifest(data);
      if (scripts.length) return scripts;
    }
  } catch {
    /* manifest недоступен — ниже сравниваем index.html */
  }

  const indexRes = await fetchImpl(assetUrl('index.html'), {
    cache: 'no-store',
  });
  if (!indexRes?.ok) return [];
  return scriptsFromIndexHtml(await indexRes.text());
}

/**
 * Сравнивает скрипты открытой вкладки с asset-manifest.json (или index.html).
 * Запрос не чаще одного раза за показ. Reload — не больше одного за сессию.
 * @param {{ force?: boolean, fetchImpl?: typeof fetch, storage?: Storage, location?: { reload?: () => void }, currentSrcs?: string[] }} [options]
 * @returns {Promise<boolean>} true, если запрошен reload
 */
export async function ensureFreshCatalogBundle({
  force = false,
  fetchImpl,
  storage,
  location,
  currentSrcs,
} = {}) {
  if (!force && comparedWhileVisible) return false;

  const session =
    storage ||
    (typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!session) return false;

  try {
    if (session.getItem(CATALOG_BUNDLE_RELOAD_KEY) === '1') {
      comparedWhileVisible = true;
      return false;
    }
  } catch {
    return false;
  }

  if (inFlight) return inFlight;

  const fetchFn =
    fetchImpl ||
    (typeof window !== 'undefined' ? window.fetch : undefined);
  if (typeof fetchFn !== 'function') return false;

  comparedWhileVisible = true;
  const reloadTarget =
    location || (typeof window !== 'undefined' ? window.location : undefined);

  inFlight = (async () => {
    try {
      const remoteSrcs = await loadRemoteScriptSrcs(fetchFn);
      const localSrcs = currentSrcs || currentDocumentScripts();
      if (!catalogBundleDiffers(localSrcs, remoteSrcs)) return false;
      try {
        session.setItem(CATALOG_BUNDLE_RELOAD_KEY, '1');
      } catch {
        return false;
      }
      reloadTarget?.reload?.();
      return true;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
