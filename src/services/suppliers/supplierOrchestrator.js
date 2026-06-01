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

export const getSupplier = (key) => suppliers[key];

export const getSuppliers = () => Object.values(suppliers);

function supplierError(supplier, part, err) {
  const detail = err?.message || String(err);
  return new Error(`${supplier.label}${part ? ` (${part})` : ''}: ${detail}`, { cause: err });
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
        throw supplierError(supplier, 'шины', err);
      }
    }

    if (supplier.fetchDiscs) {
      try {
        rawDiscs = await supplier.fetchDiscs();
      } catch (err) {
        throw supplierError(supplier, 'диски', err);
      }
    }

    return { rawTyres, rawDiscs };
  }

  const [tyresResult, discsResult] = await Promise.allSettled([
    supplier.fetchTyres ? supplier.fetchTyres() : Promise.resolve(null),
    supplier.fetchDiscs ? supplier.fetchDiscs() : Promise.resolve(null),
  ]);

  const errors = [];
  if (tyresResult.status === 'rejected') {
    errors.push(supplierError(supplier, 'шины', tyresResult.reason).message);
  }
  if (discsResult.status === 'rejected') {
    errors.push(supplierError(supplier, 'диски', discsResult.reason).message);
  }
  if (errors.length === 2) {
    throw new Error(errors.join('; '));
  }
  if (errors.length === 1) {
    console.warn(`Частичная загрузка ${supplier.label}: ${errors[0]}`);
  }

  return {
    rawTyres: tyresResult.status === 'fulfilled' ? tyresResult.value : null,
    rawDiscs: discsResult.status === 'fulfilled' ? discsResult.value : null,
  };
}

export const loadSupplierData = async (supplierKey) => {
  const supplier = suppliers[supplierKey];

  if (!supplier) {
    throw new Error(`Поставщик ${supplierKey} не найден`);
  }

  try {
    const { rawTyres, rawDiscs } = await fetchTyresAndDiscs(supplier);

    if (rawTyres) {
      console.log(`📦 Сырые данные шин от ${supplier.label}:`, rawTyres);
    }
    if (rawDiscs) {
      console.log(`📦 Сырые данные дисков от ${supplier.label}:`, rawDiscs);
    }

    const tyres = supplier.transformTyres && rawTyres ? supplier.transformTyres(rawTyres) : [];
    const rawDiscsFallback =
      !rawDiscs && rawTyres && Array.isArray(rawTyres.rims) ? rawTyres : rawDiscs;
    const discs =
      supplier.transformDiscs && rawDiscsFallback ? supplier.transformDiscs(rawDiscsFallback) : [];

    return {
      key: supplier.key,
      label: supplier.label,
      tyres,
      discs,
    };
  } catch (err) {
    if (err.message?.startsWith(supplier.label)) {
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
