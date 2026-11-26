/**
 * Stratified reconciliation: raw (A) → transform (B) → production snapshot (C).
 */

import { envUrl, fetchExcelRows, fetchJson, fetchXmlJson } from '../../yandex/catalog-sync/src/suppliers/fetch.js';
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
} from '../../yandex/catalog-sync/src/suppliers/transforms.js';

const SUPPLIER_DEFS = {
  shinservice: {
    key: 'shinservice',
    label: 'Шинсервис',
    format: 'json',
    async fetchRaw() {
      const tyresUrl = envUrl('SHINSERVICE_TYRES_URL', 'REACT_APP_SHINSERVICE_TYRES_URL');
      const discsUrl = envUrl('SHINSERVICE_DISCS_URL', 'REACT_APP_SHINSERVICE_DISCS_URL');
      return {
        rawTyres: await fetchJson(tyresUrl),
        rawDiscs: await fetchJson(discsUrl),
      };
    },
    transform(rawTyres, rawDiscs, storeId) {
      return {
        tyres: transformShinserviceTyres(rawTyres, storeId),
        discs: transformShinserviceDiscs(rawDiscs, storeId),
      };
    },
    indexRaw(rawTyres, rawDiscs) {
      const map = new Map();
      for (const t of rawTyres?.tyre || []) {
        map.set(`shinservice_${t.sku}`, {
          price: num(t.price),
          amount: num(t.amountDetailed?.[0]?.total ?? t.amountTotal),
          websitePrice: num(t.priceRetail),
        });
      }
      for (const d of rawDiscs?.disk || []) {
        map.set(`shinservice_${d.sku}`, {
          price: num(d.price),
          amount: num(d.amountDetailed?.[0]?.total ?? d.amountTotal),
          websitePrice: num(d.priceRetail),
        });
      }
      return map;
    },
  },
  fourtochki: {
    key: 'fourtochki',
    label: 'Форточки',
    format: 'json',
    async fetchRaw() {
      const url = envUrl('FOURTOCHKI_TYRES_URL', 'REACT_APP_4TOCHKI_TYRES_URL');
      const raw = await fetchJson(url);
      return { rawTyres: raw, rawDiscs: null };
    },
    transform(rawTyres, _rawDiscs, storeId) {
      return {
        tyres: transformFourtochkiTyres(rawTyres, storeId),
        discs: transformFourtochkiDiscs(rawTyres, storeId),
      };
    },
    indexRaw(rawTyres) {
      const map = new Map();
      for (const t of rawTyres?.tires || []) {
        map.set(`fourtochki_${t.cae}`, {
          price: num(t.price_krd),
          amount: parseRestKrdRaw(t.rest_krd),
          websitePrice: num(t.price_krd_rozn),
        });
      }
      for (const d of rawTyres?.rims || []) {
        map.set(`fourtochki_${d.cae}`, {
          price: num(d.price_krd),
          amount: parseRestKrdRaw(d.rest_krd),
          websitePrice: num(d.price_krd_rozn),
        });
      }
      return map;
    },
  },
  semisotnov: {
    key: 'semisotnov',
    label: 'Семисотнов',
    format: 'xml',
    async fetchRaw() {
      const tyresUrl = envUrl('SEMISOTNOV_TYRES_URL', 'REACT_APP_SEMISOTNOV_TYRES_URL');
      const discsUrl = envUrl('SEMISOTNOV_DISCS_URL', 'REACT_APP_SEMISOTNOV_DISCS_URL');
      return {
        rawTyres: await fetchXmlJson(tyresUrl),
        rawDiscs: await fetchXmlJson(discsUrl),
      };
    },
    transform(rawTyres, rawDiscs, storeId) {
      return {
        tyres: transformSemisotnovTyres(rawTyres, storeId),
        discs: transformSemisotnovDiscs(rawDiscs, storeId),
      };
    },
    indexRaw(rawTyres, rawDiscs) {
      const map = new Map();
      const tyres = rawTyres?.Выгрузка_Шины?.Шина;
      const discs = rawDiscs?.Выгрузка_Диски?.Диск;
      for (const t of arr(tyres)) {
        map.set(`semisotnov_${t.Код}`, {
          price: num(t.Цена),
          amount: num(t.Остаток),
          websitePrice: null,
        });
      }
      for (const d of arr(discs)) {
        map.set(`semisotnov_${d.Код}`, {
          price: num(d.Цена),
          amount: num(d.Остаток),
          websitePrice: null,
        });
      }
      return map;
    },
  },
  shinasu: {
    key: 'shinasu',
    label: 'ШинаСу',
    format: 'excel',
    async fetchRaw() {
      const url = envUrl('SHINASU_URL', 'REACT_APP_SHINASU_URL');
      const rows = await fetchExcelRows(url);
      return { rawTyres: rows, rawDiscs: null };
    },
    transform(rawTyres, _rawDiscs, storeId) {
      return {
        tyres: transformShinasuTyres(rawTyres, storeId),
        discs: transformShinasuDiscs(rawTyres, storeId),
      };
    },
    indexRaw(rawTyres) {
      const map = new Map();
      for (const row of arr(rawTyres)) {
        const code = String(row['Код'] || '').trim();
        if (!code) continue;
        const group = String(row['Номенклатурная группа'] || '').trim();
        const id =
          group === 'Легковые шины'
            ? `shinasu_${code}`
            : group === 'Диски'
              ? `shinasu_${code}`
              : null;
        if (!id) continue;
        map.set(id, {
          price: num(row['Цена']),
          amount: num(row['Количество']),
          websitePrice: null,
        });
      }
      return map;
    },
  },
};

const SAMPLE_PLAN = [
  { supplierKey: 'shinservice', category: 'tyres', count: 100 },
  { supplierKey: 'fourtochki', category: 'tyres', count: 100 },
  { supplierKey: 'shinservice', category: 'discs', count: 35 },
  { supplierKey: 'fourtochki', category: 'discs', count: 35 },
  { supplierKey: 'semisotnov', category: 'discs', count: 30 },
];

const PRICE_ABS_TOL = 1;
const PRICE_REL_TOL = 0.005;

function arr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseRestKrdRaw(value) {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const str = String(value ?? '').trim();
  if (!str) return 0;
  if (/более/i.test(str)) {
    const match = str.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }
  const n = Number(str);
  return Number.isNaN(n) ? 0 : n;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededSample(items, n, seed) {
  if (items.length <= n) return items.slice();
  const rng = mulberry32(seed);
  const indices = items.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).map((i) => items[i]);
}

function numOrZero(v) {
  const n = num(v);
  return n == null ? 0 : n;
}

function priceSubstantial(a, b) {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  const delta = Math.abs(a - b);
  if (delta <= PRICE_ABS_TOL) return false;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return delta / base > PRICE_REL_TOL;
}

function amountSubstantial(a, b) {
  const na = numOrZero(a);
  const nb = numOrZero(b);
  return na !== nb;
}

function pickFields(obj) {
  if (!obj) return null;
  return {
    price: num(obj.price),
    sellingPrice: num(obj.sellingPrice),
    amount: num(obj.amount),
    websitePrice: num(obj.websitePrice),
  };
}

function extractSnapshotItems(entry) {
  const out = { tyres: [], discs: [], tyresCommand: null, discsCommand: null };
  for (const category of ['tyres', 'discs']) {
    const cat = entry?.[category];
    if (Array.isArray(cat)) {
      out[category] = cat;
      out[`${category}Command`] = 'legacy_array';
    } else if (cat?.action === 'replace' && Array.isArray(cat.items)) {
      out[category] = cat.items;
      out[`${category}Command`] = 'replace';
    } else if (cat?.action === 'keepPrevious') {
      out[`${category}Command`] = `keepPrevious:${cat.status || 'unknown'}`;
    } else if (cat?.action === 'purge') {
      out[`${category}Command`] = 'purge';
    }
  }
  return out;
}

function parseSnapshotVersionMs(version) {
  if (!version) return null;
  const t = Date.parse(version);
  return Number.isFinite(t) ? t : null;
}

function classifyMismatch(row, syncAgeMinutes) {
  const { layerA, layerB, layerC, missingInB, missingInC, delta } = row;
  if (missingInC) return 'missing_in_snapshot';
  if (missingInB) return 'missing_after_transform';

  const substantial =
    delta.price.substantial || delta.sellingPrice.substantial || delta.amount.substantial;
  if (!substantial) return 'ok_rounding';

  const aMatchB =
    !priceSubstantial(layerA?.price, layerB?.price) &&
    !amountSubstantial(layerA?.amount, layerB?.amount);
  const bMatchC =
    !priceSubstantial(layerB?.price, layerC?.price) &&
    !priceSubstantial(layerB?.sellingPrice, layerC?.sellingPrice) &&
    !amountSubstantial(layerB?.amount, layerC?.amount);

  if (aMatchB && !bMatchC) {
    if (syncAgeMinutes != null && syncAgeMinutes >= 20) {
      return 'probable_upstream_changed_since_sync';
    }
    if (row.snapshotCommand?.includes('keepPrevious')) {
      return 'keepPrevious_stale_category';
    }
    return 'snapshot_not_reflecting_fresh_transform';
  }

  if (!aMatchB && bMatchC) {
    return 'upstream_vs_transform_drift';
  }

  if (!aMatchB && !bMatchC) {
    if (delta.sellingPrice.substantial && !delta.price.substantial) {
      return 'store_margin_or_selling_price';
    }
    return 'multi_layer_drift';
  }

  return 'unclassified';
}

function compareLayers(a, b) {
  const fa = pickFields(a);
  const fb = pickFields(b);
  return {
    price: { a: fa?.price, b: fb?.price, delta: diff(fa?.price, fb?.price), substantial: priceSubstantial(fa?.price, fb?.price) },
    sellingPrice: {
      a: fa?.sellingPrice,
      b: fb?.sellingPrice,
      delta: diff(fa?.sellingPrice, fb?.sellingPrice),
      substantial: priceSubstantial(fa?.sellingPrice, fb?.sellingPrice),
    },
    amount: {
      a: fa?.amount,
      b: fb?.amount,
      delta: diff(fa?.amount, fb?.amount),
      substantial: amountSubstantial(fa?.amount, fb?.amount),
    },
    websitePrice: {
      a: fa?.websitePrice,
      b: fb?.websitePrice,
      delta: diff(fa?.websitePrice, fb?.websitePrice),
      substantial: priceSubstantial(fa?.websitePrice, fb?.websitePrice),
    },
  };
}

function diff(a, b) {
  if (a == null || b == null) return null;
  return Math.round((b - a) * 100) / 100;
}

function parsePins(argv) {
  const idx = argv.indexOf('--pins');
  if (idx < 0 || !argv[idx + 1]) return [];
  return argv[idx + 1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toCsvRow(fields) {
  return fields
    .map((v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(',');
}

async function fetchLiveCatalog() {
  const base = (process.env.REACT_APP_CATALOG_API_BASE || process.env.REACT_APP_CORS_PROXY || '')
    .trim()
    .replace(/\/$/, '');
  const storeId = (process.env.REACT_APP_STORE_ID || 'ElistaIvanor').trim();
  if (!base) throw new Error('REACT_APP_CATALOG_API_BASE missing');

  const metaRes = await fetch(`${base}/v2/catalog/${encodeURIComponent(storeId)}/meta`, {
    cache: 'no-store',
  });
  if (!metaRes.ok) throw new Error(`meta HTTP ${metaRes.status}`);
  const meta = await metaRes.json();

  const snapRes = await fetch(`${base}/v2/catalog/${encodeURIComponent(storeId)}/snapshot`, {
    cache: 'no-store',
  });
  if (!snapRes.ok) throw new Error(`snapshot HTTP ${snapRes.status}`);
  const snapshot = await snapRes.json();
  return { meta, snapshot, storeId };
}

async function main() {
  const argv = process.argv.slice(2);
  const pins = parsePins(argv);
  const storeId = (process.env.REACT_APP_STORE_ID || 'ElistaIvanor').trim();
  const startedAt = new Date().toISOString();

  console.error(`[catalog-audit] storeId=${storeId}`);
  const { meta, snapshot } = await fetchLiveCatalog();
  const syncMs = parseSnapshotVersionMs(snapshot.version);
  const syncAgeMinutes =
    syncMs != null ? Math.round((Date.now() - syncMs) / 60000) : null;

  const snapshotBySupplier = {};
  for (const [key, entry] of Object.entries(snapshot.suppliers || {})) {
    snapshotBySupplier[key] = extractSnapshotItems(entry);
  }

  const transformedBySupplier = {};
  const rawIndexBySupplier = {};
  const loadErrors = [];

  for (const key of Object.keys(SUPPLIER_DEFS)) {
    const def = SUPPLIER_DEFS[key];
    try {
      console.error(`[catalog-audit] fetch+transform ${key}…`);
      const t0 = Date.now();
      const { rawTyres, rawDiscs } = await def.fetchRaw();
      const { tyres, discs } = def.transform(rawTyres, rawDiscs, storeId);
      transformedBySupplier[key] = {
        tyres: Array.isArray(tyres) ? tyres : [],
        discs: Array.isArray(discs) ? discs : [],
        fetchMs: Date.now() - t0,
      };
      rawIndexBySupplier[key] = def.indexRaw(rawTyres, rawDiscs);
      console.error(
        `[catalog-audit] ${key}: B tyres=${transformedBySupplier[key].tyres.length} discs=${transformedBySupplier[key].discs.length} (${Date.now() - t0}ms)`
      );
    } catch (err) {
      loadErrors.push({ key, error: err.message || String(err) });
      console.error(`[catalog-audit] FAIL ${key}:`, err.message || err);
    }
  }

  const idToB = { tyres: new Map(), discs: new Map() };
  for (const [key, data] of Object.entries(transformedBySupplier)) {
    for (const category of ['tyres', 'discs']) {
      for (const item of data[category] || []) {
        idToB[category].set(String(item.id), { ...item, supplierKey: key });
      }
    }
  }

  const idToC = { tyres: new Map(), discs: new Map() };
  for (const [key, extracted] of Object.entries(snapshotBySupplier)) {
    for (const category of ['tyres', 'discs']) {
      for (const item of extracted[category] || []) {
        idToC[category].set(String(item.id), {
          ...item,
          supplierKey: key,
          snapshotCommand: extracted[`${category}Command`],
        });
      }
    }
  }

  const selectedIds = new Set(pins);
  for (const plan of SAMPLE_PLAN) {
    const pool = (transformedBySupplier[plan.supplierKey]?.[plan.category] || []).map((i) =>
      String(i.id)
    );
    const seed = hashSeed(`${plan.supplierKey}:${plan.category}`);
    for (const id of seededSample(pool, plan.count, seed)) {
      selectedIds.add(id);
    }
  }

  const rows = [];
  for (const id of selectedIds) {
    const category = idToB.tyres.has(id) ? 'tyres' : idToB.discs.has(id) ? 'discs' : null;
    if (!category) {
      const snapItem = idToC.tyres.get(id) || idToC.discs.get(id);
      if (snapItem) {
        rows.push({
          id,
          category: idToC.tyres.has(id) ? 'tyres' : 'discs',
          supplierKey: snapItem.supplierKey,
          pinned: pins.includes(id),
          missingInB: true,
          missingInC: false,
          cause: 'only_in_snapshot_or_orphan',
        });
      }
      continue;
    }

    const layerB = idToB[category].get(id);
    const layerC = idToC[category].get(id);
    const supplierKey = layerB?.supplierKey;
    const layerA = rawIndexBySupplier[supplierKey]?.get(id) || null;

    const deltaBC = compareLayers(layerB, layerC);
    const deltaAB = compareLayers(layerA, layerB);
    const deltaAC = compareLayers(layerA, layerC);

    const row = {
      id,
      code: layerB?.code,
      category,
      supplierKey,
      supplier: layerB?.supplier,
      pinned: pins.includes(id),
      snapshotCommand: layerC?.snapshotCommand,
      layerA,
      layerB: pickFields(layerB),
      layerC: layerC ? pickFields(layerC) : null,
      missingInB: false,
      missingInC: !layerC,
      delta: {
        A_vs_B: deltaAB,
        B_vs_C: deltaBC,
        A_vs_C: deltaAC,
      },
    };
    row.cause = classifyMismatch(
      {
        layerA,
        layerB: row.layerB,
        layerC: row.layerC,
        missingInB: false,
        missingInC: row.missingInC,
        delta: deltaBC,
        snapshotCommand: layerC?.snapshotCommand,
      },
      syncAgeMinutes
    );
    row.substantial =
      deltaBC.price.substantial ||
      deltaBC.sellingPrice.substantial ||
      deltaBC.amount.substantial;
    rows.push(row);
  }

  const stats = summarize(rows);
  const report = {
    ok: loadErrors.length < Object.keys(SUPPLIER_DEFS).length,
    startedAt,
    finishedAt: new Date().toISOString(),
    storeId,
    meta: {
      version: meta.version,
      slot: meta.slot,
      okCount: meta.okCount,
      failCount: meta.failCount,
      suppliers: meta.suppliers,
    },
    snapshot: {
      version: snapshot.version,
      schemaVersion: snapshot.schemaVersion ?? null,
      syncAgeMinutes,
      wireFormat: snapshot.schemaVersion == null ? 'legacy_arrays' : 'command',
    },
    sample: {
      plan: SAMPLE_PLAN,
      pinsRequested: pins.length,
      totalIds: rows.length,
    },
    loadErrors,
    stats,
    rows,
  };

  if (argv.includes('--csv')) {
    printCsv(rows);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function summarize(rows) {
  const substantial = rows.filter((r) => r.substantial);
  const byCause = {};
  for (const r of rows) {
    const c = r.cause || 'unknown';
    byCause[c] = (byCause[c] || 0) + 1;
  }

  const layerPairs = [
    { name: 'A_vs_B', key: 'A_vs_B' },
    { name: 'B_vs_C', key: 'B_vs_C' },
    { name: 'A_vs_C', key: 'A_vs_C' },
  ];

  const layerStats = {};
  for (const lp of layerPairs) {
    let price = 0;
    let amount = 0;
    let selling = 0;
    for (const r of rows) {
      const d = r.delta?.[lp.key];
      if (!d) continue;
      if (d.price?.substantial) price += 1;
      if (d.amount?.substantial) amount += 1;
      // sellingPrice есть только после transform (B); в raw (A) не сравниваем
      if (lp.key !== 'A_vs_B' && d.sellingPrice?.substantial) selling += 1;
    }
    layerStats[lp.name] = {
      priceSubstantial: price,
      amountSubstantial: amount,
      sellingPriceSubstantial: selling,
      pctPrice: pct(price, rows.length),
      pctAmount: pct(amount, rows.length),
      pctSelling: pct(selling, rows.length),
    };
  }

  return {
    checked: rows.length,
    substantialBvsC: substantial.length,
    substantialBvsCPct: pct(substantial.length, rows.length),
    byCause,
    layerStats,
  };
}

function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 10000) / 100;
}

function printCsv(rows) {
  const header = [
    'supplier',
    'category',
    'id',
    'code',
    'cause',
    'substantial',
    'A_price',
    'B_price',
    'C_price',
    'A_amount',
    'B_amount',
    'C_amount',
    'B_selling',
    'C_selling',
  ];
  console.log(toCsvRow(header));
  for (const r of rows) {
    console.log(
      toCsvRow([
        r.supplierKey,
        r.category,
        r.id,
        r.code,
        r.cause,
        r.substantial ? 'yes' : 'no',
        r.layerA?.price,
        r.layerB?.price,
        r.layerC?.price,
        r.layerA?.amount,
        r.layerB?.amount,
        r.layerC?.amount,
        r.layerB?.sellingPrice,
        r.layerC?.sellingPrice,
      ])
    );
  }
}

main().catch((err) => {
  console.error(err);
  console.log(JSON.stringify({ ok: false, error: err.message || String(err) }, null, 2));
  process.exitCode = 1;
});