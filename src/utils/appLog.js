/**
 * Тонкий structured log для DevTools Console.
 * UX не затрагивает — только console для разработчика.
 */

const FORBIDDEN_CONTEXT_KEYS = new Set([
  'password',
  'secret',
  'authSecret',
  'wrappedSecret',
  'fingerprint',
  'snapshot',
  'commands',
  'items',
  'envelope',
  'raw',
  'token',
  'authorization',
]);

const SENSITIVE_KEY_RE =
  /password|secret|fingerprint|token|authorization|cookie|wrapped/i;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPrimitive = (value) =>
  value == null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

/**
 * Ожидаемые гонки / operational — не писать как defect через appLog.error.
 */
export function isExpectedOperationalError(error) {
  const name = error?.name;
  return name === 'AbortError' || name === 'StaleCatalogStoreError';
}

export function isQuotaExceededError(error) {
  if (!error) return false;
  if (error.name === 'QuotaExceededError') return true;
  if (error.code === 22 || error.code === 1014) return true;
  return /quotaexceeded|quota.?exceeded/i.test(String(error.message || ''));
}

export function sanitizeLogContext(context) {
  if (!isPlainObject(context)) return undefined;

  const out = {};
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEYS.has(key) || SENSITIVE_KEY_RE.test(key)) {
      continue;
    }
    if (isPrimitive(value)) {
      out[key] = value;
      continue;
    }
    if (
      Array.isArray(value) &&
      value.every(isPrimitive) &&
      value.length <= 20
    ) {
      out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function buildEntry({
  level,
  code,
  domain,
  message,
  error,
  context,
  expected = false,
}) {
  const entry = {
    code: String(code || ''),
    domain: String(domain || ''),
    level,
    expected: Boolean(expected),
    message: String(message || ''),
  };

  if (error != null) {
    if (error instanceof Error || (typeof error === 'object' && error.name)) {
      entry.errorName = error.name || 'Error';
      entry.errorMessage =
        error.message != null ? String(error.message) : String(error);
      if (process.env.NODE_ENV === 'development' && error.stack) {
        entry.stack = error.stack;
      }
    } else {
      entry.errorMessage = String(error);
    }
  }

  const safeContext = sanitizeLogContext(context);
  if (safeContext) {
    entry.context = safeContext;
  }

  return entry;
}

function emit(level, fields) {
  const entry = buildEntry({ ...fields, level });
  if (level === 'warn') {
    console.warn('[app]', entry);
  } else {
    console.error('[app]', entry);
  }
  return entry;
}

export const appLog = {
  error(fields) {
    return emit('error', fields);
  },
  warn(fields) {
    return emit('warn', fields);
  },
};

export default appLog;
