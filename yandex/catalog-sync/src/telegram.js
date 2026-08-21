/**
 * Опциональное уведомление в Telegram.
 * Без TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — skip без ошибки.
 * Сбой отправки не пробрасывается (снимок уже записан).
 */

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

/**
 * @param {string} text
 * @returns {Promise<{ sent: boolean, skipped?: boolean, error?: string }>}
 */
export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return { sent: false, skipped: true };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text).slice(0, 3500),
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, error: `HTTP ${res.status} ${body.slice(0, 200)}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err?.message || String(err) };
  }
}

/**
 * Короткое сообщение по итогу слота.
 * @param {{ storeId: string, version: string, slot: string, okCount: number, failCount: number, suppliers: Array<{ key: string, ok: boolean }> }} meta
 */
export function formatSyncTelegramMessage(meta) {
  const fails = (meta.suppliers || [])
    .filter((s) => !s.ok)
    .map((s) => s.key)
    .join(',');
  const failPart = fails ? ` fail:${fails}` : '';
  return `catalog ${meta.storeId} ${meta.slot} ok=${meta.okCount} fail=${meta.failCount}${failPart}`;
}
