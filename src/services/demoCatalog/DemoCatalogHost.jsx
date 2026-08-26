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
import { DEMO_STORE_ID } from '../../app/demoWorkspace';
import { isDemoPath } from '../../app/paths';
import { useAuth } from '../../auth/AuthContext';
import indexedDBService from '../indexedDBService';
import { loadFrozenDemoCatalog } from './demoCatalogService';

const WARMUP_PROGRESS = {
  tires: 97,
  discs: 99,
};

const DEMO_PROGRESS_OPTIONS = { hideBytesLabel: true };

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
 * Cold/warm bootstrap замороженного demo-каталога. Без autosync, слотов,
 * visibility и live /meta.
 */
export function DemoCatalogHost() {
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
    const storeId = workspace?.storeId || DEMO_STORE_ID;
    if (!isWorkspaceReady || !storeId || !isDemoPath(pathname)) {
      return undefined;
    }

    let cancelled = false;
    let syncing = false;
    let lastNotifiedVersion = '';
    let blockingColdStart = false;
    const abortController = new AbortController();
    const storeGeneration = indexedDBService.setActiveStore(storeId);
    const isCurrent = () =>
      !cancelled &&
      indexedDBService.isActiveStore(storeId, storeGeneration);

    const setBootstrap = (update) => {
      if (!isCurrent()) return;
      setBootstrapRef.current?.(update);
    };

    const applySyncProgress = (event) => {
      if (!blockingColdStart) return;
      setBootstrap((current) => ({
        phase: 'blocking',
        progress: nextBlockingProgress(current?.progress, event?.progress),
        label: labelFromSyncProgress(
          event,
          current?.label,
          DEMO_PROGRESS_OPTIONS
        ),
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
      if (
        stillEmpty &&
        result?.status !== 'applied' &&
        result?.status !== 'up-to-date'
      ) {
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

    const run = async () => {
      if (!isCurrent() || syncing) return;
      syncing = true;
      if (blockingColdStart) {
        applySyncProgress({ phase: 'meta', progress: 1 });
      }
      try {
        const result = await loadFrozenDemoCatalog({
          storeId,
          signal: abortController.signal,
          onProgress: blockingColdStart ? applySyncProgress : undefined,
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

    const start = async () => {
      const empty = await readCatalogEmpty();
      if (!isCurrent()) return;
      if (!empty) {
        markReady();
        await bumpIfIdbAhead();
        return;
      }
      blockingColdStart = true;
      setBootstrap((current) => ({
        phase: 'blocking',
        progress: nextBlockingProgress(current?.progress, 0),
        label: labelFromSyncProgress(
          { phase: 'download', totalBytes: 1 },
          current?.label,
          DEMO_PROGRESS_OPTIONS
        ),
        waitForShowcase: true,
      }));
      await run();
    };

    retryRef.current = () => {
      if (!isCurrent() || syncing) return;
      blockingColdStart = true;
      setBootstrap({
        ...createBlockingBootstrap(0),
        waitForShowcase: true,
      });
      run();
    };

    start();

    return () => {
      cancelled = true;
      retryRef.current = null;
      abortController.abort();
    };
  }, [isWorkspaceReady, pathname, workspace?.storeId]);

  return null;
}
