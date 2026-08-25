export const CATALOG_BOOTSTRAP_IDLE = Object.freeze({
  phase: 'idle',
  progress: 0,
  label: '',
});

export const CATALOG_BOOTSTRAP_LOADING_LABEL =
  'Загружаем каталог шин и дисков';

export const CATALOG_BOOTSTRAP_WAITING_LABEL =
  'Каталог загружается в другой вкладке';

export const CATALOG_BOOTSTRAP_WARMUP_LABEL = 'Готовим витрину';

export function clampCatalogBootstrapProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  if (numeric > 100) return 100;
  return numeric;
}

export function nextBlockingProgress(currentProgress, nextProgress) {
  return Math.min(
    99,
    Math.max(
      clampCatalogBootstrapProgress(currentProgress),
      clampCatalogBootstrapProgress(nextProgress)
    )
  );
}

export function createBlockingBootstrap(progress = 0) {
  return {
    phase: 'blocking',
    progress: nextBlockingProgress(0, progress),
    label: CATALOG_BOOTSTRAP_LOADING_LABEL,
  };
}

export function createReadyBootstrap({ waitForShowcase = false } = {}) {
  const ready = {
    phase: 'ready',
    progress: 100,
    label: '',
  };
  if (waitForShowcase) {
    ready.waitForShowcase = true;
  }
  return ready;
}

export function createErrorBootstrap(error, progress = 0) {
  return {
    phase: 'error',
    progress: clampCatalogBootstrapProgress(progress),
    label: '',
    error: String(error || 'Не удалось загрузить каталог.'),
  };
}

export function normalizeCatalogBootstrap(update, current = CATALOG_BOOTSTRAP_IDLE) {
  const next = typeof update === 'function' ? update(current) : update;
  if (!next || typeof next !== 'object') {
    return current;
  }

  const phase = next.phase || 'idle';
  const progress = clampCatalogBootstrapProgress(next.progress);
  const label = typeof next.label === 'string' ? next.label : '';
  const normalized = { phase, progress, label };
  if (phase === 'error' && next.error) {
    normalized.error = String(next.error);
  }
  const waitForShowcase =
    typeof next.waitForShowcase === 'boolean'
      ? next.waitForShowcase
      : phase !== 'idle' && Boolean(current.waitForShowcase);
  if (waitForShowcase) {
    normalized.waitForShowcase = true;
  }
  return normalized;
}

export const CATALOG_BOOTSTRAP_PHASE_LABELS = {
  meta: 'Проверяем каталог',
  download: CATALOG_BOOTSTRAP_LOADING_LABEL,
  parse: 'Читаем каталог',
  apply: 'Сохраняем каталог',
  warmup: CATALOG_BOOTSTRAP_WARMUP_LABEL,
};

const LOADED_BYTES_PREFIX = 'Загружено ';

export function formatCatalogBytesLabel(receivedBytes) {
  const bytes = Math.max(0, Number(receivedBytes) || 0);
  if (bytes <= 0) return CATALOG_BOOTSTRAP_LOADING_LABEL;
  const megabytes = bytes / (1024 * 1024);
  const formatted =
    megabytes < 10
      ? megabytes.toFixed(1).replace('.', ',')
      : String(Math.round(megabytes));
  return `${LOADED_BYTES_PREFIX}${formatted} МБ`;
}

export function isCatalogBytesLabel(label) {
  return typeof label === 'string' && label.startsWith(LOADED_BYTES_PREFIX);
}

export function isCatalogWaitingLabel(label) {
  return label === CATALOG_BOOTSTRAP_WAITING_LABEL;
}

export function catalogBootstrapHeadline(catalogBootstrap) {
  const label = catalogBootstrap?.label || '';
  if (isCatalogBytesLabel(label)) {
    return label.slice(LOADED_BYTES_PREFIX.length);
  }
  if (isCatalogWaitingLabel(label)) {
    return CATALOG_BOOTSTRAP_WAITING_LABEL;
  }
  const percent = Math.min(
    99,
    Math.floor(clampCatalogBootstrapProgress(catalogBootstrap?.progress))
  );
  return `${percent}%`;
}

export function catalogBootstrapValueText(catalogBootstrap) {
  const label =
    catalogBootstrap?.label || CATALOG_BOOTSTRAP_LOADING_LABEL;
  if (isCatalogBytesLabel(label) || isCatalogWaitingLabel(label)) {
    return label;
  }
  return `${catalogBootstrapHeadline(catalogBootstrap)} ${label}`;
}

export function labelFromSyncProgress(
  event = {},
  fallback = CATALOG_BOOTSTRAP_LOADING_LABEL
) {
  if (event.phase === 'download' && !(Number(event.totalBytes) > 0)) {
    return formatCatalogBytesLabel(event.receivedBytes || 0);
  }
  if (event.phase && CATALOG_BOOTSTRAP_PHASE_LABELS[event.phase]) {
    return CATALOG_BOOTSTRAP_PHASE_LABELS[event.phase];
  }
  return fallback || CATALOG_BOOTSTRAP_LOADING_LABEL;
}

export function isCatalogBootstrapIgnorableSkip(result) {
  return (
    result?.status === 'skipped' &&
    (result.error === 'aborted' || result.error === 'stale store')
  );
}

export function resolveCatalogBootstrapError(result) {
  if (result?.status === 'offline') {
    return 'Нет сети. Проверьте подключение.';
  }
  const message = result?.error || '';
  if (message.startsWith('HTTP')) {
    return 'Сервер каталога не ответил.';
  }
  if (
    result?.error === 'meta empty' ||
    result?.error === 'snapshot empty' ||
    /snapshot|validation|Некорректный/i.test(message)
  ) {
    return 'Каталог не удалось прочитать.';
  }
  return 'Не удалось загрузить каталог.';
}
