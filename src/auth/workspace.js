import { createAccountId, normalizeLogin } from './crypto';

function readStoreMap(rawStoreMap) {
  if (!rawStoreMap) return {};

  try {
    const parsed = JSON.parse(rawStoreMap);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function readStoreId(storeMap, key) {
  if (!key || !Object.prototype.hasOwnProperty.call(storeMap, key)) return null;
  const storeId = storeMap[key];
  return typeof storeId === 'string' && storeId.trim() ? storeId.trim() : null;
}

export function resolveStoreId({
  accountId,
  login,
  storeMap = process.env.REACT_APP_STORE_MAP,
  fallbackStoreId = process.env.REACT_APP_STORE_ID,
}) {
  const parsedStoreMap = readStoreMap(storeMap);
  return (
    readStoreId(parsedStoreMap, accountId) ??
    readStoreId(parsedStoreMap, normalizeLogin(login)) ??
    String(fallbackStoreId ?? '').trim()
  );
}

export async function createWorkspace(login, config = {}) {
  const normalizedLogin = normalizeLogin(login);
  const accountId = await createAccountId(normalizedLogin);

  return {
    login: normalizedLogin,
    accountId,
    storeId: resolveStoreId({
      ...config,
      accountId,
      login: normalizedLogin,
    }),
  };
}
