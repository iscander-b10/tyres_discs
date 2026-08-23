import { hmacLogin, normalizeLogin, unwrapPassword, wrapPassword } from './crypto';
import { getDeviceFingerprint } from './fingerprint';

const LOGIN_KEY = 'auth.login.v1';
const SECRET_KEY = 'auth.secret.v1';
const LEGACY_LOGIN_KEY = 'ivanor-auth-login';
const LEGACY_SECRET_KEY = 'ivanor-auth-secret';

const VERIFIERS = String(process.env.REACT_APP_AUTH_VERIFIER || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStorageWithMigration(newKey, legacyKey) {
  const value = readStorage(newKey);
  if (value) return value;

  const legacy = readStorage(legacyKey);
  if (!legacy) return null;

  try {
    writeStorage(newKey, legacy);
  } catch {
    return legacy;
  }
  return legacy;
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, value);
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function hasVerifier(digest) {
  return VERIFIERS.includes(digest);
}

export async function login(email, password) {
  if (!VERIFIERS.length || !password) return false;

  const loginName = normalizeLogin(email);
  if (!loginName) return false;

  const digest = await hmacLogin(loginName, password);
  if (!hasVerifier(digest)) return false;

  try {
    writeStorage(LOGIN_KEY, loginName);
    writeStorage(SECRET_KEY, await wrapPassword(password, getDeviceFingerprint()));
  } catch {
    logout();
    return false;
  }
  return { login: loginName };
}

export async function restore() {
  if (!VERIFIERS.length) {
    logout();
    return null;
  }

  const loginName = readStorageWithMigration(LOGIN_KEY, LEGACY_LOGIN_KEY);
  const secret = readStorageWithMigration(SECRET_KEY, LEGACY_SECRET_KEY);
  if (!loginName || !secret) {
    logout();
    return null;
  }

  try {
    const password = await unwrapPassword(secret, getDeviceFingerprint());
    const digest = await hmacLogin(loginName, password);
    if (!hasVerifier(digest)) {
      logout();
      return null;
    }
    return { login: loginName };
  } catch {
    logout();
    return null;
  }
}

export function logout() {
  removeStorage(LOGIN_KEY);
  removeStorage(SECRET_KEY);
  removeStorage(LEGACY_LOGIN_KEY);
  removeStorage(LEGACY_SECRET_KEY);
}
