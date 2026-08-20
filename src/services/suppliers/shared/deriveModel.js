/** Trailing load+speed like 92H, 91/89V, or Cyrillic speed letter (91Т). */
export const TITLE_INDEX_RE = /(\d{2,3}(?:\/\d{2,3})?)([A-Za-zА-Яа-яЁё])\s*$/u;

const normalizeSpeedLetter = (letter) => {
  const ch = String(letter || '');
  if (ch === 'Т' || ch === 'т') return 'T';
  if (!/^[A-Za-z]$/.test(ch)) return '';
  return ch.toUpperCase();
};

/**
 * Extract trailing load+speed from a title fragment; Cyrillic Т → T.
 * @returns {{ indices: string, rest: string }}
 */
export const extractLoadSpeedFromTitle = (title) => {
  const str = String(title || '').trim();
  if (!str) return { indices: '', rest: '' };

  const match = str.match(TITLE_INDEX_RE);
  if (!match) return { indices: '', rest: str };

  const letter = normalizeSpeedLetter(match[2]);
  if (!letter) return { indices: '', rest: str };

  return {
    indices: `${match[1]}${letter}`,
    rest: str.slice(0, match.index).trim(),
  };
};

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
    rest = extractLoadSpeedFromTitle(rest).rest;
  }

  return rest || null;
};

/** Trim to non-empty model string, else null. */
export const normalizeModelText = (model) => {
  const text = String(model ?? '').trim();
  return text || null;
};
