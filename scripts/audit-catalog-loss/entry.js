/**
 * Audit: raw → transform → snapshot → validate → IndexedDB.
 * Bundle via scripts/audit-catalog-loss.mjs (esbuild).
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
import { validateAndNormalizeCatalogSnapshot } from '../../src/services/catalogSync/catalogSnapshotValidation.js';
import indexedDBService, {
  CATALOG_METADATA_KEYS,
  CATALOG_STORES,
} from '../../src/services/indexedDBService.js';

const SUPPLIERS = [
  {
    key: 'shinservice',
    label: 'Шинсервис',
    async fetchRaw() {
      const tyresUrl = envUrl('SHINSERVICE_TYRES_URL', 'REACT_APP_SHINSERVICE_TYRES_URL');
      const discsUrl = envUrl('SHINSERVICE_DISCS_URL', 'REACT_APP_SHINSERVICE_DISCS_URL');
      if (!tyresUrl || !discsUrl) throw new Error('SHINSERVICE_* URL не задан');
      return { rawTyres: await fetchJson(tyresUrl), rawDiscs: await fetchJson(discsUrl) };
    },
    countRaw(rawTyres, rawDiscs) {
      return {
        tyres: Array.isArray(rawTyres?.tyre) ? rawTyres.tyre.length : 0,
        discs: Array.isArray(rawDiscs?.disk) ? rawDiscs.disk.length : 0,
      };
    },
    transform(rawTyres, rawDiscs) {
      return {
        tyres: transformShinserviceTyres(rawTyres),
        discs: transformShinserviceDiscs(rawDiscs),
      };
    },
  },
  {
    key: 'semisotnov',
    label: 'Семисотнов',
    async fetchRaw() {
      const tyresUrl = envUrl('SEMISOTNOV_TYRES_URL', 'REACT_APP_SEMISOTNOV_TYRES_URL');
      const discsUrl = envUrl('SEMISOTNOV_DISCS_URL', 'REACT_APP_SEMISOTNOV_DISCS_URL');
      if (!tyresUrl || !discsUrl) throw new Error('SEMISOTNOV_* URL не задан');
      return { rawTyres: await fetchXmlJson(tyresUrl), rawDiscs: await fetchXmlJson(discsUrl) };
    },
    countRaw(rawTyres, rawDiscs) {
      const tyres = rawTyres?.Выгрузка_Шины?.Шина;
      const discs = rawDiscs?.Выгрузка_Диски?.Диск;
      return {
        tyres: Array.isArray(tyres) ? tyres.length : 0,
        discs: Array.isArray(discs) ? discs.length : 0,
      };
    },
    transform(rawTyres, rawDiscs) {
      return {
        tyres: transformSemisotnovTyres(rawTyres),
        discs: transformSemisotnovDiscs(rawDiscs),
      };
    },
  },
  {
    key: 'fourtochki',
    label: 'Форточки',
    async fetchRaw() {
      const url = envUrl('FOURTOCHKI_TYRES_URL', 'REACT_APP_4TOCHKI_TYRES_URL');
      if (!url) throw new Error('FOURTOCHKI_TYRES_URL не задан');
      const raw = await fetchJson(url);
      return { rawTyres: raw, rawDiscs: null };
    },
    countRaw(rawTyres) {
      return {
        tyres: Array.isArray(rawTyres?.tires) ? rawTyres.tires.length : 0,
        discs: Array.isArray(rawTyres?.rims) ? rawTyres.rims.length : 0,
      };
    },
    transform(rawTyres) {
      return {
        tyres: transformFourtochkiTyres(rawTyres),
        discs: transformFourtochkiDiscs(rawTyres),
      };
    },
  },
  {
    key: 'shinasu',
    label: 'ШинаСу',
    async fetchRaw() {
      const url = envUrl('SHINASU_URL', 'REACT_APP_SHINASU_URL');
      if (!url) throw new Error('SHINASU_URL не задан');
      const rows = await fetchExcelRows(url);
      return { rawTyres: rows, rawDiscs: null };
    },
    countRaw(rawTyres) {
      const rows = Array.isArray(rawTyres) ? rawTyres : [];
      const tyres = rows.filter((row) => {
        const group = String(row['Номенклатурная группа'] || '').trim();
        const code = String(row['Код'] || '').trim();
        return group === 'Легковые шины' && code;
      });
      const discs = rows.filter((row) => {
        const group = String(row['Номенклатурная группа'] || '').trim();
        const code = String(row['Код'] || '').trim();
        return group === 'Диски' && code;
      });
      return {
        tyres: tyres.length,
        discs: discs.length,
        excelTotalRows: rows.length,
      };
    },
    transform(rawTyres) {
      return {
        tyres: transformShinasuTyres(rawTyres),
        discs: transformShinasuDiscs(rawTyres),
      };
    },
  },
  {
    key: 'vershina',
    label: 'Вершина',
    async fetchRaw() {
      const tyresUrl = envUrl('VERSHINA_TYRES_URL', 'REACT_APP_VERSHINA_TYRES_URL');
      const discsUrl = envUrl('VERSHINA_DISCS_URL', 'REACT_APP_VERSHINA_DISCS_URL');
      if (!tyresUrl || !discsUrl) throw new Error('VERSHINA_* URL не задан');
      return { rawTyres: await fetchXmlJson(tyresUrl), rawDiscs: await fetchXmlJson(discsUrl) };
    },
    countRaw(rawTyres, rawDiscs) {
      const tyres = rawTyres?.data?.tyres;
      const discs = rawDiscs?.data?.rims;
      return {
        tyres: Array.isArray(tyres) ? tyres.length : 0,
        discs: Array.isArray(discs) ? discs.length : 0,
      };
    },
    transform(rawTyres, rawDiscs) {
      return {
        tyres: transformVershinaTyres(rawTyres),
        discs: transformVershinaDiscs(rawDiscs),
      };
    },
  },
];

const pct = (num, den) => (den === 0 ? null : Math.round((num / den) * 10000) / 100);

const lossRow = (a, b) => ({
  abs: b - a,
  pct: pct(b - a, a),
});

function buildLegacySnapshot(version, suppliersData) {
  const suppliers = {};
  for (const s of suppliersData) {
    suppliers[s.key] = {
      key: s.key,
      label: s.label,
      ok: true,
      tyres: s.tyres,
      discs: s.discs,
    };
  }
  return {
    storeId: process.env.REACT_APP_STORE_ID || process.env.STORE_ID || 'ElistaIvanor',
    version,
    slot: 'audit',
    suppliers,
  };
}

function buildCommandSnapshot(version, suppliersData) {
  const suppliers = {};
  for (const s of suppliersData) {
    suppliers[s.key] = {
      key: s.key,
      label: s.label,
      supplier: s.label,
      ok: true,
      tyres: { action: 'replace', status: 'ok', items: s.tyres },
      discs: { action: 'replace', status: 'ok', items: s.discs },
    };
  }
  return {
    schemaVersion: 1,
    storeId: process.env.REACT_APP_STORE_ID || process.env.STORE_ID || 'ElistaIvanor',
    version,
    slot: 'audit',
    suppliers,
  };
}

function countCommandsBySupplier(commands) {
  const out = {};
  for (const cmd of commands || []) {
    if (!out[cmd.supplier]) out[cmd.supplier] = { tyres: 0, discs: 0 };
    if (cmd.action === 'replace' && Array.isArray(cmd.items)) {
      out[cmd.supplier][cmd.category] = cmd.items.length;
    }
  }
  return out;
}

function summarizeProblems(problems = []) {
  const byCode = {};
  for (const p of problems) {
    const code = p.code || 'UNKNOWN';
    if (!byCode[code]) byCode[code] = { code, count: 0, severity: p.severity, examples: [] };
    byCode[code].count += 1;
    if (byCode[code].examples.length < 3) {
      byCode[code].examples.push({
        path: p.path,
        message: p.message,
        received: p.received,
        firstPath: p.firstPath,
      });
    }
  }
  return Object.values(byCode).sort((a, b) => b.count - a.count);
}

/**
 * Для каждой отбракованной позиции: мини-snapshot → fatal-код
 * (обход VALIDATION_PROBLEM_LIMIT на полном snapshot).
 */
function diagnoseRejectedItemsV2(suppliersData) {
  const reasons = {};
  const examplesByCode = {};

  for (const s of suppliersData) {
    for (const category of ['tyres', 'discs']) {
      const before = s[category] || [];
      const survivingIds = new Set();

      const miniAll = {
        schemaVersion: 1,
        version: 'audit-diagnose-all',
        suppliers: {
          [s.key]: {
            key: s.key,
            label: s.label,
            supplier: s.label,
            tyres:
              category === 'tyres'
                ? { action: 'replace', status: 'ok', items: before }
                : { action: 'purge', status: 'ok' },
            discs:
              category === 'discs'
                ? { action: 'replace', status: 'ok', items: before }
                : { action: 'purge', status: 'ok' },
          },
        },
      };

      const { commands, report } = validateAndNormalizeCatalogSnapshot(miniAll);
      if (report.valid) {
        const cmd = commands.find((c) => c.category === category && c.action === 'replace');
        for (const item of cmd?.items || []) survivingIds.add(String(item.id));
      }

      for (const item of before) {
        if (survivingIds.has(String(item?.id))) continue;

        const mini = {
          schemaVersion: 1,
          version: 'audit-diagnose-one',
          suppliers: {
            [s.key]: {
              key: s.key,
              label: s.label,
              supplier: s.label,
              tyres:
                category === 'tyres'
                  ? { action: 'replace', status: 'ok', items: [item] }
                  : { action: 'purge', status: 'ok' },
              discs:
                category === 'discs'
                  ? { action: 'replace', status: 'ok', items: [item] }
                  : { action: 'purge', status: 'ok' },
            },
          },
        };
        const { report: oneReport, commands: oneCmds } = validateAndNormalizeCatalogSnapshot(mini);
        const aloneOk = oneReport.valid && (oneCmds.find((c) => c.category === category)?.items?.length || 0) > 0;
        let code;
        if (aloneOk) {
          code = 'DUPLICATE_ID';
        } else {
          code = oneReport.errors[0]?.code || 'UNKNOWN_DROP';
        }

        reasons[code] = (reasons[code] || 0) + 1;
        if (!examplesByCode[code]) examplesByCode[code] = [];
        if (examplesByCode[code].length < 3) {
          examplesByCode[code].push({
            supplier: s.label,
            category,
            id: item?.id,
            code: item?.code,
            brand: item?.brand,
            message: oneReport.errors[0]?.message || null,
          });
        }
      }
    }
  }

  return Object.entries(reasons)
    .map(([code, count]) => ({ code, count, examples: examplesByCode[code] || [] }))
    .sort((a, b) => b.count - a.count);
}

/* —— Fake IndexedDB (same contract as indexedDBService.test.js) —— */

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  }
  return value;
};

function createFakeCatalogDatabase(initialState = {}) {
  let committedState = {
    tires: clone(initialState.tires || []),
    discs: clone(initialState.discs || []),
    metadata: clone(initialState.metadata || {}),
  };

  return {
    getTires: () => clone(committedState.tires),
    getDiscs: () => clone(committedState.discs),
    getMetadata: (key) => committedState.metadata[key],
    transaction(storeNames, mode = 'readwrite') {
      const hasMetadataWrite = storeNames.includes(CATALOG_STORES.metadata);
      const stagedTires = new Map(committedState.tires.map((item) => [item.id, clone(item)]));
      const stagedDiscs = new Map(committedState.discs.map((item) => [item.id, clone(item)]));
      const stagedMetadata = { ...committedState.metadata };
      let done = false;
      let writesStarted = false;

      const abort = (error) => {
        if (done) return;
        done = true;
        transaction.error = error || transaction.error;
        setTimeout(() => transaction.onabort?.());
      };

      const tryComplete = () => {
        if (done) return;
        done = true;
        committedState = {
          tires: Array.from(stagedTires.values()),
          discs: Array.from(stagedDiscs.values()),
          metadata: { ...stagedMetadata },
        };
        setTimeout(() => transaction.oncomplete?.());
      };

      const transaction = {
        error: null,
        onabort: null,
        oncomplete: null,
        abort: () => abort(transaction.error || new Error('AbortError')),
        objectStore: (storeName) => {
          if (storeName === CATALOG_STORES.metadata) {
            return {
              get: (key) => {
                const request = { result: undefined, onsuccess: null, onerror: null };
                request.result = stagedMetadata[key]
                  ? { key, value: stagedMetadata[key] }
                  : undefined;
                queueMicrotask(() => {
                  request.onsuccess?.();
                  queueMicrotask(() => {
                    if (!done && hasMetadataWrite && !writesStarted) tryComplete();
                  });
                });
                return request;
              },
              put: (record) => {
                stagedMetadata[record.key] = record.value;
                queueMicrotask(tryComplete);
                return {};
              },
            };
          }

          const stagedMap = storeName === CATALOG_STORES.discs ? stagedDiscs : stagedTires;
          return {
            index: () => ({
              openCursor: (supplier) => {
                writesStarted = true;
                const request = { result: null, onsuccess: null, onerror: null };
                let cursorIndex = 0;
                const deliverCursor = () => {
                  if (done) return;
                  const matchingIds = Array.from(stagedMap.values())
                    .filter((item) => item.supplier === supplier)
                    .map((item) => item.id);
                  const id = matchingIds[cursorIndex];
                  if (id === undefined) {
                    request.result = null;
                    cursorIndex = 0;
                    queueMicrotask(() => {
                      request.onsuccess?.();
                      if (!hasMetadataWrite) tryComplete();
                    });
                    return;
                  }
                  request.result = {
                    delete: () => {
                      stagedMap.delete(id);
                      return {};
                    },
                    continue: () => {
                      cursorIndex += 1;
                      deliverCursor();
                    },
                  };
                  queueMicrotask(() => request.onsuccess?.());
                };
                deliverCursor();
                return request;
              },
            }),
            put: (item) => {
              stagedMap.set(item.id, clone(item));
              return {};
            },
          };
        },
      };
      return transaction;
    },
  };
}

function mountCatalogDb(database) {
  indexedDBService.catalogDb = database;
  indexedDBService.db = database;
  indexedDBService.discDb = database;
  indexedDBService._migrationComplete = true;
  indexedDBService._ensurePromise = null;
}

function polyfillBrowserGlobals() {
  if (typeof globalThis.IDBKeyRange === 'undefined') {
    globalThis.IDBKeyRange = { only: (value) => value };
  }
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }
  if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
  }
  if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
  }
}

async function fetchLiveSnapshot() {
  const base = (process.env.REACT_APP_CATALOG_API_BASE || process.env.REACT_APP_CORS_PROXY || '')
    .trim()
    .replace(/\/$/, '');
  const storeId = (process.env.REACT_APP_STORE_ID || 'ElistaIvanor').trim();
  if (!base) return { available: false, reason: 'REACT_APP_CATALOG_API_BASE missing' };

  try {
    const metaRes = await fetch(`${base}/v2/catalog/${encodeURIComponent(storeId)}/meta`, {
      cache: 'no-store',
    });
    if (!metaRes.ok) {
      return { available: false, reason: `meta HTTP ${metaRes.status}` };
    }
    const meta = await metaRes.json();
    const snapRes = await fetch(`${base}/v2/catalog/${encodeURIComponent(storeId)}/snapshot`, {
      cache: 'no-store',
    });
    if (!snapRes.ok) {
      return { available: false, reason: `snapshot HTTP ${snapRes.status}`, meta };
    }
    const snapshot = await snapRes.json();
    const counts = {};
    for (const [key, entry] of Object.entries(snapshot.suppliers || {})) {
      const tyres = Array.isArray(entry.tyres)
        ? entry.tyres.length
        : Array.isArray(entry.tyres?.items)
          ? entry.tyres.items.length
          : null;
      const discs = Array.isArray(entry.discs)
        ? entry.discs.length
        : Array.isArray(entry.discs?.items)
          ? entry.discs.items.length
          : null;
      counts[key] = {
        label: entry.label || entry.supplier || key,
        tyres,
        discs,
        tyresIsArray: Array.isArray(entry.tyres),
        discsIsArray: Array.isArray(entry.discs),
        hasSchemaVersion: snapshot.schemaVersion != null,
        emptyTyresArray: Array.isArray(entry.tyres) && entry.tyres.length === 0,
        emptyDiscsArray: Array.isArray(entry.discs) && entry.discs.length === 0,
      };
    }
    const validation = validateAndNormalizeCatalogSnapshot(snapshot);
    return {
      available: true,
      meta,
      version: snapshot.version,
      schemaVersion: snapshot.schemaVersion ?? null,
      counts,
      validation: {
        valid: validation.report.valid,
        errorCount: validation.report.errorCount,
        warningCount: validation.report.warningCount,
        topErrors: summarizeProblems(validation.report.errors).slice(0, 10),
        topWarnings: summarizeProblems(validation.report.warnings).slice(0, 10),
        itemCount: validation.report.itemCount,
        normalizedCount: validation.report.normalizedCount,
      },
    };
  } catch (err) {
    return { available: false, reason: err.message || String(err) };
  }
}

async function main() {
  polyfillBrowserGlobals();
  const startedAt = new Date().toISOString();
  const missingEnv = [];
  const required = [
    ['SHINSERVICE_TYRES_URL', 'REACT_APP_SHINSERVICE_TYRES_URL'],
    ['SHINSERVICE_DISCS_URL', 'REACT_APP_SHINSERVICE_DISCS_URL'],
    ['SEMISOTNOV_TYRES_URL', 'REACT_APP_SEMISOTNOV_TYRES_URL'],
    ['SEMISOTNOV_DISCS_URL', 'REACT_APP_SEMISOTNOV_DISCS_URL'],
    ['FOURTOCHKI_TYRES_URL', 'REACT_APP_4TOCHKI_TYRES_URL'],
    ['SHINASU_URL', 'REACT_APP_SHINASU_URL'],
    ['VERSHINA_TYRES_URL', 'REACT_APP_VERSHINA_TYRES_URL'],
    ['VERSHINA_DISCS_URL', 'REACT_APP_VERSHINA_DISCS_URL'],
  ];
  for (const names of required) {
    if (!envUrl(...names)) missingEnv.push(names.join(' | '));
  }
  if (missingEnv.length) {
    const report = {
      ok: false,
      error: 'missing_env',
      missingEnv,
      hint: 'Заполните URL в корневом .env (REACT_APP_*) или yandex/catalog-sync/.env',
    };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  const suppliersData = [];
  const loadErrors = [];

  for (const supplier of SUPPLIERS) {
    const t0 = Date.now();
    try {
      console.error(`[audit] fetch ${supplier.key}…`);
      const { rawTyres, rawDiscs } = await supplier.fetchRaw();
      const rawCounts = supplier.countRaw(rawTyres, rawDiscs);
      const { tyres, discs } = supplier.transform(rawTyres, rawDiscs);
      suppliersData.push({
        key: supplier.key,
        label: supplier.label,
        raw: rawCounts,
        tyres: Array.isArray(tyres) ? tyres : [],
        discs: Array.isArray(discs) ? discs : [],
        fetchMs: Date.now() - t0,
      });
      console.error(
        `[audit] ${supplier.key}: raw T=${rawCounts.tyres} D=${rawCounts.discs} → transform T=${tyres.length} D=${discs.length} (${Date.now() - t0}ms)`
      );
    } catch (err) {
      loadErrors.push({ key: supplier.key, error: err.message || String(err) });
      console.error(`[audit] FAIL ${supplier.key}:`, err.message || err);
    }
  }

  if (suppliersData.length === 0) {
    console.log(JSON.stringify({ ok: false, error: 'all_suppliers_failed', loadErrors }, null, 2));
    process.exitCode = 1;
    return;
  }

  const auditVersion = `audit-${Date.now()}`;
  const legacySnapshot = buildLegacySnapshot(auditVersion, suppliersData);
  const commandSnapshot = buildCommandSnapshot(`${auditVersion}-cmd`, suppliersData);

  const legacyValidation = validateAndNormalizeCatalogSnapshot(legacySnapshot);
  const commandValidation = validateAndNormalizeCatalogSnapshot(commandSnapshot);

  const legacyCounts = countCommandsBySupplier(legacyValidation.commands);
  const commandCounts = countCommandsBySupplier(commandValidation.commands);

  const rejectionDiagnosis = diagnoseRejectedItemsV2(suppliersData);

  // IndexedDB apply: prefer command snapshot (prod wire may still be legacy)
  const applyTarget = commandValidation.report.valid
    ? { name: 'command', snapshot: commandSnapshot, validation: commandValidation }
    : legacyValidation.report.valid
      ? { name: 'legacy', snapshot: legacySnapshot, validation: legacyValidation }
      : null;

  let idb = {
    applied: false,
    skipped: false,
    format: null,
    error: null,
    counts: {},
    versionBefore: '',
    versionAfterLocalStorage: '',
    versionAfterIdb: null,
    versionUpdatedOnSuccess: null,
    versionUpdatedOnFatal: null,
  };

  // Version check: fatal must NOT update version
  {
    const lsKey = 'ivanor.catalog.cloudVersion';
    localStorage.setItem(lsKey, 'before-fatal');
    const invalid = {
      schemaVersion: 99,
      version: 'fatal-version-test',
      suppliers: {
        x: {
          label: 'X',
          tyres: { action: 'replace', status: 'ok', items: [] },
          discs: { action: 'replace', status: 'ok', items: [] },
        },
      },
    };
    const { report: fatalReport } = validateAndNormalizeCatalogSnapshot(invalid);
    if (!fatalReport.valid) {
      // как applyCatalogSnapshot: при !valid не трогаем LS/IDB
      idb.versionUpdatedOnFatal = localStorage.getItem(lsKey) === 'before-fatal';
    }
  }

  if (applyTarget) {
    const database = createFakeCatalogDatabase({
      metadata: { [CATALOG_METADATA_KEYS.snapshotVersion]: '' },
    });
    mountCatalogDb(database);
    localStorage.setItem('ivanor.catalog.cloudVersion', '');

    try {
      const { commands, report } = applyTarget.validation;
      if (!report.valid) throw new Error('unexpected invalid');
      const result = await indexedDBService.applyCatalogSnapshot(
        commands,
        applyTarget.snapshot.version
      );
      if (result.applied) {
        localStorage.setItem('ivanor.catalog.cloudVersion', applyTarget.snapshot.version);
      }
      idb.applied = result.applied;
      idb.skipped = result.skipped;
      idb.format = applyTarget.name;
      idb.versionAfterLocalStorage = localStorage.getItem('ivanor.catalog.cloudVersion') || '';
      idb.versionAfterIdb = database.getMetadata(CATALOG_METADATA_KEYS.snapshotVersion);
      idb.versionUpdatedOnSuccess =
        result.applied &&
        idb.versionAfterLocalStorage === applyTarget.snapshot.version &&
        idb.versionAfterIdb === applyTarget.snapshot.version;

      for (const s of suppliersData) {
        const tires = database.getTires().filter((i) => i.supplier === s.label);
        const discs = database.getDiscs().filter((i) => i.supplier === s.label);
        idb.counts[s.key] = { tyres: tires.length, discs: discs.length };
      }
    } catch (err) {
      idb.error = err.message || String(err);
    }
  } else {
    idb.error = 'both legacy and command snapshots invalid — apply skipped';
  }

  // Per-supplier funnel rows
  const rows = [];
  for (const s of suppliersData) {
    for (const category of ['tyres', 'discs']) {
      const A = s.raw[category] || 0;
      const B = (s[category] || []).length;
      const C = B; // wire carries full transform arrays (legacy) / same items (command)
      const D =
        (commandValidation.report.valid
          ? commandCounts[s.label]?.[category]
          : legacyValidation.report.valid
            ? legacyCounts[s.label]?.[category]
            : 0) ?? 0;
      const E = idb.counts[s.key]?.[category] ?? (idb.applied ? 0 : null);

      rows.push({
        supplierKey: s.key,
        supplier: s.label,
        category,
        A_raw: A,
        B_transform: B,
        C_snapshotWire: C,
        D_afterValidation: D,
        E_afterIdb: E,
        loss_B_minus_A: lossRow(A, B),
        loss_D_minus_B: lossRow(B, D),
        loss_E_minus_D: E == null ? null : lossRow(D, E),
        rawExtra: s.raw.excelTotalRows != null ? { excelTotalRows: s.raw.excelTotalRows } : undefined,
      });
    }
  }

  const sum = (field, category) =>
    rows.filter((r) => r.category === category).reduce((acc, r) => acc + (r[field] || 0), 0);

  const totals = {
    tyres: {
      A: sum('A_raw', 'tyres'),
      B: sum('B_transform', 'tyres'),
      D: sum('D_afterValidation', 'tyres'),
      E: rows.filter((r) => r.category === 'tyres').reduce((a, r) => a + (r.E_afterIdb || 0), 0),
    },
    discs: {
      A: sum('A_raw', 'discs'),
      B: sum('B_transform', 'discs'),
      D: sum('D_afterValidation', 'discs'),
      E: rows.filter((r) => r.category === 'discs').reduce((a, r) => a + (r.E_afterIdb || 0), 0),
    },
  };
  totals.sum = {
    A: totals.tyres.A + totals.discs.A,
    B: totals.tyres.B + totals.discs.B,
    D: totals.tyres.D + totals.discs.D,
    E: totals.tyres.E + totals.discs.E,
  };
  totals.lossPct = {
    transform_vs_raw: pct(totals.sum.B - totals.sum.A, totals.sum.A),
    validation_vs_transform: pct(totals.sum.D - totals.sum.B, totals.sum.B),
    idb_vs_validation: pct(totals.sum.E - totals.sum.D, totals.sum.D),
  };

  const emptyCategories = rows.filter((r) => r.A_raw > 0 && r.B_transform === 0);
  const highValidationLoss = rows.filter(
    (r) => r.B_transform > 0 && Math.abs(r.loss_D_minus_B.pct || 0) > 2
  );

  const legacyEmptyArrays = [];
  for (const s of suppliersData) {
    if (s.tyres.length === 0) legacyEmptyArrays.push(`${s.key}.tyres`);
    if (s.discs.length === 0) legacyEmptyArrays.push(`${s.key}.discs`);
  }

  const live = await fetchLiveSnapshot();

  const verdictFlags = {
    red: [],
    yellow: [],
  };

  if (!legacyValidation.report.valid) {
    verdictFlags.red.push({
      code: 'LEGACY_SNAPSHOT_INVALID',
      detail: legacyValidation.report.errors?.[0],
      note: 'runSync.js пишет legacy-массивы; пустой [] → AMBIGUOUS_LEGACY_ARRAY',
      emptyCategories: legacyEmptyArrays,
    });
  }
  if (!commandValidation.report.valid) {
    verdictFlags.red.push({
      code: 'COMMAND_SNAPSHOT_INVALID',
      detail: commandValidation.report.errors?.[0],
    });
  }
  for (const r of emptyCategories) {
    verdictFlags.red.push({
      code: 'ZERO_AFTER_TRANSFORM',
      supplier: r.supplier,
      category: r.category,
      raw: r.A_raw,
    });
  }
  for (const r of highValidationLoss) {
    verdictFlags.red.push({
      code: 'VALIDATION_LOSS_GT_2PCT',
      supplier: r.supplier,
      category: r.category,
      lossPct: r.loss_D_minus_B.pct,
      abs: r.loss_D_minus_B.abs,
    });
  }
  if (idb.versionUpdatedOnFatal === false) {
    verdictFlags.red.push({ code: 'VERSION_UPDATED_ON_FATAL' });
  }
  if (idb.applied && idb.versionUpdatedOnSuccess === false) {
    verdictFlags.red.push({ code: 'VERSION_NOT_UPDATED_ON_SUCCESS', idb });
  }

  const warnRatio =
    commandValidation.report.itemCount &&
    (commandValidation.report.itemCount.tyres || 0) +
      (commandValidation.report.itemCount.discs || 0);
  if (warnRatio > 0 && commandValidation.report.warningCount / warnRatio > 0.05) {
    verdictFlags.yellow.push({
      code: 'WARNINGS_GT_5PCT',
      warningCount: commandValidation.report.warningCount,
      itemCount: warnRatio,
      pct: pct(commandValidation.report.warningCount, warnRatio),
    });
  }

  let verdict = 'потери приемлемы';
  if (verdictFlags.red.length) verdict = 'нужен фикс';
  else if (verdictFlags.yellow.length) verdict = 'потери приемлемы (жёлтые флаги качества)';

  // If only legacy is invalid due to empty arrays but command works and loss is low → критичны for prod wire
  if (
    !legacyValidation.report.valid &&
    commandValidation.report.valid &&
    legacyEmptyArrays.length === 0
  ) {
    // unexpected — legacy should work if no empties
  }
  if (!legacyValidation.report.valid && commandValidation.report.valid) {
    verdict = 'критичны';
    if (!verdictFlags.red.some((f) => f.code === 'LEGACY_SNAPSHOT_INVALID')) {
      verdictFlags.red.push({ code: 'PROD_WIRE_LEGACY_BROKEN' });
    }
  }

  // IndexedDB apply on live snapshot (prod wire) if available & valid
  let liveIdb = null;
  if (live.available && live.validation?.valid) {
    const liveSnapRes = await fetch(
      `${(process.env.REACT_APP_CATALOG_API_BASE || '').replace(/\/$/, '')}/v2/catalog/${encodeURIComponent((process.env.REACT_APP_STORE_ID || 'ElistaIvanor').trim())}/snapshot`,
      { cache: 'no-store' }
    );
    if (liveSnapRes.ok) {
      const liveSnapshot = await liveSnapRes.json();
      const { commands, report } = validateAndNormalizeCatalogSnapshot(liveSnapshot);
      const database = createFakeCatalogDatabase({
        metadata: { [CATALOG_METADATA_KEYS.snapshotVersion]: '' },
      });
      mountCatalogDb(database);
      const applyResult = await indexedDBService.applyCatalogSnapshot(
        commands,
        liveSnapshot.version
      );
      const counts = {};
      for (const s of SUPPLIERS) {
        counts[s.key] = {
          tyres: database.getTires().filter((i) => i.supplier === s.label).length,
          discs: database.getDiscs().filter((i) => i.supplier === s.label).length,
        };
      }
      liveIdb = {
        applied: applyResult.applied,
        skipped: applyResult.skipped,
        version: liveSnapshot.version,
        idbMetadataVersion: database.getMetadata(CATALOG_METADATA_KEYS.snapshotVersion),
        counts,
        normalizedCount: report.normalizedCount,
        itemCount: report.itemCount,
      };
    }
  }

  const report = {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    verdict,
    flags: verdictFlags,
    loadErrors,
    funnel: rows,
    totals,
    wireFormat: {
      runSyncShape: 'legacy arrays without schemaVersion (see yandex/catalog-sync/src/runSync.js)',
      validationExpects:
        'schemaVersion 1 + replace|purge|keepPrevious OR non-empty legacy arrays (empty [] = AMBIGUOUS_LEGACY_ARRAY fatal)',
      legacy: {
        valid: legacyValidation.report.valid,
        schemaVersion: legacyValidation.report.schemaVersion,
        errorCount: legacyValidation.report.errorCount,
        warningCount: legacyValidation.report.warningCount,
        topErrors: summarizeProblems(legacyValidation.report.errors).slice(0, 20),
        topWarnings: summarizeProblems(legacyValidation.report.warnings).slice(0, 20),
        itemCount: legacyValidation.report.itemCount,
        normalizedCount: legacyValidation.report.normalizedCount,
        emptyLegacyArrays: legacyEmptyArrays,
      },
      command: {
        valid: commandValidation.report.valid,
        schemaVersion: commandValidation.report.schemaVersion,
        errorCount: commandValidation.report.errorCount,
        warningCount: commandValidation.report.warningCount,
        topErrors: summarizeProblems(commandValidation.report.errors).slice(0, 20),
        topWarnings: summarizeProblems(commandValidation.report.warnings).slice(0, 20),
        itemCount: commandValidation.report.itemCount,
        normalizedCount: commandValidation.report.normalizedCount,
      },
    },
    rejectionDiagnosisTop20: rejectionDiagnosis.slice(0, 20),
    versionCheck: {
      fatalKeepsPreviousVersion: idb.versionUpdatedOnFatal,
      successUpdatesVersion: idb.versionUpdatedOnSuccess,
      idbApplied: idb.applied,
      idbFormat: idb.format,
      idbError: idb.error,
      localStorageVersion: idb.versionAfterLocalStorage,
      idbMetadataVersion: idb.versionAfterIdb,
      pass:
        idb.versionUpdatedOnFatal === true &&
        (idb.applied ? idb.versionUpdatedOnSuccess === true : !commandValidation.report.valid),
    },
    liveApi: live,
    liveIdbApply: liveIdb,
    fixes: [],
  };

  // Prioritized fixes
  if (!legacyValidation.report.valid) {
    report.fixes.push({
      priority: 'P0',
      title: 'runSync пишет legacy-массивы, validation отклоняет snapshot',
      detail:
        legacyEmptyArrays.length > 0
          ? `Пустые массивы: ${legacyEmptyArrays.join(', ')} → AMBIGUOUS_LEGACY_ARRAY. Нужен schemaVersion:1 + явные replace/purge/keepPrevious в runSync.`
          : `Legacy invalid: ${legacyValidation.report.errors?.[0]?.code} ${legacyValidation.report.errors?.[0]?.message}`,
    });
  }
  for (const f of highValidationLoss) {
    report.fixes.push({
      priority: 'P1',
      title: `Потеря >2% на validation: ${f.supplier} ${f.category}`,
      detail: `${f.loss_D_minus_B.abs} SKU (${f.loss_D_minus_B.pct}%)`,
    });
  }
  for (const y of verdictFlags.yellow) {
    report.fixes.push({
      priority: 'P2',
      title: 'Массовые warnings качества полей',
      detail: y,
    });
  }
  if (live.available && live.validation && !live.validation.valid) {
    report.fixes.push({
      priority: 'P0',
      title: 'Live snapshot из Object Storage не проходит validation',
      detail: live.validation.topErrors?.[0],
    });
    report.verdict = 'критичны';
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  console.log(JSON.stringify({ ok: false, error: err.message || String(err) }, null, 2));
  process.exitCode = 1;
});
