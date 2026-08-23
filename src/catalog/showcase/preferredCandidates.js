/**
 * Склеивает приоритетный пул (например Ikon) впереди, затем others.
 * Все preferred сохраняются (даже если их больше limit).
 * Others добивают до `limit`, а если preferred уже ≥ limit —
 * всё равно берём до `limit` чужих SKU: иначе сотни Ikon вытесняют микс полки.
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
  const cap = Number(limit) || 0;
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

  const preferredCount = out.length;
  const othersBudget =
    preferredCount >= cap ? cap : Math.max(0, cap - preferredCount);
  let othersAdded = 0;

  for (const item of rest) {
    if (othersAdded >= othersBudget) break;
    const id = item?.id;
    if (id != null) {
      if (usedIds.has(id)) continue;
      usedIds.add(id);
    }
    out.push(item);
    othersAdded += 1;
  }

  return out;
};
