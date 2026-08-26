const isInactiveBoundValue = (value) =>
  value === undefined || value === null || value === '';

/**
 * UI-only фильтр опций Select «от» / «до» для ЦО, ширины и вылета.
 * Facets своего измерения не трогает: режет уже готовый список соседней границей.
 *
 * @param {Array<number|string>} options
 * @param {'from'|'to'} bound
 * @param {unknown} otherValue значение соседнего поля
 * @returns {Array<number|string>}
 */
export function filterDiscRangeSelectOptions(options, bound, otherValue) {
  if (!Array.isArray(options)) {
    return [];
  }
  if (isInactiveBoundValue(otherValue)) {
    return options;
  }

  const otherNumber = Number(otherValue);
  if (!Number.isFinite(otherNumber)) {
    return options;
  }

  if (bound === 'from') {
    return options.filter((option) => Number(option) <= otherNumber);
  }

  return options.filter((option) => Number(option) >= otherNumber);
}
