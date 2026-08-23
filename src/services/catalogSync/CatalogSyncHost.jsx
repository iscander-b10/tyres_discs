import { useEffect, useRef } from 'react';
import { useAppShell } from '../../app/AppShellContext';
import {
  checkAndSyncCatalog,
  isCatalogSyncConfigured,
  msUntilNextSyncCheck,
} from './catalogSyncService';

/**
 * Подписка на автосинхронизацию каталога (meta → snapshot → IndexedDB).
 * Монтировать внутри AppShellProvider.
 */
export function CatalogSyncHost() {
  const { notifyCatalogApplied } = useAppShell();
  const notifyRef = useRef(notifyCatalogApplied);
  notifyRef.current = notifyCatalogApplied;
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!isCatalogSyncConfigured()) return undefined;

    let cancelled = false;
    let slotTimer = null;

    const run = async (reason) => {
      if (cancelled || syncingRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // слот в фоне — подождём visibility; старт/online всё равно могут вызвать при visible
        if (reason === 'slot') return;
      }

      syncingRef.current = true;
      try {
        const result = await checkAndSyncCatalog();
        if (!cancelled && result.status === 'applied') {
          notifyRef.current?.(result.version);
        }
      } finally {
        syncingRef.current = false;
      }
    };

    const scheduleSlot = () => {
      if (slotTimer) clearTimeout(slotTimer);
      const delay = Math.max(1000, msUntilNextSyncCheck());
      slotTimer = setTimeout(async () => {
        await run('slot');
        if (!cancelled) scheduleSlot();
      }, delay);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        run('visibility');
      }
    };

    const onOnline = () => {
      run('online');
    };

    run('start');
    scheduleSlot();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      if (slotTimer) clearTimeout(slotTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return null;
}
