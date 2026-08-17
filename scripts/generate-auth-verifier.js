const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERIFIER_KEY = 'REACT_APP_AUTH_VERIFIER';

function hmacLogin(login, password) {
  return crypto
    .createHmac('sha256', password)
    .update(String(login).trim().toLowerCase())
    .digest('hex');
}

function parseEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
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
    result[key] = value;
  }
  return result;
}

function readEnvFile(filePath) {
  try {
    return parseEnv(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return {};
    throw error;
  }
}

function loadAuthEnv(mode) {
  const root = process.cwd();
  const merged = {};
  const files = [
    '.env',
    `.env.${mode}`,
    '.env.local',
    `.env.${mode}.local`,
  ];
  for (const file of files) {
    Object.assign(merged, readEnvFile(path.resolve(root, file)));
  }
  for (const key of ['AUTH_USERS', 'AUTH_LOGIN', 'AUTH_PASSWORD']) {
    if (process.env[key]) merged[key] = process.env[key];
  }
  return merged;
}

function collectUsers(env) {
  const rawUsers = String(env.AUTH_USERS || '').trim();
  if (rawUsers) {
    return rawUsers
      .split(',')
      .map((row) => {
        const i = row.indexOf(':');
        if (i <= 0) return null;
        const login = row.slice(0, i);
        const password = row.slice(i + 1);
        if (!login || !password) return null;
        return { login, password };
      })
      .filter(Boolean);
  }

  if (env.AUTH_LOGIN && env.AUTH_PASSWORD) {
    return [{ login: env.AUTH_LOGIN, password: env.AUTH_PASSWORD }];
  }
  return [];
}

function upsertEnvValue(filePath, key, value) {
  const line = `${key}=${value}`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${line}\n`, 'utf8');
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const nl = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  let found = false;
  const next = lines.map((row) => {
    if (row.startsWith(`${key}=`)) {
      found = true;
      return line;
    }
    return row;
  });
  if (!found) next.push(line);

  fs.writeFileSync(filePath, `${next.join(nl)}${nl}`, 'utf8');
}

function main() {
  const mode = process.argv[2];
  if (mode !== 'development' && mode !== 'production') {
    console.error(
      'Usage: node scripts/generate-auth-verifier.js <development|production>'
    );
    process.exit(1);
  }

  const users = collectUsers(loadAuthEnv(mode));
  if (!users.length) {
    console.error(
      'Нет учётных данных: задайте AUTH_USERS или пару AUTH_LOGIN и AUTH_PASSWORD (без префикса REACT_APP_).'
    );
    process.exit(1);
  }

  const verifier = users
    .map((user) => hmacLogin(user.login, user.password))
    .join(',');
  const outFile = path.resolve(process.cwd(), `.env.${mode}.local`);
  upsertEnvValue(outFile, VERIFIER_KEY, verifier);
  console.log(`Записан ${VERIFIER_KEY} в ${path.basename(outFile)}`);
}

main();
