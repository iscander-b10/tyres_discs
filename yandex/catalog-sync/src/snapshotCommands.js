export const CATALOG_SNAPSHOT_SCHEMA_VERSION = 1;

const CATEGORIES = ['tyres', 'discs'];

const replace = (items) => ({ action: 'replace', status: 'ok', items });
const purge = () => ({ action: 'purge', status: 'ok' });
const keepPrevious = (status) => ({ action: 'keepPrevious', status });

/**
 * Извлекает материализованное состояние из legacy- и command-snapshot.
 * keepPrevious не содержит payload и поэтому не подходит для bootstrap.
 */
export function readPreviousCategoryState(category) {
  if (Array.isArray(category)) {
    return { known: true, action: 'replace', items: category };
  }
  if (category?.action === 'replace' && Array.isArray(category.items)) {
    return { known: true, action: 'replace', items: category.items };
  }
  if (category?.action === 'purge') {
    return { known: true, action: 'purge', items: [] };
  }
  return { known: false, action: null, items: [] };
}

function preservePrevious(previousCategory, fallbackStatus) {
  const previous = readPreviousCategoryState(previousCategory);
  if (!previous.known) return keepPrevious(fallbackStatus);
  if (previous.action === 'purge') return purge();
  if (previous.items.length > 0) return replace(previous.items);
  return keepPrevious('keptPrevious');
}

/**
 * Пустой upstream-массив неоднозначен и не должен очищать каталог.
 * purge переносится только из уже подтверждённого предыдущего состояния.
 */
export function resolveCategoryCommand({
  loaded,
  items,
  previousCategory,
}) {
  if (!loaded) {
    return {
      command: preservePrevious(previousCategory, 'failed'),
      degraded: true,
      reason: 'load failed',
    };
  }

  if (Array.isArray(items) && items.length > 0) {
    return { command: replace(items), degraded: false, reason: null };
  }

  return {
    command: preservePrevious(previousCategory, 'keptPrevious'),
    degraded: true,
    reason: 'empty upstream result',
  };
}

/**
 * Формирует versioned command-snapshot и сохраняет payload предыдущего
 * успешного состояния, чтобы snapshot оставался пригодным для bootstrap.
 */
export function buildSnapshotSuppliers({
  previousSnapshot,
  loadResults,
  supplierKeys,
  getSupplierLabel,
}) {
  const previousSuppliers = previousSnapshot?.suppliers || {};
  const suppliers = {};
  const metaSuppliers = [];

  for (const key of supplierKeys) {
    const result = loadResults.find((entry) => entry.key === key);
    const loaded = result?.status === 'fulfilled' && Boolean(result.value);
    const label = loaded
      ? result.value.label || getSupplierLabel(key)
      : previousSuppliers[key]?.label || getSupplierLabel(key);
    const previous = previousSuppliers[key] || {};
    const commands = {};
    const degradedCategories = [];

    for (const category of CATEGORIES) {
      const resolution = resolveCategoryCommand({
        loaded,
        items: loaded ? result.value[category] : null,
        previousCategory: previous[category],
      });
      commands[category] = resolution.command;
      if (resolution.degraded) degradedCategories.push(category);
    }

    const loadError = loaded
      ? null
      : result?.reason?.message || String(result?.reason || 'unknown error');
    const emptyError =
      loaded && degradedCategories.length > 0
        ? `empty upstream result: ${degradedCategories.join(',')}`
        : null;
    const error = loadError || emptyError;
    const ok = !error;

    suppliers[key] = {
      key,
      label,
      supplier: label,
      ok,
      ...(!ok ? { keptPrevious: true, error } : {}),
      ...commands,
    };
    metaSuppliers.push({
      key,
      label,
      ok,
      ...(error ? { error } : {}),
      ...(!ok ? { keptPrevious: true } : {}),
    });
  }

  return { suppliers, metaSuppliers };
}
