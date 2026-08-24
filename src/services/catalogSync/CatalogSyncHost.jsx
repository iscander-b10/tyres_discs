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
 *
 * Writer lock внутри checkAndSyncCatalog. После sync / при visibility
 * бампит витрину, если persisted IDB-версия новее уже показанной.
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
    let lastNotifiedVersion = '';
    const abortController = new AbortController();
    const storeGeneration = indexedDBService.setActiveStore(storeId);
    const isCurrent = () =>
      !cancelled &&
      indexedDBService.isActiveStore(storeId, storeGeneration);

    const readPersistedVersion = async () => {
      try {
        return (await indexedDBService.getPersistedCatalogVersion()) || '';
      } catch {
        return '';
      }
    };

    /** UI догоняет IDB даже при up-to-date / skipped / commit без post. */
    const bumpIfIdbAhead = async () => {
      if (!isCurrent()) return;
      const version = await readPersistedVersion();
      if (!isCurrent() || !version) return;
      if (lastNotifiedVersion && version <= lastNotifiedVersion) return;
      lastNotifiedVersion = version;
      notifyRef.current?.(version, storeId);
    };

    const run = async (reason) => {
      if (!isCurrent() || syncing) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // слот в фоне — подождём visibility; старт/online всё равно могут вызвать при hidden
        if (reason === 'slot') return;
      }

      syncing = true;
      try {
        await checkAndSyncCatalog({
          storeId,
          signal: abortController.signal,
        });
        await bumpIfIdbAhead();
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
      abortController.abort();
      if (slotTimer) clearTimeout(slotTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [isWorkspaceReady, workspace?.storeId]);

  return null;
}
