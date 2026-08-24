/**
 * Стабильный кубик витрины: один seed на snapshot.version (+ workspace),
 * без Math.random / Date.now в прод-пути.
 */

/** FNV-1a 32-bit → uint32. */
export const hashSeed = (value) => {
  let h = 2166136261;
  const s = String(value ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32: детерминированный PRNG из uint32 / строки. */
export const createSeededRandom = (seed) => {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Seed полки: catalogSnapshotVersion + workspace.
 * Пустая version → стабильный fallback от id уже загруженных кандидатов.
 */
export const resolveShowcaseSeed = ({
  catalogSnapshotVersion = '',
  workspaceResetKey = 'guest',
  candidates = [],
} = {}) => {
  const workspace = String(workspaceResetKey || 'guest');
  const version = String(catalogSnapshotVersion ?? '').trim();
  if (version) {
    return `${workspace}|snap:${version}`;
  }

  let h = 2166136261;
  const list = Array.isArray(candidates) ? candidates : [];
  for (const item of list) {
    const id = String(item?.id ?? '');
    for (let i = 0; i < id.length; i += 1) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x7c;
    h = Math.imul(h, 16777619);
  }
  return `${workspace}|data:${h >>> 0}`;
};

/** Fisher–Yates с seeded PRNG. Один seed → та же перестановка. */
export const shuffleItems = (items, seed) => {
  const arr = [...(Array.isArray(items) ? items : [])];
  const random = createSeededRandom(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
