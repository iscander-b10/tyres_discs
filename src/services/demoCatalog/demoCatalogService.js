/**
 * Загрузка замороженного demo-snapshot. Не ходит в live /v2/catalog/{storeId}.
 */

import { DEMO_STORE_ID } from '../../app/demoWorkspace';
import {
  CATALOG_BOOTSTRAP_PHASE_LABELS,
  nextBlockingProgress,
} from '../../app/catalogBootstrap';
import { appLog } from '../../utils/appLog';
import indexedDBService from '../indexedDBService';
import { withCatalogSyncLock } from '../catalogSync/catalogSyncLock';
import {
  applyCatalogSnapshot,
  fetchCatalogSnapshot,
} from '../catalogSync/catalogSyncService';

const PUBLIC_DEMO_SNAPSHOT_PATH = '/demo/snapshot.json';
const PUBLIC_DEMO_META_PATH = '/demo/meta.json';

function publicUrl(pathname) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}${pathname}`;
}

export function resolveDemoSnapshotUrl() {
  return (
    process.env.REACT_APP_DEMO_SNAPSHOT_URL?.trim() ||
    publicUrl(PUBLIC_DEMO_SNAPSHOT_PATH)
  );
}

export function resolveDemoMetaUrl() {
  return (
    process.env.REACT_APP_DEMO_META_URL?.trim() ||
    publicUrl(PUBLIC_DEMO_META_PATH)
  );
}

function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError')
  );
}

function demoDownloadProgress(receivedBytes, totalBytes) {
  if (!(Number(totalBytes) > 0)) return 0;
  return Math.min(99, (Math.max(0, receivedBytes) / totalBytes) * 99);
}

export function formatDemoCatalogDate(versionOrFrozenAt) {
  if (typeof versionOrFrozenAt !== 'string' || !versionOrFrozenAt.trim()) {
    return '';
  }
  const match = versionOrFrozenAt.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}.${match[2]}.${match[1]}`;
}

async function fetchDemoMeta(signal) {
  const res = await fetch(resolveDemoMetaUrl(), { cache: 'no-store', signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const meta = await res.json();
  const bytes = Number(meta?.bytes);
  return {
    bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : 0,
    version: typeof meta?.version === 'string' ? meta.version : '',
    frozenAt: typeof meta?.frozenAt === 'string' ? meta.frozenAt : '',
  };
}

/**
 * Скачивает static snapshot, валидирует и применяет в IDB store `demo`.
 * onProgress: { phase, receivedBytes, totalBytes, progress, label }
 */
export async function loadFrozenDemoCatalog({
  storeId = DEMO_STORE_ID,
  signal,
  onProgress,
} = {}) {
  let lastProgress = 0;
  const reportProgress = ({
    phase,
    receivedBytes = 0,
    totalBytes = null,
    progress,
    label,
  }) => {
    const nextProgress = nextBlockingProgress(lastProgress, progress ?? 0);
    lastProgress = nextProgress;
    try {
      onProgress?.({
        phase,
        receivedBytes,
        totalBytes,
        progress: nextProgress,
        label:
          label ||
          CATALOG_BOOTSTRAP_PHASE_LABELS[phase] ||
          CATALOG_BOOTSTRAP_PHASE_LABELS.download,
      });
    } catch {
      /* UI progress must not fail bootstrap */
    }
  };

  return withCatalogSyncLock(storeId, async () => {
    const generation = indexedDBService.setActiveStore(storeId);
    const isCurrent = () =>
      typeof indexedDBService.isActiveStore !== 'function' ||
      indexedDBService.isActiveStore(storeId, generation);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { status: 'offline' };
    }
    if (signal?.aborted) {
      return { status: 'skipped', error: 'aborted' };
    }

    try {
      reportProgress({ phase: 'meta', progress: 1 });
      const meta = await fetchDemoMeta(signal);
      if (!isCurrent()) return { status: 'skipped', error: 'stale store' };
      if (!meta) {
        return { status: 'skipped', error: 'meta empty' };
      }
      const totalBytes = meta.bytes || null;
      reportProgress({ phase: 'download', progress: 5, totalBytes });

      const snapshot = await fetchCatalogSnapshot(resolveDemoSnapshotUrl(), {
        signal,
        onDownloadProgress: ({ receivedBytes, complete }) => {
          reportProgress({
            phase: 'download',
            receivedBytes,
            totalBytes,
            progress: complete
              ? 99
              : demoDownloadProgress(receivedBytes, totalBytes),
          });
        },
        onParseStart: () => {
          reportProgress({
            phase: 'parse',
            progress: 99,
            totalBytes,
          });
        },
      });
      if (!isCurrent()) return { status: 'skipped', error: 'stale store' };
      if (!snapshot?.version) {
        return { status: 'skipped', error: 'snapshot empty' };
      }

      reportProgress({ phase: 'apply', progress: 99, totalBytes });
      await applyCatalogSnapshot(snapshot, { storeId, generation });
      if (!isCurrent()) return { status: 'skipped', error: 'stale store' };

      return {
        status: 'applied',
        version: snapshot.version,
        frozenAt: meta.frozenAt || snapshot.version,
      };
    } catch (err) {
      if (err?.name === 'StaleCatalogStoreError') {
        return { status: 'skipped', error: 'stale store' };
      }
      if (isAbortError(err) || signal?.aborted) {
        return { status: 'skipped', error: 'aborted' };
      }

      const report = err?.validationReport;
      if (report && report.valid === false) {
        const first = report.errors?.[0];
        appLog.error({
          code: 'catalog.snapshot_invalid',
          domain: 'demoCatalog',
          message: 'Demo catalog snapshot validation failed',
          error: err,
          context: {
            storeId,
            validationPath: first?.path,
            validationMessage: first?.message,
          },
        });
      } else {
        appLog.error({
          code: 'catalog.sync_failed',
          domain: 'demoCatalog',
          message: 'Demo catalog bootstrap failed',
          error: err,
          context: { storeId },
        });
      }

      return { status: 'error', error: err?.message || String(err) };
    }
  });
}
