import { deriveModelFromTitle } from '../../services/suppliers/shared/deriveModel';

const hasText = (value) => value != null && String(value).trim() !== '';

const pickText = (...values) => {
  for (const value of values) {
    if (hasText(value)) return String(value).trim();
  }
  return null;
};

export const resolveCatalogModel = (item) => {
  if (!item) return null;
  const explicit = pickText(item.model);
  if (explicit) return explicit;
  return deriveModelFromTitle(item.title, item.brand, { stripIndices: true });
};
