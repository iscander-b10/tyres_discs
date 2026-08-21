/**
 * Склеивает приоритетный пул (например Ikon) впереди, затем others до limit.
 * Все preferred сохраняются (даже если их больше limit), others добивают до limit.
 * @param {object[]} preferred
 * @param {object[]} others
 * @param {number} limit
 */
export const mergePreferredShowcaseCandidates = (
  preferred,
  others,
  limit = 480
) => {
  const pref = Array.isArray(preferred) ? preferred : [];
  const rest = Array.isArray(others) ? others : [];
  const usedIds = new Set();
  const out = [];

  for (const item of pref) {
    const id = item?.id;
    if (id != null) {
      if (usedIds.has(id)) continue;
      usedIds.add(id);
    }
    out.push(item);
  }

  const target = Math.max(Number(limit) || 0, out.length);
  for (const item of rest) {
    if (out.length >= target) break;
    const id = item?.id;
    if (id != null) {
      if (usedIds.has(id)) continue;
      usedIds.add(id);
    }
    out.push(item);
  }

  return out;
};
