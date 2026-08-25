export const TIRE_FACET_IRRELEVANT_FIELDS = [
  'brand',
  'supplier',
  'onlyAmountFrom4',
  'onlyRunflat',
  'spikes',
];

export const DISC_FACET_IRRELEVANT_FIELDS = ['brand', 'onlyAmountFrom4'];

export const SEARCH_FACET_DEBOUNCE_MS = 16;

export function didOnlyIrrelevantSearchFieldsChange(
  changedValues,
  irrelevantFields
) {
  const keys = Object.keys(changedValues || {});
  if (keys.length === 0) return true;
  const irrelevant = new Set(irrelevantFields);
  return keys.every((key) => irrelevant.has(key));
}

export function scheduleDebounced(timerRef, delay, fn) {
  if (timerRef.current != null) {
    clearTimeout(timerRef.current);
  }
  timerRef.current = setTimeout(() => {
    timerRef.current = null;
    fn();
  }, delay);
}

export function clearDebounced(timerRef) {
  if (timerRef.current != null) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function beginCatalogSearchRequest({
  searchRequestIdRef,
  foregroundRequestIdRef,
  background,
}) {
  const requestId = ++searchRequestIdRef.current;
  if (!background) {
    foregroundRequestIdRef.current = requestId;
  }
  return requestId;
}

export function settleCatalogSearchLoading({
  background,
  requestId,
  searchRequestIdRef,
  foregroundRequestIdRef,
  mountedRef,
  requestedWorkspaceKey,
  workspaceKeyRef,
  setLoadingSearch,
}) {
  if (!mountedRef.current) return;
  if (requestedWorkspaceKey !== workspaceKeyRef.current) return;

  if (requestId === searchRequestIdRef.current) {
    setLoadingSearch(false);
    return;
  }

  if (!background && foregroundRequestIdRef.current === requestId) {
    setLoadingSearch(false);
  }
}
