#!/usr/bin/env node
/**
 * Локальная сборка frozen snapshot для /demo с анонимизированными именами поставщиков.
 *
 * Загружает upstream через loadAllSuppliersData (как catalog-sync), но пишет только
 * в public/demo/. Не вызывает runCatalogSync и не трогает Object Storage.
 *
 * Перед запуском временно подмените label/supplier в loadAll.js и transformers.js
 * (см. docs/14-development/update-demo-snapshot.md), затем откатите после записи.
 *
 *   npm run demo:build-local
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const entry = path.join(__dirname, 'build-demo-snapshot-local', 'entry.js');
const outfile = path.join(__dirname, 'build-demo-snapshot-local', '.bundle.cjs');

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

function isAbsoluteHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

[
  path.join(ROOT, '.env'),
  path.join(ROOT, '.env.local'),
  path.join(ROOT, '.env.development'),
  path.join(ROOT, '.env.development.local'),
  path.join(ROOT, '.env.production'),
  path.join(ROOT, '.env.production.local'),
  path.join(ROOT, 'yandex', 'catalog-sync', '.env'),
].forEach((filePath) => {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const prev = process.env[key];
    if (prev == null || prev === '') {
      process.env[key] = value;
    } else if (isAbsoluteHttpUrl(value) && !isAbsoluteHttpUrl(prev)) {
      process.env[key] = value;
    }
  }
});

let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  try {
    esbuild = require(path.join(
      ROOT,
      'yandex',
      'catalog-sync',
      'node_modules',
      'esbuild'
    ));
  } catch {
    console.error('esbuild не найден. Установите: cd yandex/catalog-sync && npm i');
    process.exit(1);
  }
}

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile,
  logLevel: 'error',
});

const result = spawnSync(process.execPath, [outfile], {
  cwd: ROOT,
  env: process.env,
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
