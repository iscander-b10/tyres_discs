import indexedDBService from '../../services/indexedDBService';
import { isIkonBrand } from '../../components/shared/ikonPromoBadges';
import { SHOWCASE_CONFIG } from './showcaseConfig';
import { buildTireShowcase } from './buildTireShowcase';
import { buildDiscShowcase } from './buildDiscShowcase';

const cache = {
  tires: { version: null, payload: null, promise: null },
  discs: { version: null, payload: null, promise: null },
};

const loadTirePayload = async () => {
  const cfg = SHOWCASE_CONFIG.tires;
  return indexedDBService.collectTireShowcaseCandidates({
    candidateLimit: cfg.candidateLimit,
    minAmount: cfg.minAmount,
    supplier: SHOWCASE_CONFIG.showcaseSupplier,
    // Ikon первыми в пуле: уникальные модели не отрезаются ранним лимитом 480.
    preferItem: isIkonBrand,
  });
};

const loadDiscPayload = async () => {
  const cfg = SHOWCASE_CONFIG.discs;
  return indexedDBService.collectDiscShowcaseCandidates({
    candidateLimit: cfg.candidateLimit,
    minAmount: cfg.minAmount,
    supplier: SHOWCASE_CONFIG.showcaseSupplier,
  });
};

/**
 * Загружает кандидатов из IDB (с cache по catalogDataVersion) и строит витрину.
 * Showcase state отдельно от searchResults.
 */
export const getCatalogShowcase = async ({
  kind,
  catalogDataVersion = 0,
  now = new Date(),
} = {}) => {
  const bucketKey = kind === 'discs' ? 'discs' : 'tires';
  const bucket = cache[bucketKey];

  if (bucket.version !== catalogDataVersion) {
    bucket.version = catalogDataVersion;
    bucket.payload = null;
    bucket.promise = null;
  }

  if (!bucket.promise) {
    const versionAtStart = catalogDataVersion;
    bucket.promise = (async () => {
      const payload =
        bucketKey === 'tires' ? await loadTirePayload() : await loadDiscPayload();
      if (bucket.version === versionAtStart) {
        bucket.payload = payload;
      }
      return payload;
    })().catch((error) => {
      if (bucket.version === versionAtStart) {
        bucket.promise = null;
      }
      throw error;
    });
  }

  const payload = await bucket.promise;

  if (bucketKey === 'tires') {
    return buildTireShowcase({
      candidates: payload.candidates,
      isEmpty: payload.isEmpty,
      now,
    });
  }

  return buildDiscShowcase({
    candidates: payload.candidates,
    isEmpty: payload.isEmpty,
  });
};
