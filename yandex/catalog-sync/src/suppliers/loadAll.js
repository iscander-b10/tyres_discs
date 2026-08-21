import { envUrl, fetchExcelRows, fetchJson, fetchXmlJson } from './fetch.js';
import {
  transformFourtochkiDiscs,
  transformFourtochkiTyres,
  transformSemisotnovDiscs,
  transformSemisotnovTyres,
  transformShinasuDiscs,
  transformShinasuTyres,
  transformShinserviceDiscs,
  transformShinserviceTyres,
  transformVershinaDiscs,
  transformVershinaTyres,
} from './transforms.js';

/** Порядок как у фронтового supplierOrchestrator. */
export const SUPPLIER_LOAD_ORDER = [
  'shinservice',
  'semisotnov',
  'fourtochki',
  'shinasu',
  'vershina',
];

const suppliers = {
  shinservice: {
    key: 'shinservice',
    label: 'Шинсервис',
    async fetchRaw() {
      const tyresUrl = envUrl('SHINSERVICE_TYRES_URL', 'REACT_APP_SHINSERVICE_TYRES_URL');
      const discsUrl = envUrl('SHINSERVICE_DISCS_URL', 'REACT_APP_SHINSERVICE_DISCS_URL');
      if (!tyresUrl) throw new Error('SHINSERVICE_TYRES_URL не задан');
      if (!discsUrl) throw new Error('SHINSERVICE_DISCS_URL не задан');
      const rawTyres = await fetchJson(tyresUrl);
      const rawDiscs = await fetchJson(discsUrl);
      return { rawTyres, rawDiscs };
    },
    transform(rawTyres, rawDiscs) {
      return {
        tyres: transformShinserviceTyres(rawTyres),
        discs: transformShinserviceDiscs(rawDiscs),
      };
    },
  },
  semisotnov: {
    key: 'semisotnov',
    label: 'Семисотнов',
    async fetchRaw() {
      const tyresUrl = envUrl('SEMISOTNOV_TYRES_URL', 'REACT_APP_SEMISOTNOV_TYRES_URL');
      const discsUrl = envUrl('SEMISOTNOV_DISCS_URL', 'REACT_APP_SEMISOTNOV_DISCS_URL');
      if (!tyresUrl) throw new Error('SEMISOTNOV_TYRES_URL не задан');
      if (!discsUrl) throw new Error('SEMISOTNOV_DISCS_URL не задан');
      const rawTyres = await fetchXmlJson(tyresUrl);
      const rawDiscs = await fetchXmlJson(discsUrl);
      return { rawTyres, rawDiscs };
    },
    transform(rawTyres, rawDiscs) {
      return {
        tyres: transformSemisotnovTyres(rawTyres),
        discs: transformSemisotnovDiscs(rawDiscs),
      };
    },
  },
  fourtochki: {
    key: 'fourtochki',
    label: 'Форточки',
    async fetchRaw() {
      const url = envUrl('FOURTOCHKI_TYRES_URL', 'REACT_APP_4TOCHKI_TYRES_URL');
      if (!url) throw new Error('FOURTOCHKI_TYRES_URL не задан');
      const raw = await fetchJson(url);
      return { rawTyres: raw, rawDiscs: null };
    },
    transform(rawTyres) {
      return {
        tyres: transformFourtochkiTyres(rawTyres),
        discs: transformFourtochkiDiscs(rawTyres),
      };
    },
  },
  shinasu: {
    key: 'shinasu',
    label: 'ШинаСу',
    async fetchRaw() {
      const url = envUrl('SHINASU_URL', 'REACT_APP_SHINASU_URL');
      if (!url) throw new Error('SHINASU_URL не задан');
      const rows = await fetchExcelRows(url);
      return { rawTyres: rows, rawDiscs: null };
    },
    transform(rawTyres) {
      return {
        tyres: transformShinasuTyres(rawTyres),
        discs: transformShinasuDiscs(rawTyres),
      };
    },
  },
  vershina: {
    key: 'vershina',
    label: 'Вершина',
    async fetchRaw() {
      const tyresUrl = envUrl('VERSHINA_TYRES_URL', 'REACT_APP_VERSHINA_TYRES_URL');
      const discsUrl = envUrl('VERSHINA_DISCS_URL', 'REACT_APP_VERSHINA_DISCS_URL');
      if (!tyresUrl) throw new Error('VERSHINA_TYRES_URL не задан');
      if (!discsUrl) throw new Error('VERSHINA_DISCS_URL не задан');
      const rawTyres = await fetchXmlJson(tyresUrl);
      const rawDiscs = await fetchXmlJson(discsUrl);
      return { rawTyres, rawDiscs };
    },
    transform(rawTyres, rawDiscs) {
      return {
        tyres: transformVershinaTyres(rawTyres),
        discs: transformVershinaDiscs(rawDiscs),
      };
    },
  },
};

/**
 * Загрузка одного поставщика (последовательно, как prod через CORS).
 * @returns {Promise<{ key: string, label: string, tyres: object[], discs: object[] }>}
 */
export async function loadSupplierData(key) {
  const supplier = suppliers[key];
  if (!supplier) throw new Error(`Неизвестный поставщик: ${key}`);

  const { rawTyres, rawDiscs } = await supplier.fetchRaw();
  const { tyres, discs } = supplier.transform(rawTyres, rawDiscs);
  return {
    key: supplier.key,
    label: supplier.label,
    tyres: Array.isArray(tyres) ? tyres : [],
    discs: Array.isArray(discs) ? discs : [],
  };
}

/**
 * @returns {Promise<Array<{ key: string, status: 'fulfilled'|'rejected', value?: object, reason?: Error }>>}
 */
export async function loadAllSuppliersData() {
  const results = [];
  for (const key of SUPPLIER_LOAD_ORDER) {
    try {
      const value = await loadSupplierData(key);
      results.push({ key, status: 'fulfilled', value });
    } catch (reason) {
      console.error(`catalog-sync supplier fail ${key}:`, reason?.message || reason);
      results.push({ key, status: 'rejected', reason });
    }
  }
  return results;
}

export function getSupplierLabel(key) {
  return suppliers[key]?.label || key;
}
