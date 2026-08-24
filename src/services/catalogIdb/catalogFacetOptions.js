import {
  matchesDiscRange,
  matchesDiscStringField,
  matchesTireDiameter,
  matchesTireNumericField,
} from './catalogSearchFilters';

const normalizeNumericFieldValue = (value) => {
  const num = parseFloat(value);
  return Number.isNaN(num) ? null : num;
};

const sortDiameterValues = (values) =>
  [...values].sort((a, b) => {
    const strA = a.toString();
    const strB = b.toString();
    const numA = parseFloat(strA) || 0;
    const numB = parseFloat(strB) || 0;

    if (numA !== numB) {
      return numA - numB;
    }

    return strA.localeCompare(strB);
  });

const sortNumericValues = (values) => [...values].sort((a, b) => a - b);

const sortDiscDiameterValues = (values) =>
  [...values].sort((a, b) => {
    const strA = a.toString();
    const strB = b.toString();
    const numA = parseFloat(strA.replace(/[^\d.]/g, '')) || 0;
    const numB = parseFloat(strB.replace(/[^\d.]/g, '')) || 0;

    if (numA !== numB) {
      return numA - numB;
    }

    return strA.localeCompare(strB);
  });

const sortDiscNumericValues = (values) =>
  [...values].sort((a, b) => {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numA - numB;
  });

const addUniqueValue = (set, value) => {
  if (value != null) {
    set.add(value);
  }
};

export const collectTireFacetOptions = (items, filters = {}) => {
  const widths = new Set();
  const profiles = new Set();
  const diameters = new Set();
  const seasons = new Set();
  const brands = new Set();
  const suppliers = new Set();

  items.forEach((item) => {
    if (filters.season && item.season !== filters.season) return;

    const matchWidth = matchesTireNumericField(item.width, filters.width);
    const matchProfile = matchesTireNumericField(
      item.profile,
      filters.profile
    );
    const matchDiameter = matchesTireDiameter(
      item.diameter,
      filters.diameter
    );

    if (matchProfile && matchDiameter) {
      addUniqueValue(widths, normalizeNumericFieldValue(item.width));
    }
    if (matchWidth && matchDiameter) {
      addUniqueValue(profiles, normalizeNumericFieldValue(item.profile));
    }
    if (matchWidth && matchProfile) {
      addUniqueValue(diameters, item.diameter);
    }

    if (matchWidth && matchProfile && matchDiameter) {
      addUniqueValue(seasons, item.season);
      addUniqueValue(brands, item.brand);
      addUniqueValue(suppliers, item.supplier);
    }
  });

  return {
    widths: sortNumericValues(widths),
    profiles: sortNumericValues(profiles),
    diameters: sortDiameterValues(diameters),
    seasons: Array.from(seasons).sort(),
    brands: Array.from(brands).sort(),
    suppliers: Array.from(suppliers).sort(),
  };
};

export const collectDiscFacetOptions = (items, filters = {}) => {
  const brands = new Set();
  const suppliers = new Set();
  const diameters = new Set();
  const widths = new Set();
  const cbValues = new Set();
  const etValues = new Set();
  const pcdValues = new Set();
  const pnValues = new Set();
  const diskTypes = new Set();

  items.forEach((item) => {
    const matchSupplier = matchesDiscStringField(
      item.supplier,
      filters.supplier
    );
    const matchDiameter = matchesTireDiameter(
      item.diameter,
      filters.diameter
    );
    const matchPcd = matchesTireNumericField(item.pcd, filters.pcd);
    const matchPn = matchesTireNumericField(item.pn, filters.pn);
    const matchDiskType = matchesDiscStringField(
      item.diskType,
      filters.diskType
    );
    const matchWidth = matchesDiscRange(
      item.width,
      filters.widthFrom,
      filters.widthTo
    );
    const matchCb = matchesDiscRange(
      item.cb,
      filters.cbFrom,
      filters.cbTo
    );
    const matchEt = matchesDiscRange(
      item.et,
      filters.etFrom,
      filters.etTo
    );

    if (
      matchSupplier &&
      matchPcd &&
      matchPn &&
      matchDiskType &&
      matchWidth &&
      matchCb &&
      matchEt
    ) {
      addUniqueValue(diameters, item.diameter);
    }
    if (
      matchSupplier &&
      matchDiameter &&
      matchPcd &&
      matchDiskType &&
      matchWidth &&
      matchCb &&
      matchEt
    ) {
      addUniqueValue(pnValues, normalizeNumericFieldValue(item.pn));
    }
    if (
      matchSupplier &&
      matchDiameter &&
      matchPn &&
      matchDiskType &&
      matchWidth &&
      matchCb &&
      matchEt
    ) {
      addUniqueValue(pcdValues, normalizeNumericFieldValue(item.pcd));
    }
    if (
      matchSupplier &&
      matchDiameter &&
      matchPcd &&
      matchPn &&
      matchDiskType &&
      matchCb &&
      matchEt
    ) {
      addUniqueValue(widths, normalizeNumericFieldValue(item.width));
    }
    if (
      matchSupplier &&
      matchDiameter &&
      matchPcd &&
      matchPn &&
      matchDiskType &&
      matchWidth &&
      matchEt
    ) {
      addUniqueValue(cbValues, normalizeNumericFieldValue(item.cb));
    }
    if (
      matchSupplier &&
      matchDiameter &&
      matchPcd &&
      matchPn &&
      matchDiskType &&
      matchWidth &&
      matchCb
    ) {
      addUniqueValue(etValues, normalizeNumericFieldValue(item.et));
    }

    if (
      matchSupplier &&
      matchDiameter &&
      matchPcd &&
      matchPn &&
      matchDiskType &&
      matchWidth &&
      matchCb &&
      matchEt
    ) {
      addUniqueValue(brands, item.brand);
      addUniqueValue(suppliers, item.supplier);
      addUniqueValue(diskTypes, item.diskType);
    }
  });

  return {
    brands: Array.from(brands).sort(),
    suppliers: Array.from(suppliers).sort(),
    diameters: sortDiscDiameterValues(diameters),
    widths: sortDiscNumericValues(widths),
    cb: sortDiscNumericValues(cbValues),
    et: sortDiscNumericValues(etValues),
    pcd: sortDiscNumericValues(pcdValues),
    pn: sortDiscNumericValues(pnValues),
    diskTypes: Array.from(diskTypes).sort(),
  };
};
