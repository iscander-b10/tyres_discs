/** Hang-guard, не SLA: open/getAll без onsuccess не должны оставлять «Найти» pending. */
export const IDB_OPEN_TIMEOUT_MS = 15_000;
export const IDB_READ_TIMEOUT_MS = 30_000;
export const CATALOG_SEARCH_TIMEOUT_MS = 30_000;

export function createCatalogTimeoutError() {
  const error = new Error('Каталог не отвечает. Попробуйте ещё раз.');
  error.name = 'TimeoutError';
  return error;
}

export function withTimeout(promise, ms, onTimeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = createCatalogTimeoutError();
      onTimeout?.(error);
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
