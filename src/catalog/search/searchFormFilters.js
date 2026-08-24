/**
 * Маппинг значений формы поиска в фильтры IndexedDB.
 * Держим чистым, чтобы UI-гонки и matching тестировались отдельно.
 */

export function mapTireFormValuesToSearchFilters(values = {}) {
  const searchParams = { ...values };
  if (searchParams.spikes === null) {
    delete searchParams.spikes;
  }
  if (searchParams.onlyAmountFrom4) {
    searchParams.minAmount = 4;
  }
  delete searchParams.onlyAmountFrom4;
  if (searchParams.onlyRunflat) {
    searchParams.runflat = true;
  }
  delete searchParams.onlyRunflat;
  return searchParams;
}

export function mapDiscFormValuesToSearchFilters(values = {}) {
  const searchParams = { ...values };
  if (searchParams.onlyAmountFrom4) {
    searchParams.minAmount = 4;
  }
  delete searchParams.onlyAmountFrom4;
  return searchParams;
}
