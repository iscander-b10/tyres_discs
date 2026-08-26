import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppShell } from '../../app/AppShellContext';
import {
  CATALOG_BOOTSTRAP_WAITING_LABEL,
  createBlockingBootstrap,
  createErrorBootstrap,
  createReadyBootstrap,
  isCatalogBootstrapIgnorableSkip,
  labelFromSyncProgress,
  nextBlockingProgress,
  resolveCatalogBootstrapError,
} from '../../app/catalogBootstrap';
import { useAuth } from '../../auth/AuthContext';
import { isDemoPath } from '../../app/paths';
import indexedDBService from '../indexedDBService';
import {
  checkAndSyncCatalog,
  isCatalogSyncConfigured,
  msUntilNextSyncCheck,
} from './catalogSyncService';

const WARMUP_PROGRESS = {
  tires: 97,
  discs: 99,
};

async function readCatalogEmpty() {
  try {
    return await indexedDBService.isCatalogEmpty();
  } catch {
    return true;
  }
}

async function warmupColdStartCache(onStep) {
  await indexedDBService.warmupCatalogReadCache({
    tires: true,
    discs: true,
    onStep,
  });
}

/**
 * Подписка на автосинхронизацию каталога (meta → snapshot → IndexedDB).
 * Монтировать внутри AppShellProvider.
 *
 * Writer lock внутри checkAndSyncCatalog. Cold start (пустой IDB) ставит
 * blocking в AppShell до витрины; warm start (непустой IDB / refresh) идёт
 * тихо — шторку не открываем даже на кадр проверки isCatalogEmpty.
 */
export function CatalogSyncHost() {
  const {
    notifyCatalogApplied,
    setCatalogBootstrap,
    registerCatalogBootstrapRetry,
  } = useAppShell();
  const { isWorkspaceReady, workspace } = useAuth();
  const { pathname } = useLocation();
  const notifyRef = useRef(notifyCatalogApplied);
  notifyRef.current = notifyCatalogApplied;
  const setBootstrapRef = useRef(setCatalogBootstrap);
  setBootstrapRef.current = setCatalogBootstrap;
  const retryRef = useRef(null);

  useEffect(() => {
    if (!registerCatalogBootstrapRetry) return undefined;
    return registerCatalogBootstrapRetry(() => {
      retryRef.current?.();
    });
  }, [registerCatalogBootstrapRetry]);

  useEffect(() => {
    const storeId = workspace?.storeId;
    if (!isWorkspaceReady || !storeId || isDemoPath(pathname)) {
      return undefined;
    }

    let cancelled = false;
    let syncing = false;
    let slotTimer = null;
    let lastNotifiedVersion = '';
    // До isCatalogEmpty() не считаем cold start: иначе warm refresh мелькает шторкой.
    let blockingColdStart = false;
    const abortController = new AbortController();
    const storeGeneration = indexedDBService.setActiveStore(storeId);
    const isCurrent = () =>
      !cancelled &&
      indexedDBService.isActiveStore(storeId, storeGeneration);
    const configured = isCatalogSyncConfigured(storeId);

    const setBootstrap = (update) => {
      if (!isCurrent()) return;
      setBootstrapRef.current?.(update);
    };

    const applySyncProgress = (event) => {
      if (!blockingColdStart) return;
      setBootstrap((current) => ({
        phase: 'blocking',
        progress: nextBlockingProgress(current?.progress, event?.progress),
        label: labelFromSyncProgress(event, current?.label),
        ...(current?.waitForShowcase ? { waitForShowcase: true } : {}),
      }));
    };

    const markReady = () => {
      blockingColdStart = false;
      setBootstrap((current) =>
        createReadyBootstrap({
          waitForShowcase: Boolean(current?.waitForShowcase),
        })
      );
    };

    const markError = (error) => {
      if (!blockingColdStart) return;
      setBootstrap(createErrorBootstrap(error));
    };

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

    const finishColdStart = async (result) => {
      if (!blockingColdStart || !isCurrent()) return;
      if (isCatalogBootstrapIgnorableSkip(result)) return;
      if (
        result?.status === 'offline' ||
        result?.status === 'error' ||
        result?.status === 'disabled' ||
        result?.status === 'skipped'
      ) {
        markError(resolveCatalogBootstrapError(result));
        return;
      }
      const stillEmpty = await readCatalogEmpty();
      if (!isCurrent()) return;
      if (stillEmpty && result?.status !== 'applied' && result?.status !== 'up-to-date') {
        markError(resolveCatalogBootstrapError(result));
        return;
      }
      if (!stillEmpty) {
        try {
          await warmupColdStartCache(({ category }) => {
            applySyncProgress({
              phase: 'warmup',
              progress: WARMUP_PROGRESS[category] ?? WARMUP_PROGRESS.tires,
            });
          });
        } catch {
          if (!isCurrent()) return;
        }
      }
      if (!isCurrent()) return;
      await bumpIfIdbAhead();
      markReady();
    };

    const run = async (reason) => {
      if (!isCurrent() || syncing) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        if (reason === 'slot') return;
      }
      if (!configured) {
        if (blockingColdStart) {
          markError(resolveCatalogBootstrapError({ status: 'disabled' }));
        }
        return;
      }

      syncing = true;
      if (blockingColdStart) applySyncProgress({ phase: 'meta', progress: 1 });
      try {
        const result = await checkAndSyncCatalog({
          storeId,
          signal: abortController.signal,
          onProgress: blockingColdStart ? applySyncProgress : undefined,
          onLockWaiting: blockingColdStart
            ? () => {
                setBootstrap((current) => ({
                  phase: 'blocking',
                  progress: 0,
                  label: CATALOG_BOOTSTRAP_WAITING_LABEL,
                  ...(current?.waitForShowcase ? { waitForShowcase: true } : {}),
                }));
              }
            : undefined,
        });
        if (blockingColdStart) {
          await finishColdStart(result);
        } else {
          await bumpIfIdbAhead();
        }
      } finally {
        syncing = false;
      }
    };

    const scheduleSlot = () => {
      if (!configured) return;
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

    const start = async () => {
      const empty = await readCatalogEmpty();
      if (!isCurrent()) return;
      if (!empty) {
        markReady();
        if (!configured) return;
        await run('start');
        return;
      }
      blockingColdStart = true;
      setBootstrap((current) => ({
        phase: 'blocking',
        progress: nextBlockingProgress(current?.progress, 0),
        label: labelFromSyncProgress({ phase: 'meta' }, current?.label),
        waitForShowcase: true,
      }));
      if (!configured) {
        markError(resolveCatalogBootstrapError({ status: 'disabled' }));
        return;
      }
      await run('start');
    };

    retryRef.current = () => {
      if (!isCurrent() || syncing) return;
      blockingColdStart = true;
      setBootstrap({
        ...createBlockingBootstrap(0),
        waitForShowcase: true,
      });
      run('retry');
    };

    start();
    if (configured) {
      scheduleSlot();
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onOnline);
    }

    return () => {
      cancelled = true;
      retryRef.current = null;
      abortController.abort();
      if (slotTimer) clearTimeout(slotTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [isWorkspaceReady, pathname, workspace?.storeId]);

  return null;
}
