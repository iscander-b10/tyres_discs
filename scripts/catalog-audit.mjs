/**
 * Stratified catalog reconciliation: upstream (A) → transform (B) → snapshot (C).
 *
 * Usage (from repo root):
 *   node scripts/catalog-audit.mjs
 *   node scripts/catalog-audit.mjs --out reports/catalog-reconcile.csv
 *   node scripts/catalog-audit.mjs --json reports/catalog-reconcile.json
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(__dirname, 'catalog-audit', 'entry.js');
const outfile = path.join(__dirname, 'catalog-audit', '.bundle.cjs');

function parseEnvFile(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function isAbsoluteHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

const envFiles = [
  path.join(root, '.env'),
  path.join(root, '.env.local'),
  path.join(root, '.env.development'),
  path.join(root, '.env.development.local'),
  path.join(root, '.env.production'),
  path.join(root, '.env.production.local'),
  path.join(root, 'yandex', 'catalog-sync', '.env'),
];

let loaded = 0;
const merged = {};
for (const f of envFiles) {
  const map = parseEnvFile(f);
  for (const [key, value] of Object.entries(map)) {
    const prev = merged[key];
    if (prev == null || prev === '') {
      merged[key] = value;
      loaded += 1;
      continue;
    }
    if (isAbsoluteHttpUrl(value) && !isAbsoluteHttpUrl(prev)) {
      merged[key] = value;
    }
  }
}
for (const [key, value] of Object.entries(merged)) {
  if (process.env[key] == null || process.env[key] === '') {
    process.env[key] = value;
  } else if (isAbsoluteHttpUrl(value) && !isAbsoluteHttpUrl(process.env[key])) {
    process.env[key] = value;
  }
}
console.error(`[catalog-audit] loaded env keys from files: ${loaded}`);

const require = createRequire(path.join(root, 'package.json'));
let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  try {
    esbuild = createRequire(path.join(root, 'yandex', 'catalog-sync', 'package.json'))('esbuild');
  } catch {
    console.error('esbuild не найден. Установите: cd yandex/catalog-sync && npm i');
    process.exit(1);
  }
}

console.error('[catalog-audit] bundling…');
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile,
  logLevel: 'error',
});

const extraArgs = process.argv.slice(2);
console.error('[catalog-audit] running (network fetches)…');
const result = spawnSync(process.execPath, [outfile, ...extraArgs], {
  cwd: root,
  env: process.env,
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024,
});

if (result.stderr) process.stderr.write(result.stderr);

const stdout = result.stdout || '';
const jsonIdx = process.argv.indexOf('--json');
const outIdx = process.argv.indexOf('--out');

if (jsonIdx >= 0) {
  const p = process.argv[jsonIdx + 1];
  const abs = path.isAbsolute(p) ? p : path.join(root, p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stdout, 'utf8');
  console.error(`[catalog-audit] wrote JSON ${abs}`);
} else if (outIdx >= 0) {
  console.error('[catalog-audit] CSV is printed to stdout — redirect or parse JSON with --json');
}

process.stdout.write(stdout);
if (result.status) process.exit(result.status);