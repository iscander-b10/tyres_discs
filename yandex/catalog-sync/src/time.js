/** Слоты Timer (Europe/Moscow). */
export const SYNC_SLOTS = ['08:00', '09:30', '12:00', '15:00'];

/**
 * Части даты/времени в Europe/Moscow.
 * @returns {{ year: string, month: string, day: string, hour: string, minute: string, second: string }}
 */
export function getMoscowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  // en-GB may use hour "24" at midnight
  if (map.hour === '24') map.hour = '00';
  return map;
}

/**
 * ISO версии слота: `2026-08-20T08:00:00+03:00`
 * @param {string} slot `HH:MM`
 * @param {Date} [now]
 */
export function versionForSlot(slot, now = new Date()) {
  const m = getMoscowParts(now);
  const [hh, mm] = String(slot).split(':');
  const hour = String(hh).padStart(2, '0');
  const minute = String(mm || '00').padStart(2, '0');
  return `${m.year}-${m.month}-${m.day}T${hour}:${minute}:00+03:00`;
}

/**
 * Определяет слот из payload Timer / query / ближайший прошедший.
 * @param {string} [explicit]
 */
export function resolveSlot(explicit) {
  const raw = String(explicit || '').trim();
  if (SYNC_SLOTS.includes(raw)) return raw;

  const m = getMoscowParts();
  const minutes = Number(m.hour) * 60 + Number(m.minute);
  let chosen = SYNC_SLOTS[0];
  for (const slot of SYNC_SLOTS) {
    const [h, min] = slot.split(':').map(Number);
    if (h * 60 + min <= minutes) chosen = slot;
  }
  return chosen;
}
