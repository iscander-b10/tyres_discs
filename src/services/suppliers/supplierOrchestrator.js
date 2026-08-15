import shinservice from './shinservice';
import semisotnov from './semisotnov';
import fourtochki from './4tochki';
import shinasu from './ShinaSu';
import vershina from './Vershina';
import { usesCorsProxy } from '../../utils/fetchSupplier';

const suppliers = {
  [shinservice.key]: shinservice,
  [semisotnov.key]: semisotnov,
  [fourtochki.key]: fourtochki,
  [shinasu.key]: shinasu,
  [vershina.key]: vershina,
};

/** Порядок загрузки (в production через CORS-прокси — по очереди). */
const SUPPLIER_LOAD_ORDER = [
  shinservice.key,
  semisotnov.key,
  fourtochki.key,
  shinasu.key,
  vershina.key,
];

export const PART_TYRES = 'tyres';
export const PART_DISCS = 'discs';

function partRuLabel(part) {
  if (part === PART_TYRES) return 'шины';
  if (part === PART_DISCS) return 'диски';
  return null;
}

function supplierError(supplier, part, err) {
  const partLabel = partRuLabel(part);
  const detail = err?.message || String(err);
  const error = new Error(`${supplier.label}${partLabel ? ` (${partLabel})` : ''}: ${detail}`, {
    cause: err,
  });
  error.supplierLabel = supplier.label;
  error.failedParts = part ? [part] : [PART_TYRES, PART_DISCS];
  return error;
}

function bothPartsError(supplier, tyresErr, discsErr) {
  const tyresMsg = supplierError(supplier, PART_TYRES, tyresErr).message;
  const discsMsg = supplierError(supplier, PART_DISCS, discsErr).message;
  const error = new Error(`${tyresMsg}; ${discsMsg}`);
  error.supplierLabel = supplier.label;
  error.failedParts = [PART_TYRES, PART_DISCS];
  return error;
}

async function fetchTyresAndDiscs(supplier) {
  const sequential = usesCorsProxy();

  if (sequential) {
    let rawTyres = null;
    let rawDiscs = null;

    if (supplier.fetchTyres) {
      try {
        rawTyres = await supplier.fetchTyres();
      } catch (err) {
        throw supplierError(supplier, PART_TYRES, err);
      }
    }

    if (supplier.fetchDiscs) {
      try {
        rawDiscs = await supplier.fetchDiscs();
      } catch (err) {
        throw supplierError(supplier, PART_DISCS, err);
      }
    }

    return { rawTyres, rawDiscs, failedParts: [] };
  }

  const [tyresResult, discsResult] = await Promise.allSettled([
    supplier.fetchTyres ? supplier.fetchTyres() : Promise.resolve(null),
    supplier.fetchDiscs ? supplier.fetchDiscs() : Promise.resolve(null),
  ]);

  const failedParts = [];
  if (tyresResult.status === 'rejected') {
    failedParts.push(PART_TYRES);
  }
  if (discsResult.status === 'rejected') {
    failedParts.push(PART_DISCS);
  }

  if (failedParts.length === 2) {
    throw bothPartsError(supplier, tyresResult.reason, discsResult.reason);
  }

  if (failedParts.length === 1) {
    const part = failedParts[0];
    const reason = part === PART_TYRES ? tyresResult.reason : discsResult.reason;
    console.warn(`Частичная загрузка ${supplier.label}:`, supplierError(supplier, part, reason).message);
  }

  return {
    rawTyres: tyresResult.status === 'fulfilled' ? tyresResult.value : null,
    rawDiscs: discsResult.status === 'fulfilled' ? discsResult.value : null,
    failedParts,
  };
}

export const getSupplierLabel = (supplierKey) => suppliers[supplierKey]?.label || supplierKey;

export const loadSupplierData = async (supplierKey) => {
  const supplier = suppliers[supplierKey];

  if (!supplier) {
    throw new Error(`Поставщик ${supplierKey} не найден`);
  }

  try {
    const { rawTyres, rawDiscs, failedParts } = await fetchTyresAndDiscs(supplier);

    const tyres = supplier.transformTyres && rawTyres ? supplier.transformTyres(rawTyres) : [];
    // Общий raw: объект с .rims (Форточки) или плоский массив строк (ШинаСу)
    const rawDiscsFallback =
      rawDiscs ??
      (rawTyres && (Array.isArray(rawTyres.rims) || Array.isArray(rawTyres)) ? rawTyres : null);
    const discs =
      supplier.transformDiscs && rawDiscsFallback ? supplier.transformDiscs(rawDiscsFallback) : [];

    return {
      key: supplier.key,
      label: supplier.label,
      tyres,
      discs,
      failedParts: failedParts || [],
    };
  } catch (err) {
    if (err.supplierLabel) {
      throw err;
    }
    if (err.message?.startsWith(supplier.label)) {
      err.supplierLabel = supplier.label;
      if (!err.failedParts) {
        err.failedParts = [PART_TYRES, PART_DISCS];
      }
      throw err;
    }
    throw supplierError(supplier, null, err);
  }
};

/**
 * @returns {Promise<Array<{ key: string, status: 'fulfilled'|'rejected', value?: object, reason?: Error }>>}
 */
export const loadAllSuppliersData = async () => {
  const sequential = usesCorsProxy();

  if (sequential) {
    const results = [];
    for (const key of SUPPLIER_LOAD_ORDER) {
      try {
        const value = await loadSupplierData(key);
        results.push({ key, status: 'fulfilled', value });
      } catch (reason) {
        console.error(`Ошибка при загрузке (${key}):`, reason);
        results.push({ key, status: 'rejected', reason });
      }
    }
    return results;
  }

  const settled = await Promise.allSettled(
    SUPPLIER_LOAD_ORDER.map((key) => loadSupplierData(key))
  );
  return SUPPLIER_LOAD_ORDER.map((key, index) => ({
    key,
    status: settled[index].status,
    value: settled[index].status === 'fulfilled' ? settled[index].value : undefined,
    reason: settled[index].status === 'rejected' ? settled[index].reason : undefined,
  }));
};
