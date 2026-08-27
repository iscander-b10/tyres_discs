import { useCallback, useEffect, useRef } from 'react';
import { CATALOG_SEARCH_HORIZONTAL_MIN_PX } from './useCatalogSearchFormLayout';

export const CATALOG_SELECT_DROPDOWN_CLASS = 'catalog-search-select-dropdown';
export const CATALOG_SELECT_VIRTUAL_LIST_HOLDER_CLASS = 'rc-virtual-list-holder';
export const CATALOG_SELECT_POPUP_OPEN_CLASS = 'catalog-select-popup-open';

const LISTENER_OPTIONS = { capture: true, passive: false };
const TOUCH_START_OPTIONS = { capture: true, passive: true };

let lockCount = 0;
let viewportWatchAttached = false;
let scrollListenersAttached = false;
let dropdownObserver = null;
let lastTouchY = 0;

/**
 * Background scroll lock is for stacked + sidebar, not horizontal desktop.
 * @param {number} widthPx
 * @returns {boolean}
 */
export function shouldLockCatalogSelectBackgroundScroll(widthPx) {
  const width = Number(widthPx);
  return Number.isFinite(width) && width < CATALOG_SEARCH_HORIZONTAL_MIN_PX;
}

function getViewportWidth() {
  if (typeof window === 'undefined') {
    return CATALOG_SEARCH_HORIZONTAL_MIN_PX;
  }
  return window.innerWidth;
}

function asElement(target) {
  if (target instanceof Element) return target;
  if (target && target.parentElement instanceof Element) return target.parentElement;
  return null;
}

/**
 * Allowlist: only the catalog-select popup scroller, not overflow ancestors
 * such as sidebar `.search-form`.
 * @param {EventTarget | null | undefined} target
 * @returns {Element | null}
 */
export function findCatalogSelectAllowedScroller(target) {
  const node = asElement(target);
  if (!node || typeof node.closest !== 'function') return null;

  const dropdown = node.closest(`.${CATALOG_SELECT_DROPDOWN_CLASS}`);
  if (!dropdown) return null;

  const holder = node.closest(`.${CATALOG_SELECT_VIRTUAL_LIST_HOLDER_CLASS}`);
  if (holder && dropdown.contains(holder)) return holder;

  return null;
}

function canScrollByDelta(scroller, deltaY) {
  if (!deltaY) return false;

  const scrollTop = scroller.scrollTop || 0;
  const maxScroll = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
  if (maxScroll <= 0) return false;

  if (deltaY > 0) {
    return scrollTop < maxScroll - 1;
  }
  return scrollTop > 1;
}

function shouldAllowBackgroundScrollEvent(target, deltaY) {
  const scroller = findCatalogSelectAllowedScroller(target);
  return Boolean(scroller && canScrollByDelta(scroller, deltaY));
}

function onWheel(event) {
  if (!event.cancelable) return;
  if (shouldAllowBackgroundScrollEvent(event.target, event.deltaY)) return;
  event.preventDefault();
}

function onTouchStart(event) {
  const touch = event.touches && event.touches[0];
  if (touch) {
    lastTouchY = touch.clientY;
  }
}

function onTouchMove(event) {
  if (!event.cancelable) return;
  const touch = event.touches && event.touches[0];
  if (!touch) {
    event.preventDefault();
    return;
  }

  const deltaY = lastTouchY - touch.clientY;
  lastTouchY = touch.clientY;

  if (shouldAllowBackgroundScrollEvent(event.target, deltaY)) return;
  event.preventDefault();
}

function onViewportResize() {
  syncLockListeners();
}

function countVisibleCatalogSelectDropdowns() {
  if (typeof document === 'undefined') return 0;
  return document.querySelectorAll(
    `.${CATALOG_SELECT_DROPDOWN_CLASS}:not(.ant-select-dropdown-hidden)`
  ).length;
}

function isCatalogSelectDropdownNode(node) {
  if (!(node instanceof Element)) return false;
  return (
    node.classList.contains(CATALOG_SELECT_DROPDOWN_CLASS)
    || Boolean(node.querySelector(`.${CATALOG_SELECT_DROPDOWN_CLASS}`))
  );
}

let reconcileScheduled = false;

function scheduleReconcileLockCountWithVisibleDropdowns() {
  if (reconcileScheduled) return;
  reconcileScheduled = true;
  queueMicrotask(() => {
    reconcileScheduled = false;
    if (lockCount === 0) return;
    const visible = countVisibleCatalogSelectDropdowns();
    if (visible >= lockCount) return;
    lockCount = visible;
    syncLockListeners();
  });
}

function onDropdownDomMutation(mutations) {
  const removedCatalogDropdown = mutations.some((mutation) =>
    Array.from(mutation.removedNodes).some(isCatalogSelectDropdownNode)
  );
  if (!removedCatalogDropdown) return;
  scheduleReconcileLockCountWithVisibleDropdowns();
}

function attachDropdownObserver() {
  if (
    dropdownObserver
    || typeof MutationObserver === 'undefined'
    || typeof document === 'undefined'
    || !document.body
  ) {
    return;
  }

  dropdownObserver = new MutationObserver(onDropdownDomMutation);
  dropdownObserver.observe(document.body, { childList: true, subtree: true });
}

function detachDropdownObserver() {
  if (!dropdownObserver) return;
  dropdownObserver.disconnect();
  dropdownObserver = null;
}

function attachViewportWatch() {
  if (typeof window === 'undefined' || viewportWatchAttached) return;
  window.addEventListener('resize', onViewportResize);
  viewportWatchAttached = true;
}

function detachViewportWatch() {
  if (typeof window === 'undefined' || !viewportWatchAttached) return;
  window.removeEventListener('resize', onViewportResize);
  viewportWatchAttached = false;
}

function attachScrollListeners() {
  if (typeof document === 'undefined' || scrollListenersAttached) return;

  document.addEventListener('wheel', onWheel, LISTENER_OPTIONS);
  document.addEventListener('touchstart', onTouchStart, TOUCH_START_OPTIONS);
  document.addEventListener('touchmove', onTouchMove, LISTENER_OPTIONS);
  document.documentElement.classList.add(CATALOG_SELECT_POPUP_OPEN_CLASS);
  scrollListenersAttached = true;
}

function detachScrollListeners() {
  if (typeof document === 'undefined' || !scrollListenersAttached) return;

  document.removeEventListener('wheel', onWheel, LISTENER_OPTIONS);
  document.removeEventListener('touchstart', onTouchStart, TOUCH_START_OPTIONS);
  document.removeEventListener('touchmove', onTouchMove, LISTENER_OPTIONS);
  document.documentElement.classList.remove(CATALOG_SELECT_POPUP_OPEN_CLASS);
  scrollListenersAttached = false;
  lastTouchY = 0;
}

function syncLockListeners() {
  if (lockCount > 0) {
    attachViewportWatch();
    attachDropdownObserver();
  } else {
    detachViewportWatch();
    detachDropdownObserver();
  }

  const shouldBlockScroll =
    lockCount > 0 && shouldLockCatalogSelectBackgroundScroll(getViewportWidth());

  if (shouldBlockScroll) {
    attachScrollListeners();
  } else {
    detachScrollListeners();
  }
}

export function getCatalogSelectPopupScrollLockCount() {
  return lockCount;
}

export function isCatalogSelectPopupBackgroundScrollLocked() {
  return scrollListenersAttached;
}

export function acquireCatalogSelectPopupScrollLock() {
  lockCount += 1;
  syncLockListeners();
}

export function releaseCatalogSelectPopupScrollLock() {
  if (lockCount === 0) return;
  lockCount -= 1;
  syncLockListeners();
}

/** Ant Design Select `onOpenChange` — increment on open, decrement on close. */
export function onCatalogSelectOpenChange(open) {
  if (open) {
    acquireCatalogSelectPopupScrollLock();
  } else {
    releaseCatalogSelectPopupScrollLock();
  }
}

export function resetCatalogSelectPopupScrollLockForTests() {
  lockCount = 0;
  lastTouchY = 0;
  reconcileScheduled = false;
  detachViewportWatch();
  detachDropdownObserver();
  detachScrollListeners();
}

/**
 * Per-instance open tracking: double true/false is ignored, unmount releases.
 * @returns {{ onOpenChange: (open: boolean) => void }}
 */
export function useCatalogSelectPopupScrollLock() {
  const heldRef = useRef(false);

  const onOpenChange = useCallback((open) => {
    if (open) {
      if (!heldRef.current) {
        acquireCatalogSelectPopupScrollLock();
        heldRef.current = true;
      }
    } else if (heldRef.current) {
      releaseCatalogSelectPopupScrollLock();
      heldRef.current = false;
    }
  }, []);

  useEffect(() => () => {
    if (heldRef.current) {
      releaseCatalogSelectPopupScrollLock();
      heldRef.current = false;
    }
  }, []);

  return { onOpenChange };
}
