import {
  DEFAULT_STORE_PROFILE_ID,
  STORE_PROFILES,
  getStoreProfile,
} from '../config/stores';

function resolvePricing(storeId) {
  const profile = getStoreProfile(storeId);
  return (profile ?? STORE_PROFILES[DEFAULT_STORE_PROFILE_ID]).pricing;
}

export const getMargin = (brand, storeId) => {
  const brandNormalized = brand.trim().toLowerCase();
  const pricing = resolvePricing(storeId);

  if (pricing.russianBrands.find((b) => b.toLowerCase() === brandNormalized)) {
    return pricing.tyreMargins.russian;
  }
  if (pricing.importBrands.find((b) => b.toLowerCase() === brandNormalized)) {
    return pricing.tyreMargins.import;
  }

  return pricing.tyreMargins.default;
};

export const getDiscMargin = (storeId) => resolvePricing(storeId).discMargin;

export const calculateSellingPrice = (price, margin) => {
  if (!price || price <= 0) return 0;
  const sellingPrice = price * (1 + margin / 100);
  return Math.round(sellingPrice);
};
