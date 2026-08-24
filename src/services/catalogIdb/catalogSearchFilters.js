export const isActiveFilterValue = (value) => {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const matchesBrandFilter = (itemBrand, brandFilter) => {
  if (!isActiveFilterValue(brandFilter)) return true;
  if (Array.isArray(brandFilter)) return brandFilter.includes(itemBrand);
  return itemBrand === brandFilter;
};

export const getSingleBrandForIndex = (brandFilter) => {
  if (Array.isArray(brandFilter)) {
    return brandFilter.length === 1 ? brandFilter[0] : null;
  }
  return brandFilter || null;
};

export const matchesTireDiameter = (itemDiameter, filterDiameter) => {
  if (!isActiveFilterValue(filterDiameter)) return true;
  return String(itemDiameter) === String(filterDiameter);
};

export const matchesTireNumericField = (itemValue, filterValue) => {
  if (!isActiveFilterValue(filterValue)) return true;
  return Number(itemValue) === Number(filterValue);
};

const matchesTireParameterFilters = (item, filters = {}) => {
  if (!matchesTireNumericField(item.width, filters.width)) return false;
  if (!matchesTireNumericField(item.profile, filters.profile)) return false;
  if (!matchesTireDiameter(item.diameter, filters.diameter)) return false;
  if (filters.season && item.season !== filters.season) return false;
  return true;
};

export const matchesDiscStringField = (itemValue, filterValue) => {
  if (!isActiveFilterValue(filterValue)) return true;
  return String(itemValue) === String(filterValue);
};

export const matchesDiscRange = (itemValue, from, to) => {
  if (!isActiveFilterValue(from) && !isActiveFilterValue(to)) return true;
  const num = itemValue === undefined || itemValue === null ? NaN : Number(itemValue);
  if (Number.isNaN(num)) return false;
  if (isActiveFilterValue(from) && num < Number(from)) return false;
  if (isActiveFilterValue(to) && num > Number(to)) return false;
  return true;
};

const matchesDiscParameterFilters = (item, filters = {}) => {
  if (!matchesBrandFilter(item.brand, filters.brand)) return false;
  if (!matchesDiscStringField(item.supplier, filters.supplier)) return false;
  if (!matchesTireDiameter(item.diameter, filters.diameter)) return false;
  if (!matchesTireNumericField(item.pcd, filters.pcd)) return false;
  if (!matchesTireNumericField(item.pn, filters.pn)) return false;
  if (!matchesDiscStringField(item.diskType, filters.diskType)) return false;
  if (!matchesDiscRange(item.width, filters.widthFrom, filters.widthTo)) return false;
  if (!matchesDiscRange(item.cb, filters.cbFrom, filters.cbTo)) return false;
  if (!matchesDiscRange(item.et, filters.etFrom, filters.etTo)) return false;
  return true;
};

const resolveMinAmountFilter = (filters = {}) => {
  if (filters.minAmount === undefined || filters.minAmount === null) return null;
  const minAmountNumber = Number(filters.minAmount);
  return Number.isNaN(minAmountNumber) ? null : minAmountNumber;
};

const matchesMinAmount = (item, filters = {}) => {
  const minAmountNumber = resolveMinAmountFilter(filters);
  if (minAmountNumber === null) return true;
  const amountNumber = Number(item?.amount);
  return !Number.isNaN(amountNumber) && amountNumber >= minAmountNumber;
};

/** Чистый matcher поиска шин (размер, бренд, шипы, runflat, minAmount). */
export const matchesTireSearchFilters = (item, filters = {}) =>
  matchesTireParameterFilters(item, filters) &&
  matchesBrandFilter(item.brand, filters.brand) &&
  (!filters.supplier || item.supplier === filters.supplier) &&
  (filters.spikes === undefined || item.spikes === filters.spikes) &&
  (filters.runflat !== true || item.runflat === true) &&
  matchesMinAmount(item, filters);

/** Чистый matcher поиска дисков (геометрия, бренд, minAmount). */
export const matchesDiscSearchFilters = (item, filters = {}) =>
  matchesDiscParameterFilters(item, filters) && matchesMinAmount(item, filters);
