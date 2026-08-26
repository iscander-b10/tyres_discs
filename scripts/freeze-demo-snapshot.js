#!/usr/bin/env node
/**
 * Снимает текущий live catalog snapshot и кладёт frozen JSON для /demo.
 *
 * Читает REACT_APP_CATALOG_API_BASE (или REACT_APP_CORS_PROXY) и
 * REACT_APP_STORE_ID из process.env / .env* (значения не печатает).
 *
 *   node scripts/freeze-demo-snapshot.js
 *
 * Рантайм приложения файл сам не обновляет.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEMO_DIR = path.join(ROOT, 'public', 'demo');
const SNAPSHOT_PATH = path.join(DEMO_DIR, 'snapshot.json');
const META_PATH = path.join(DEMO_DIR, 'meta.json');
const GIT_LIMIT_BYTES = 22 * 1024 * 1024;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function catalogApiBase() {
  const explicit = String(process.env.REACT_APP_CATALOG_API_BASE || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const cors = String(process.env.REACT_APP_CORS_PROXY || '').trim();
  if (cors) return cors.replace(/\/$/, '');
  return '';
}

function storeId() {
  return String(process.env.REACT_APP_STORE_ID || '').trim();
}

function frozenAtFromVersion(version) {
  const match = String(version || '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function main() {
  [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
    path.join(ROOT, '.env.development'),
    path.join(ROOT, '.env.development.local'),
    path.join(ROOT, '.env.production'),
    path.join(ROOT, '.env.production.local'),
  ].forEach(loadEnvFile);

  const base = catalogApiBase();
  const id = storeId();
  if (!base || !id) {
    console.error(
      'Нужны REACT_APP_CATALOG_API_BASE (или REACT_APP_CORS_PROXY) и REACT_APP_STORE_ID.'
    );
    process.exit(1);
  }

  const url = `${base}/v2/catalog/${encodeURIComponent(id)}/snapshot`;
  console.log('Скачиваю live snapshot…');
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    console.error(`HTTP ${res.status} при GET snapshot`);
    process.exit(1);
  }
  const snapshot = await res.json();
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.version || !snapshot.suppliers) {
    console.error(
      'Ответ не похож на production snapshot (нужны version и suppliers).',
      snapshot && typeof snapshot === 'object'
        ? `keys=${Object.keys(snapshot).join(',')}`
        : ''
    );
    process.exit(1);
  }
  if (snapshot.schemaVersion == null) {
    snapshot.schemaVersion = 1;
  }
  if (snapshot.schemaVersion !== 1) {
    console.error(`Неподдерживаемая schemaVersion: ${snapshot.schemaVersion}`);
    process.exit(1);
  }

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
  console.log(`Записано ${META_PATH}, version=${snapshot.version}.`);
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
