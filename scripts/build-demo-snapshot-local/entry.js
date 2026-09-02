/**
 * Entry для локальной demo-сборки. Bundle через scripts/build-demo-snapshot-local.js (esbuild).
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadAllSuppliersData, getSupplierLabel, SUPPLIER_LOAD_ORDER } from '../../yandex/catalog-sync/src/suppliers/loadAll.js';
import {
  buildSnapshotSuppliers,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
} from '../../yandex/catalog-sync/src/snapshotCommands.js';
import { resolveSlot, versionForSlot } from '../../yandex/catalog-sync/src/time.js';

const ROOT = process.cwd();
const DEMO_DIR = path.join(ROOT, 'public', 'demo');
const SNAPSHOT_PATH = path.join(DEMO_DIR, 'snapshot.json');
const META_PATH = path.join(DEMO_DIR, 'meta.json');
const GIT_LIMIT_BYTES = 22 * 1024 * 1024;
const DEMO_STORE_ID = 'demo';

const REAL_NAMES = ['Шинсервис', 'Семисотнов', 'Форточки', 'ШинаСу', 'Вершина'];
const DEMO_NAMES = ['ТайрСервис', 'РегионШина', 'ПятьТочек', 'ШинаПро', 'Высота'];

function frozenAtFromVersion(version) {
  const match = String(version || '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function collectSupplierStrings(snapshot) {
  const hits = new Set();
  const suppliers = snapshot?.suppliers || {};
  for (const entry of Object.values(suppliers)) {
    if (entry?.label) hits.add(entry.label);
    if (entry?.supplier) hits.add(entry.supplier);
    for (const category of ['tyres', 'discs']) {
      const block = entry?.[category];
      const items = block?.items || (Array.isArray(block) ? block : []);
      for (const item of items) {
        if (item?.supplier) hits.add(item.supplier);
      }
    }
  }
  return hits;
}

function assertAnonymized(snapshot) {
  const strings = collectSupplierStrings(snapshot);
  const leaked = REAL_NAMES.filter((name) => strings.has(name));
  if (leaked.length > 0) {
    throw new Error(
      `В snapshot остались реальные имена поставщиков: ${leaked.join(', ')}. ` +
        'Проверьте label в loadAll.js и supplier в transformers.js.'
    );
  }
  const missing = DEMO_NAMES.filter((name) => !strings.has(name));
  if (missing.length > 0) {
    console.warn(
      `Предупреждение: в snapshot нет некоторых demo-имён: ${missing.join(', ')} ` +
        '(возможно, поставщик не загрузился).'
    );
  }
}

async function main() {
  const slot = resolveSlot();
  const version = versionForSlot(slot);

  console.log('Загружаю upstream поставщиков…');
  const loadResults = await loadAllSuppliersData();
  const okCount = loadResults.filter((r) => r.status === 'fulfilled').length;
  const failCount = loadResults.length - okCount;
  console.log(`Загрузка: ok=${okCount}, fail=${failCount}`);

  const { suppliers } = buildSnapshotSuppliers({
    previousSnapshot: null,
    loadResults,
    supplierKeys: SUPPLIER_LOAD_ORDER,
    getSupplierLabel,
  });

  const snapshot = {
    schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
    storeId: DEMO_STORE_ID,
    version,
    slot,
    suppliers,
  };

  assertAnonymized(snapshot);

  const json = `${JSON.stringify(snapshot)}\n`;
  const bytes = Buffer.byteLength(json, 'utf8');
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, json);
  fs.writeFileSync(
    META_PATH,
    `${JSON.stringify(
      {
        bytes,
        version: snapshot.version,
        frozenAt: frozenAtFromVersion(snapshot.version),
      },
      null,
      2
    )}\n`
  );

  const mb = (bytes / (1024 * 1024)).toFixed(1);
  console.log(`Записано ${SNAPSHOT_PATH} (${bytes} bytes, ${mb} МБ).`);
  console.log(`Записано ${META_PATH}, version=${snapshot.version}, storeId=${DEMO_STORE_ID}.`);
  if (bytes > GIT_LIMIT_BYTES) {
    console.log(
      'Файл больше ~22 МБ: не коммитьте snapshot.json. Выложите JSON вне stores/{liveStoreId}/ и задайте REACT_APP_DEMO_SNAPSHOT_URL / REACT_APP_DEMO_META_URL.'
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
