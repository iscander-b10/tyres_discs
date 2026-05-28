import shinservice from './shinservice';
import semisotnov from './semisotnov';
import fourtochki from './4tochki';
import shinasu from './ShinaSu';
import vershina from './Vershina';

const suppliers = {
  [shinservice.key]: shinservice,
  [semisotnov.key]: semisotnov,
  [fourtochki.key]: fourtochki,
  [shinasu.key]: shinasu,
  [vershina.key]: vershina,
};

export const getSupplier = (key) => suppliers[key];

export const getSuppliers = () => Object.values(suppliers);

export const loadSupplierData = async (supplierKey) => {
  const supplier = suppliers[supplierKey];

  if (!supplier) {
    throw new Error(`Поставщик ${supplierKey} не найден`);
  }

  const [rawTyres, rawDiscs] = await Promise.all([
    supplier.fetchTyres ? supplier.fetchTyres() : Promise.resolve(null),
    supplier.fetchDiscs ? supplier.fetchDiscs() : Promise.resolve(null),
  ]);

  // Выводим сырые данные в консоль для отладки
  if (rawTyres) {
    console.log(`📦 Сырые данные шин от ${supplier.label}:`, rawTyres);
  }
  if (rawDiscs) {
    console.log(`📦 Сырые данные дисков от ${supplier.label}:`, rawDiscs);
  }

  const tyres = supplier.transformTyres && rawTyres ? supplier.transformTyres(rawTyres) : [];
  // Некоторые поставщики (например Форточки) отдают шины и диски одним JSON:
  // { tires: [...], rims: [...] }. В таком случае rawDiscs будет null.
  const rawDiscsFallback =
    !rawDiscs && rawTyres && Array.isArray(rawTyres.rims) ? rawTyres : rawDiscs;
  const discs = supplier.transformDiscs && rawDiscsFallback ? supplier.transformDiscs(rawDiscsFallback) : [];

  return {
    key: supplier.key,
    label: supplier.label,
    tyres,
    discs,
  };
};

