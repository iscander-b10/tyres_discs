/**
 * Чистая runtime-валидация и нормализация каталожного snapshot.
 * Не открывает IndexedDB и не мутирует исходный объект.
 */

import { canBeStoredInIndexedDB } from '../catalogIdb/catalogItemValidation';

export { canBeStoredInIndexedDB };

export const SUPPORTED_WIRE_SCHEMA_VERSION = 1;
export const VALIDATION_PROBLEM_LIMIT = 100;

const CATEGORY_CONFIG = {
  tyres: { entityName: 'шины', category: 'tyres' },
  discs: { entityName: 'диски', category: 'discs' },
};

const DISK_TYPES = new Set(['Литой', 'Штампованный']);
const SEASONS = new Set(['s', 'w']);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

export const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Строгое число: вся строка должна быть числом.
 * Допускает number, numeric string, десятичную запятую и пробелы.
 */
export function normalizeNumber(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)$/.test(trimmed)) return null;
  const normalized = trimmed.replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function normalizeNullableNumber(value, { allowZero = true } = {}) {
  if (value == null || value === '') return null;
  const num = normalizeNumber(value);
  if (num == null) return null;
  if (!allowZero && num === 0) return null;
  return num;
}

const trimToNull = (value) => {
  if (value == null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const buildTitleFallback = ({ brand, model, sizeTitle, code }) => {
  const brandText = brand || '';
  const modelText = model || '';
  if (brandText && modelText) return `${brandText} ${modelText}`.trim();
  if (brandText && sizeTitle) return `${brandText} ${sizeTitle}`.trim();
  if (sizeTitle) return sizeTitle;
  return String(code);
};

const createProblemCollector = () => {
  const warnings = [];
  const errors = [];
  let warningCount = 0;
  let errorCount = 0;
  let truncated = false;

  const detailCount = () => warnings.length + errors.length;

  const push = (severity, problem) => {
    if (severity === 'fatal') {
      errorCount += 1;
    } else {
      warningCount += 1;
    }

    if (detailCount() >= VALIDATION_PROBLEM_LIMIT) {
      truncated = true;
      return;
    }

    if (severity === 'fatal') {
      errors.push(problem);
    } else {
      warnings.push(problem);
    }
  };

  return {
    addWarning(code, path, message, extra = {}) {
      push('warning', {
        severity: 'warning',
        code,
        path,
        message,
        ...extra,
      });
    },
    addFatal(code, path, message, extra = {}) {
      push('fatal', {
        severity: 'fatal',
        code,
        path,
        message,
        ...extra,
      });
    },
    get warningCount() {
      return warningCount;
    },
    get errorCount() {
      return errorCount;
    },
    get truncated() {
      return truncated;
    },
    get warnings() {
      return warnings;
    },
    get errors() {
      return errors;
    },
    get hasFatal() {
      return errorCount > 0;
    },
  };
};

export function createValidationReport({
  schemaVersion,
  snapshotVersion,
  supplierCount,
  itemCount,
  normalizedCount,
  collector,
}) {
  return {
    valid: !collector.hasFatal,
    schemaVersion: schemaVersion ?? null,
    snapshotVersion: snapshotVersion ?? null,
    supplierCount,
    itemCount: {
      tyres: itemCount.tyres || 0,
      discs: itemCount.discs || 0,
    },
    normalizedCount,
    warningCount: collector.warningCount,
    errorCount: collector.errorCount,
    warnings: collector.warnings,
    errors: collector.errors,
    truncated: collector.truncated,
  };
}

export function validateSnapshotEnvelope(snapshot, collector) {
  if (!isRecord(snapshot)) {
    collector.addFatal(
      'INVALID_SNAPSHOT',
      '',
      'snapshot должен быть обычным объектом',
      { received: snapshot }
    );
    return null;
  }

  let schemaVersion = null;
  if (!hasOwn(snapshot, 'schemaVersion') || snapshot.schemaVersion == null) {
    collector.addWarning(
      'MISSING_SCHEMA_VERSION',
      'schemaVersion',
      'schemaVersion отсутствует; snapshot принят как legacy',
      { received: snapshot.schemaVersion, normalizedTo: null }
    );
  } else if (snapshot.schemaVersion === SUPPORTED_WIRE_SCHEMA_VERSION) {
    schemaVersion = SUPPORTED_WIRE_SCHEMA_VERSION;
  } else {
    collector.addFatal(
      'UNSUPPORTED_SCHEMA_VERSION',
      'schemaVersion',
      `неподдерживаемая schemaVersion: ${String(snapshot.schemaVersion)}`,
      { received: snapshot.schemaVersion }
    );
  }

  if (typeof snapshot.version !== 'string' || !snapshot.version.trim()) {
    collector.addFatal(
      'INVALID_VERSION',
      'version',
      'непустая строка version обязательна',
      { received: snapshot.version }
    );
  }

  if (!isRecord(snapshot.suppliers)) {
    collector.addFatal(
      'INVALID_SUPPLIERS',
      'suppliers',
      'объект поставщиков обязателен',
      { received: snapshot.suppliers }
    );
    return { schemaVersion, snapshotVersion: snapshot.version ?? null };
  }

  const supplierEntries = Object.entries(snapshot.suppliers);
  if (supplierEntries.length === 0) {
    collector.addFatal(
      'EMPTY_SUPPLIERS',
      'suppliers',
      'должен содержать хотя бы одного поставщика'
    );
  }

  return {
    schemaVersion,
    snapshotVersion:
      typeof snapshot.version === 'string' ? snapshot.version : null,
    supplierEntries,
  };
}

const normalizeIdentityId = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const normalizeIdentityCode = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

export function normalizeCommonCatalogItem(item, path, sectionSupplier, collector) {
  if (!isRecord(item)) {
    collector.addFatal('INVALID_ITEM', path, 'товар должен быть обычным объектом', {
      received: item,
    });
    return null;
  }

  if (!canBeStoredInIndexedDB(item)) {
    collector.addFatal(
      'NOT_CLONEABLE',
      path,
      'товар нельзя сохранить через structured clone'
    );
    return null;
  }

  const id = normalizeIdentityId(item.id);
  if (id == null) {
    collector.addFatal('MISSING_ID', `${path}.id`, 'id обязателен', {
      received: item.id,
    });
    return null;
  }

  const code = normalizeIdentityCode(item.code);
  if (code == null) {
    collector.addFatal('MISSING_CODE', `${path}.code`, 'code обязателен', {
      received: item.code,
    });
    return null;
  }

  const supplierRaw = trimToNull(item.supplier);
  if (!supplierRaw) {
    collector.addFatal(
      'MISSING_SUPPLIER',
      `${path}.supplier`,
      'supplier обязателен',
      { received: item.supplier }
    );
    return null;
  }

  if (supplierRaw !== sectionSupplier) {
    collector.addFatal(
      'SUPPLIER_MISMATCH',
      `${path}.supplier`,
      'supplier товара не совпадает с секцией поставщика',
      { received: item.supplier, normalizedTo: sectionSupplier }
    );
    return null;
  }

  const brand = trimToNull(item.brand);
  const model = trimToNull(item.model);
  const sizeTitle = trimToNull(item.sizeTitle);
  const photoUrl = trimToNull(item.photoUrl);
  const titleRaw = trimToNull(item.title);
  const title =
    titleRaw ||
    buildTitleFallback({ brand, model, sizeTitle, code });

  const amountResult = normalizeAmount(item.amount, `${path}.amount`, collector);
  const price = normalizePrice(item.price, `${path}.price`, collector);
  const sellingPrice = normalizePrice(
    item.sellingPrice,
    `${path}.sellingPrice`,
    collector
  );
  const websitePrice = normalizePrice(
    item.websitePrice,
    `${path}.websitePrice`,
    collector
  );

  const base = { ...item };
  return {
    ...base,
    id,
    code,
    supplier: supplierRaw,
    brand,
    model,
    title,
    sizeTitle,
    photoUrl,
    amount: amountResult,
    price,
    sellingPrice,
    websitePrice,
  };
}

function normalizeAmount(value, path, collector) {
  if (value == null || value === '') {
    collector.addWarning('INVALID_AMOUNT', path, 'amount отсутствует', {
      received: value,
      normalizedTo: 0,
    });
    return 0;
  }

  const num = normalizeNumber(value);
  if (num == null) {
    collector.addWarning('INVALID_AMOUNT', path, 'amount не является числом', {
      received: value,
      normalizedTo: 0,
    });
    return 0;
  }

  if (num < 0) {
    collector.addWarning('INVALID_AMOUNT', path, 'отрицательный amount', {
      received: value,
      normalizedTo: 0,
    });
    return 0;
  }

  const floored = Math.floor(num);
  if (floored !== num) {
    collector.addWarning('AMOUNT_ROUNDED', path, 'дробный amount округлён вниз', {
      received: value,
      normalizedTo: floored,
    });
  }
  return floored;
}

function normalizePrice(value, path, collector) {
  if (value == null || value === '') return null;
  const num = normalizeNumber(value);
  if (num == null || num <= 0) {
    collector.addWarning('INVALID_PRICE', path, 'некорректная цена', {
      received: value,
      normalizedTo: null,
    });
    return null;
  }
  return num;
}

const normalizeOptionalBoolean = (value, path, field, collector) => {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  collector.addWarning(
    `INVALID_${field.toUpperCase()}`,
    path,
    `${field} должен быть boolean или null`,
    { received: value, normalizedTo: null }
  );
  return null;
};

export function normalizeTire(item, path, collector) {
  const width = normalizeOptionalNumericField(
    item.width,
    `${path}.width`,
    'width',
    collector
  );
  let profile = normalizeOptionalNumericField(
    item.profile,
    `${path}.profile`,
    'profile',
    collector
  );
  if (profile === 0) profile = null;

  const diameter = normalizeDiameter(
    item.diameter,
    `${path}.diameter`,
    collector
  );

  let season = null;
  if (item.season != null && item.season !== '') {
    if (SEASONS.has(item.season)) {
      season = item.season;
    } else {
      collector.addWarning('INVALID_SEASON', `${path}.season`, 'неизвестный сезон', {
        received: item.season,
        normalizedTo: null,
      });
    }
  }

  const spikes = normalizeOptionalBoolean(
    item.spikes,
    `${path}.spikes`,
    'spikes',
    collector
  );
  const runflat = normalizeOptionalBoolean(
    item.runflat,
    `${path}.runflat`,
    'runflat',
    collector
  );

  return {
    ...item,
    width,
    profile,
    diameter,
    season,
    spikes,
    runflat,
  };
}

function normalizeOptionalNumericField(value, path, field, collector) {
  if (value == null || value === '') return null;
  const num = normalizeNumber(value);
  if (num == null) {
    collector.addWarning(
      `INVALID_${field.toUpperCase()}`,
      path,
      `${field} не распознан как число`,
      { received: value, normalizedTo: null }
    );
    return null;
  }
  return num;
}

/**
 * Консервативная нормализация diameter:
 * trim, r/c → верхний регистр; целые и дробные (R17.5, R22.5);
 * неоднозначное значение → null + warning (товар не отбрасывается).
 */
export function normalizeDiameter(value, path, collector) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `R${value}`;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    collector.addWarning('INVALID_DIAMETER', path, 'diameter не распознан', {
      received: value,
      normalizedTo: null,
    });
    return null;
  }

  const trimmed = String(value).trim().replace(',', '.');
  if (!trimmed) return null;

  // R16, R13C, R17.5, R22.5, 16, 17.5, 13C
  const match = trimmed.match(/^([Rr])?\s*(\d{1,3}(?:\.\d+)?)\s*([Cc])?$/);
  if (match) {
    const cargo = match[3] ? 'C' : '';
    return `R${match[2]}${cargo}`;
  }

  const upperized = trimmed.replace(/[rc]/gi, (ch) => ch.toUpperCase());
  if (/^R\d{1,3}(?:\.\d+)?C?$/i.test(upperized)) {
    return upperized.replace(/^r/i, 'R').replace(/c$/i, 'C');
  }

  collector.addWarning(
    'INVALID_DIAMETER',
    path,
    'diameter неоднозначен; сохранён sizeTitle',
    { received: value, normalizedTo: null }
  );
  return null;
}

export function normalizeDisc(item, path, collector) {
  const width = normalizeOptionalNumericField(
    item.width,
    `${path}.width`,
    'width',
    collector
  );
  const diameter = normalizeDiameter(
    item.diameter,
    `${path}.diameter`,
    collector
  );
  const pn = normalizeOptionalNumericField(item.pn, `${path}.pn`, 'pn', collector);
  const pcd = normalizeOptionalNumericField(
    item.pcd,
    `${path}.pcd`,
    'pcd',
    collector
  );
  const et = normalizeOptionalNumericField(item.et, `${path}.et`, 'et', collector);
  const cb = normalizeOptionalNumericField(item.cb, `${path}.cb`, 'cb', collector);
  const color = trimToNull(item.color);

  let diskType = null;
  if (item.diskType != null && item.diskType !== '') {
    if (DISK_TYPES.has(item.diskType)) {
      diskType = item.diskType;
    } else {
      collector.addWarning(
        'INVALID_DISK_TYPE',
        `${path}.diskType`,
        'неизвестный diskType',
        { received: item.diskType, normalizedTo: null }
      );
    }
  }

  return {
    ...item,
    width,
    diameter,
    pn,
    pcd,
    et,
    cb,
    diskType,
    color,
  };
}

export function normalizeSupplierEntry(entry, entryPath, collector) {
  if (!isRecord(entry)) {
    collector.addFatal(
      'INVALID_SUPPLIER_ENTRY',
      entryPath,
      'описание поставщика должно быть объектом',
      { received: entry }
    );
    return null;
  }

  let supplier = null;
  if (typeof entry.supplier === 'string' && entry.supplier.trim()) {
    supplier = entry.supplier.trim();
  } else if (typeof entry.label === 'string' && entry.label.trim()) {
    supplier = entry.label.trim();
  } else {
    collector.addFatal(
      'MISSING_SUPPLIER',
      `${entryPath}.supplier`,
      'непустая строка supplier или legacy label обязательна',
      { received: entry.supplier ?? entry.label }
    );
    return null;
  }

  return { supplier, entry };
}

export function normalizeCategoryCommand(
  command,
  path,
  supplier,
  category,
  collector
) {
  if (Array.isArray(command)) {
    if (command.length === 0) {
      collector.addFatal(
        'AMBIGUOUS_LEGACY_ARRAY',
        path,
        'пустой legacy-массив неоднозначен; используйте явную команду'
      );
      return null;
    }
    return {
      action: 'replace',
      status: 'ok',
      items: command,
      path,
      supplier,
      category,
    };
  }

  if (!isRecord(command)) {
    collector.addFatal(
      'INVALID_COMMAND',
      path,
      'команда обязательна и не может быть null',
      { received: command }
    );
    return null;
  }

  const { action, status } = command;
  const hasItems = hasOwn(command, 'items');

  if (action === 'replace') {
    if (status !== 'ok') {
      collector.addFatal(
        'INVALID_STATUS',
        path,
        'replace допускает только status "ok"',
        { received: status }
      );
      return null;
    }
    if (!hasItems || !Array.isArray(command.items)) {
      collector.addFatal(
        'INVALID_ITEMS',
        `${path}.items`,
        'replace требует массив items',
        { received: command.items }
      );
      return null;
    }
    return {
      action,
      status,
      items: command.items,
      path,
      supplier,
      category,
    };
  }

  if (action === 'keepPrevious') {
    if (!['failed', 'keptPrevious'].includes(status)) {
      collector.addFatal(
        'INVALID_STATUS',
        path,
        'keepPrevious допускает status "failed" или "keptPrevious"',
        { received: status }
      );
      return null;
    }
    if (hasItems) {
      collector.addFatal(
        'UNEXPECTED_ITEMS',
        `${path}.items`,
        'keepPrevious не допускает поле items'
      );
      return null;
    }
    return { action, status, path, supplier, category };
  }

  if (action === 'purge') {
    if (status !== 'ok') {
      collector.addFatal(
        'INVALID_STATUS',
        path,
        'purge допускает только status "ok"',
        { received: status }
      );
      return null;
    }
    if (hasItems) {
      collector.addFatal(
        'UNEXPECTED_ITEMS',
        `${path}.items`,
        'purge не допускает поле items'
      );
      return null;
    }
    return { action, status, path, supplier, category };
  }

  collector.addFatal(
    'UNKNOWN_ACTION',
    path,
    `неизвестный action "${String(action)}"`,
    { received: action }
  );
  return null;
}

function normalizeCatalogItem(item, path, supplier, category, collector) {
  const common = normalizeCommonCatalogItem(item, path, supplier, collector);
  if (!common) return null;

  if (category === 'tyres') {
    return normalizeTire(common, path, collector);
  }
  return normalizeDisc(common, path, collector);
}

export function findDuplicateIds(idIndex, id, path, collector) {
  const key = String(id);
  if (hasOwn(idIndex, key)) {
    collector.addFatal('DUPLICATE_ID', path, 'повтор итогового id', {
      received: id,
      firstPath: idIndex[key],
    });
    return true;
  }
  idIndex[key] = path;
  return false;
}

/**
 * Валидирует и нормализует snapshot.
 * @returns {{ commands: Array, report: object }}
 */
export function validateAndNormalizeCatalogSnapshot(snapshot) {
  const collector = createProblemCollector();
  const envelope = validateSnapshotEnvelope(snapshot, collector);

  if (!envelope || collector.hasFatal) {
    const report = createValidationReport({
      schemaVersion: envelope?.schemaVersion ?? null,
      snapshotVersion: envelope?.snapshotVersion ?? null,
      supplierCount: 0,
      itemCount: { tyres: 0, discs: 0 },
      normalizedCount: 0,
      collector,
    });
    return { commands: [], report };
  }

  const { schemaVersion, snapshotVersion, supplierEntries } = envelope;
  const commands = [];
  const itemCount = { tyres: 0, discs: 0 };
  let normalizedCount = 0;
  const tyreIds = Object.create(null);
  const discIds = Object.create(null);

  for (const [supplierKey, rawEntry] of supplierEntries) {
    const entryPath = `suppliers.${supplierKey}`;
    const normalizedEntry = normalizeSupplierEntry(rawEntry, entryPath, collector);
    if (!normalizedEntry) continue;

    const { supplier, entry } = normalizedEntry;

    for (const [category] of Object.entries(CATEGORY_CONFIG)) {
      const categoryPath = `${entryPath}.${category}`;
      if (!hasOwn(entry, category)) {
        collector.addFatal(
          'MISSING_CATEGORY',
          categoryPath,
          'команда отсутствует'
        );
        continue;
      }

      const command = normalizeCategoryCommand(
        entry[category],
        categoryPath,
        supplier,
        category,
        collector
      );
      if (!command) continue;

      if (command.action !== 'replace') {
        commands.push({
          supplier,
          category,
          action: command.action,
          status: command.status,
        });
        continue;
      }

      const idIndex = category === 'tyres' ? tyreIds : discIds;
      const normalizedItems = [];

      for (let index = 0; index < command.items.length; index += 1) {
        const item = command.items[index];
        itemCount[category] += 1;
        const itemPath = `${categoryPath}.items[${index}]`;
        const normalized = normalizeCatalogItem(
          item,
          itemPath,
          supplier,
          category,
          collector
        );
        if (!normalized) continue;

        findDuplicateIds(idIndex, normalized.id, itemPath, collector);
        normalizedItems.push(normalized);
        normalizedCount += 1;
      }

      // Даже при fatal errors собираем команду с тем, что удалось нормализовать,
      // но applyCatalogSnapshot не вызовется при hasFatal.
      commands.push({
        supplier,
        category,
        action: 'replace',
        status: 'ok',
        items: normalizedItems,
      });
    }
  }

  const report = createValidationReport({
    schemaVersion,
    snapshotVersion,
    supplierCount: supplierEntries.length,
    itemCount,
    normalizedCount,
    collector,
  });

  return { commands: report.valid ? commands : [], report };
}

/**
 * Совместимый путь: либо массив команд, либо throw с validationReport.
 */
export function validateCatalogSnapshot(snapshot) {
  const { commands, report } = validateAndNormalizeCatalogSnapshot(snapshot);
  if (!report.valid) {
    const first = report.errors[0];
    const message = first
      ? `Некорректный snapshot: ${first.path || 'snapshot'} — ${first.message}`
      : 'Некорректный snapshot';
    const error = new Error(message);
    error.validationReport = report;
    throw error;
  }
  return commands;
}
