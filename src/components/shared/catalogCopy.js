/** Shared catalog UI copy — keep card and modal in sync. */

export { resolveCatalogModel } from '../../catalog/core';

const isValidPrice = (value) => {
  if (value == null || value === '') return false;
  const num =
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(num) && num > 0;
};

export const formatPriceDisplay = (value) => {
  if (!isValidPrice(value)) return '—';
  const num =
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return `${num.toLocaleString('ru-RU')}\u00A0руб.`;
};

/**
 * Internet price: supplier websitePrice when present;
 * otherwise a dash mark — we cannot invent a price or markup here.
 */
const formatWebsitePriceDisplay = (item) => {
  if (isValidPrice(item?.websitePrice)) {
    return formatPriceDisplay(item.websitePrice);
  }
  return '—';
};

/** Row labels for price cells (card + modal + basket). */
const CATALOG_PRICE_LABELS = {
  b2b: 'B2B',
  website: 'Интернет цена',
  selling: 'Цена',
};

/** Hover tooltip titles for channel price cells (basket totals, etc.). */
export const CATALOG_PRICE_TOOLTIPS = {
  b2b: 'B2B цена',
  website: 'Интернет цена',
};

/**
 * Display-only price cells for card/modal strips.
 * Manager: always 3 stable cells — B2B | Website | store (invalid → «—»).
 * Client: store only.
 */
export const getCatalogPriceStripItems = (item, { isClientMode = false } = {}) => {
  const sellingValue = formatPriceDisplay(item?.sellingPrice ?? item?.price);

  if (isClientMode) {
    return [
      {
        key: 'selling',
        label: CATALOG_PRICE_LABELS.selling,
        value: sellingValue,
        primary: true,
      },
    ];
  }

  return [
    {
      key: 'b2b',
      label: CATALOG_PRICE_LABELS.b2b,
      value: formatPriceDisplay(item?.price),
      primary: false,
    },
    {
      key: 'website',
      label: CATALOG_PRICE_LABELS.website,
      value: formatWebsitePriceDisplay(item),
      primary: false,
    },
    {
      key: 'selling',
      label: CATALOG_PRICE_LABELS.selling,
      value: sellingValue,
      primary: true,
    },
  ];
};

const hasText = (value) => value != null && String(value).trim() !== '';

const pickText = (...values) => {
  for (const value of values) {
    if (hasText(value)) return String(value).trim();
  }
  return null;
};

/** Trailing load+speed like 92H or 91/89V (common in tyre titles). */
const TITLE_INDEX_RE = /(\d{2,3}(?:\/\d{2,3})?)([A-Za-z])\s*$/;

const deriveIndicesFromTitle = (title) => {
  const match = String(title || '').match(TITLE_INDEX_RE);
  if (!match) return { loadIndex: null, speedIndex: null };
  return {
    loadIndex: match[1],
    speedIndex: match[2].toUpperCase(),
  };
};

/** Tyres: width/profile/diameter. Discs (no profile): full sizeTitle. */
export const formatCatalogSizeDisplay = (item) => {
  if (!item) return null;
  const width = item.width;
  const profile = item.profile;
  const diameter = item.diameter;
  if (hasText(width) && hasText(profile) && hasText(diameter)) {
    return `${width}/${profile}${diameter}`;
  }
  return pickText(item.sizeTitle);
};

export const formatCatalogStockDisplay = (amount) => {
  if (amount == null || amount === '') return null;
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) return `${amount} шт.`;
  return `${num.toLocaleString('ru-RU')}\u00A0шт.`;
};

export const resolveCatalogLoadIndex = (item) => {
  if (!item) return null;
  const explicit = pickText(item.loadIndex, item.load_index, item.indexLoad);
  if (explicit) return explicit;

  const combined = pickText(item.load_speed_index, item.loadSpeedIndex);
  if (combined) {
    const match = combined.match(TITLE_INDEX_RE);
    if (match) return match[1];
    const digits = combined.match(/\d{2,3}(?:\/\d{2,3})?/);
    if (digits) return digits[0];
  }

  return deriveIndicesFromTitle(item.title).loadIndex;
};

export const resolveCatalogSpeedIndex = (item) => {
  if (!item) return null;
  const explicit = pickText(item.speedIndex, item.speed_index, item.indexSpeed);
  if (explicit) return explicit;

  const combined = pickText(item.load_speed_index, item.loadSpeedIndex);
  if (combined) {
    const match = combined.match(TITLE_INDEX_RE);
    if (match) return match[2].toUpperCase();
    const letter = combined.match(/[A-Za-z]\s*$/);
    if (letter) return letter[0].trim().toUpperCase();
  }

  return deriveIndicesFromTitle(item.title).speedIndex;
};
