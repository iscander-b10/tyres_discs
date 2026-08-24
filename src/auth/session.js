import { hmacLogin, normalizeLogin, unwrapPassword, wrapPassword } from './crypto';
import { getDeviceFingerprint } from './fingerprint';
import { appLog } from '../utils/appLog';

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

const alwaysCurrent = () => true;

export async function login(email, password, { isCurrent = alwaysCurrent } = {}) {
  if (!VERIFIERS.length || !password) return false;

  const loginName = normalizeLogin(email);
  if (!loginName) return false;

  const digest = await hmacLogin(loginName, password);
  if (!hasVerifier(digest) || !isCurrent()) return false;

  try {
    const secret = await wrapPassword(password, getDeviceFingerprint());
    if (!isCurrent()) return false;

    writeStorage(LOGIN_KEY, loginName);
    writeStorage(SECRET_KEY, secret);
  } catch (error) {
    appLog.error({
      code: 'auth.infra_failed',
      domain: 'auth',
      message: 'Auth session persist failed',
      error,
      context: { op: 'login_persist' },
    });
    if (isCurrent()) logout();
    return false;
  }
  return { login: loginName };
}

export async function restore({ isCurrent = alwaysCurrent } = {}) {
  if (!VERIFIERS.length) {
    if (isCurrent()) logout();
    return null;
  }

  const loginName = readStorageWithMigration(LOGIN_KEY, LEGACY_LOGIN_KEY);
  const secret = readStorageWithMigration(SECRET_KEY, LEGACY_SECRET_KEY);
  if (!loginName || !secret) {
    if (isCurrent()) logout();
    return null;
  }

  try {
    const password = await unwrapPassword(secret, getDeviceFingerprint());
    const digest = await hmacLogin(loginName, password);
    if (!isCurrent()) return null;
    if (!hasVerifier(digest)) {
      logout();
      return null;
    }
    return { login: normalizeLogin(loginName) };
  } catch {
    if (isCurrent()) logout();
    return null;
  }
}

export function logout() {
  removeStorage(LOGIN_KEY);
  removeStorage(SECRET_KEY);
  removeStorage(LEGACY_LOGIN_KEY);
  removeStorage(LEGACY_SECRET_KEY);
}
