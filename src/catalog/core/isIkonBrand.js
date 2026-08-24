/** Collapse brand spellings: Ikon / Ikon Tyres / IKON TYRES → ikon */
const normalizeIkonBrandToken = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^ikon(?:\s+tyres?)?$/, 'ikon');

export const isIkonBrand = (item) => {
  if (!item) return false;

  const brand = normalizeIkonBrandToken(item.brand);
  if (brand === 'ikon') return true;

  // Fallback when brand is missing/odd but title still starts with Ikon.
  const title = String(item.title || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return /^ikon(?:\s+tyres?)?\b/.test(title);
};
