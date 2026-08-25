import indexedDBService from '../../services/indexedDBService';
import { isIkonBrand } from '../core';
import { SHOWCASE_CONFIG } from './showcaseConfig';
import { buildTireShowcase } from './buildTireShowcase';
import { buildDiscShowcase } from './buildDiscShowcase';
import { resolveShowcaseSeed } from './showcaseSeed';

const cache = {
  tires: { workspace: null, version: null, payload: null, promise: null },
  discs: { workspace: null, version: null, payload: null, promise: null },
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
    // RAM: все matching (литые Шинсервиса отбирает buildDiscShowcase).
    candidateLimit: null,
    minAmount: cfg.minAmount,
    supplier: SHOWCASE_CONFIG.showcaseSupplier,
  });
};

/**
 * Загружает кандидатов из RAM-кэша категории (с cache по catalogDataVersion) и строит витрину.
 * Кубик — от catalogSnapshotVersion (+ workspace), не от catalogDataVersion.
 * Showcase state отдельно от searchResults.
 */
export const getCatalogShowcase = async ({
  kind,
  catalogDataVersion = 0,
  catalogSnapshotVersion = '',
  workspaceResetKey = 'guest',
  now = new Date(),
} = {}) => {
  const bucketKey = kind === 'discs' ? 'discs' : 'tires';
  const bucket = cache[bucketKey];
  const cacheVersion = `${workspaceResetKey}:${catalogDataVersion}`;

  if (bucket.workspace !== workspaceResetKey) {
    bucket.workspace = workspaceResetKey;
    bucket.payload = null;
    bucket.promise = null;
  }
  if (bucket.version !== catalogDataVersion) {
    bucket.version = catalogDataVersion;
    bucket.promise = null;
  }

  if (!bucket.promise) {
    const versionAtStart = cacheVersion;
    bucket.promise = (async () => {
      const payload =
        bucketKey === 'tires' ? await loadTirePayload() : await loadDiscPayload();
      if (
        `${bucket.workspace}:${bucket.version}` === versionAtStart
      ) {
        bucket.payload = payload;
      }
      return payload;
    })().catch((error) => {
      if (`${bucket.workspace}:${bucket.version}` === versionAtStart) {
        bucket.promise = null;
      }
      throw error;
    });
  }

  const payload = await (async () => {
    if (bucket.promise) {
      try {
        return await bucket.promise;
      } catch (error) {
        if (bucket.payload) {
          return bucket.payload;
        }
        throw error;
      }
    }
    return bucket.payload;
  })();

  if (!payload) {
    throw new Error('Не удалось загрузить данные витрины');
  }

  const seed = resolveShowcaseSeed({
    catalogSnapshotVersion,
    workspaceResetKey,
    candidates: payload.candidates,
  });

  if (bucketKey === 'tires') {
    return buildTireShowcase({
      candidates: payload.candidates,
      isEmpty: payload.isEmpty,
      now,
      seed,
    });
  }

  return buildDiscShowcase({
    candidates: payload.candidates,
    isEmpty: payload.isEmpty,
    seed,
  });
};
