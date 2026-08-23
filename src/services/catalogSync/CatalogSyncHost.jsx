import { useEffect, useRef } from 'react';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import indexedDBService from '../indexedDBService';
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
  const { isWorkspaceReady, workspace } = useAuth();
  const notifyRef = useRef(notifyCatalogApplied);
  notifyRef.current = notifyCatalogApplied;

  useEffect(() => {
    const storeId = workspace?.storeId;
    if (
      !isWorkspaceReady ||
      !storeId ||
      !isCatalogSyncConfigured(storeId)
    ) {
      return undefined;
    }

    let cancelled = false;
    let syncing = false;
    let slotTimer = null;
    const storeGeneration = indexedDBService.setActiveStore(storeId);
    const isCurrent = () =>
      !cancelled &&
      indexedDBService.isActiveStore(storeId, storeGeneration);

    const run = async (reason) => {
      if (!isCurrent() || syncing) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // слот в фоне — подождём visibility; старт/online всё равно могут вызвать при visible
        if (reason === 'slot') return;
      }

      syncing = true;
      try {
        const result = await checkAndSyncCatalog({ storeId });
        if (isCurrent() && result.status === 'applied') {
          notifyRef.current?.(result.version, storeId);
        }
      } finally {
        syncing = false;
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
  }, [isWorkspaceReady, workspace?.storeId]);

  return null;
}
