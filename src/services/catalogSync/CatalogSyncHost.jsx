import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppShell } from '../../app/AppShellContext';
import {
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
  ensureFreshCatalogBundle,
  noteCatalogBundleHidden,
} from './catalogBundleRefresh';
import {
  checkAndSyncCatalog,
  isCatalogSyncConfigured,
  msUntilNextSyncCheck,
} from './catalogSyncService';

/** Кроме start, slot и retry meta не спрашиваем чаще раза в 30 секунд. */
const META_CHECK_MIN_INTERVAL_MS = 30_000;

const META_THROTTLE_EXEMPT = new Set(['start', 'slot', 'retry']);

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
    reportCatalogUpdateFailed,
    noteCatalogVersionWritten,
  } = useAppShell();
  const { isWorkspaceReady, workspace } = useAuth();
  const { pathname } = useLocation();
  const notifyRef = useRef(notifyCatalogApplied);
  notifyRef.current = notifyCatalogApplied;
  const setBootstrapRef = useRef(setCatalogBootstrap);
  setBootstrapRef.current = setCatalogBootstrap;
  const reportFailedRef = useRef(reportCatalogUpdateFailed);
  reportFailedRef.current = reportCatalogUpdateFailed;
  const noteWrittenRef = useRef(noteCatalogVersionWritten);
  noteWrittenRef.current = noteCatalogVersionWritten;
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
    let lastMetaCheckAt = 0;
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

    const noteWarmResult = async (result) => {
      if (!isCurrent() || blockingColdStart) return;
      if (result?.status === 'error' || result?.status === 'offline') {
        reportFailedRef.current?.(await readPersistedVersion());
        return;
      }
      if (result?.status === 'applied') {
        noteWrittenRef.current?.(await readPersistedVersion());
      }
    };

    const run = async (reason) => {
      if (!isCurrent() || syncing) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        if (reason === 'slot') return;
      }
      if (
        !META_THROTTLE_EXEMPT.has(reason) &&
        Date.now() - lastMetaCheckAt < META_CHECK_MIN_INTERVAL_MS
      ) {
        return;
      }
      if (!configured) {
        if (blockingColdStart) {
          markError(resolveCatalogBootstrapError({ status: 'disabled' }));
        }
        return;
      }

      lastMetaCheckAt = Date.now();
      syncing = true;
      if (blockingColdStart) applySyncProgress({ phase: 'meta', progress: 1 });
      try {
        const result = await checkAndSyncCatalog({
          storeId,
          signal: abortController.signal,
          onProgress: blockingColdStart ? applySyncProgress : undefined,
        });
        if (blockingColdStart) {
          await finishColdStart(result);
        } else {
          await bumpIfIdbAhead();
          await noteWarmResult(result);
        }
      } catch {
        if (!blockingColdStart && isCurrent()) {
          reportFailedRef.current?.(await readPersistedVersion());
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
      if (document.visibilityState !== 'visible') {
        noteCatalogBundleHidden();
        return;
      }
      void ensureFreshCatalogBundle();
      run('visibility');
    };

    const onOnline = () => {
      run('online');
    };

    const onPageShow = () => {
      void ensureFreshCatalogBundle({ force: true });
      run('pageshow');
    };

    const onResume = () => {
      void ensureFreshCatalogBundle({ force: true });
      run('resume');
    };

    const onFocus = () => {
      run('focus');
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

    void ensureFreshCatalogBundle();
    start();
    if (configured) {
      scheduleSlot();
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onOnline);
      window.addEventListener('pageshow', onPageShow);
      document.addEventListener('resume', onResume);
      window.addEventListener('focus', onFocus);
    }

    return () => {
      cancelled = true;
      retryRef.current = null;
      abortController.abort();
      if (slotTimer) clearTimeout(slotTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('resume', onResume);
      window.removeEventListener('focus', onFocus);
    };
  }, [isWorkspaceReady, pathname, workspace?.storeId]);

  return null;
}
