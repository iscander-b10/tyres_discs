/**
 * Runner: load .env → esbuild bundle → execute catalog loss audit.
 *
 * Usage (from repo root):
 *   node scripts/audit-catalog-loss.mjs
 *   node scripts/audit-catalog-loss.mjs --out reports/catalog-loss-audit.json
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(__dirname, 'audit-catalog-loss', 'entry.js');
const outfile = path.join(__dirname, 'audit-catalog-loss', '.bundle.cjs');

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

/**
 * Audit нуждается в абсолютных upstream URL (Node fetch без CRA proxy).
 * Порядок: .env → development → production (absolute перекрывает relative).
 */
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
    // Absolute URL wins over relative /api/... (dev proxy paths).
    if (isAbsoluteHttpUrl(value) && !isAbsoluteHttpUrl(prev)) {
      merged[key] = value;
    }
  }
}
for (const [key, value] of Object.entries(merged)) {
  if (process.env[key] == null || process.env[key] === '') {
    process.env[key] = value;
  } else if (
    isAbsoluteHttpUrl(value) &&
    !isAbsoluteHttpUrl(process.env[key])
  ) {
    process.env[key] = value;
  }
}
console.error(`[audit-runner] loaded env keys from files: ${loaded} (absolute URLs preferred)`);

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

console.error('[audit-runner] bundling…');
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile,
  logLevel: 'error',
  // CRA modules may import process.env.REACT_APP_* — leave as runtime process.env
});

const outIdx = process.argv.indexOf('--out');
const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : null;

console.error('[audit-runner] running audit (network fetches)…');
const result = spawnSync(process.execPath, [outfile], {
  cwd: root,
  env: process.env,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

if (result.stderr) {
  process.stderr.write(result.stderr);
}

const stdout = result.stdout || '';
if (outPath) {
  const abs = path.isAbsolute(outPath) ? outPath : path.join(root, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stdout, 'utf8');
  console.error(`[audit-runner] wrote ${abs}`);
}

process.stdout.write(stdout);
if (result.status) process.exit(result.status);
