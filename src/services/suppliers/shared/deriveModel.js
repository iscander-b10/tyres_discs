/** Trailing load+speed like 92H or 91/89V (common in tyre titles). */
const TITLE_INDEX_RE = /(\d{2,3}(?:\/\d{2,3})?)([A-Za-z])\s*$/;

/**
 * Model from a display title: strip leading brand, optionally trailing load/speed.
 * Shared by transformers (explicit `model`) and catalog UI fallback.
 */
export const deriveModelFromTitle = (title, brand, { stripIndices = true } = {}) => {
  let rest = String(title || '').trim();
  if (!rest) return null;

  const brandStr = brand != null ? String(brand).trim() : '';
  if (brandStr && rest.toLowerCase().startsWith(brandStr.toLowerCase())) {
    rest = rest.slice(brandStr.length).trim();
  }

  if (stripIndices) {
    rest = rest.replace(TITLE_INDEX_RE, '').trim();
  }

  return rest || null;
};

/** Trim to non-empty model string, else null. */
export const normalizeModelText = (model) => {
  const text = String(model ?? '').trim();
  return text || null;
};
