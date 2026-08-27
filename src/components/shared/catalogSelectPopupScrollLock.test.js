import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import {
  catalogSearchSelectProps,
  useCatalogSelectCloseOnMouseLeave,
} from './catalogSearchSelectProps';
import {
  CATALOG_SELECT_DROPDOWN_CLASS,
  CATALOG_SELECT_POPUP_OPEN_CLASS,
  CATALOG_SELECT_VIRTUAL_LIST_HOLDER_CLASS,
  acquireCatalogSelectPopupScrollLock,
  findCatalogSelectAllowedScroller,
  getCatalogSelectPopupScrollLockCount,
  isCatalogSelectPopupBackgroundScrollLocked,
  onCatalogSelectOpenChange,
  releaseCatalogSelectPopupScrollLock,
  resetCatalogSelectPopupScrollLockForTests,
  shouldLockCatalogSelectBackgroundScroll,
  useCatalogSelectPopupScrollLock,
} from './catalogSelectPopupScrollLock';

const originalInnerWidthDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'innerWidth'
);

function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function restoreViewportWidth() {
  if (originalInnerWidthDescriptor) {
    Object.defineProperty(window, 'innerWidth', originalInnerWidthDescriptor);
    return;
  }
  delete window.innerWidth;
}

function dispatchWheel(target, deltaY) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY,
  });
  target.dispatchEvent(event);
  return event;
}

function dispatchTouch(target, type, clientY) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: [{ clientY }],
  });
  target.dispatchEvent(event);
  return event;
}

function mountScrollerFixture({
  scrollTop = 40,
  scrollHeight = 400,
  clientHeight = 120,
} = {}) {
  const dropdown = document.createElement('div');
  dropdown.className = CATALOG_SELECT_DROPDOWN_CLASS;
  const holder = document.createElement('div');
  holder.className = CATALOG_SELECT_VIRTUAL_LIST_HOLDER_CLASS;
  Object.defineProperty(holder, 'scrollTop', { configurable: true, writable: true, value: scrollTop });
  Object.defineProperty(holder, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(holder, 'clientHeight', { configurable: true, value: clientHeight });
  dropdown.appendChild(holder);
  document.body.appendChild(dropdown);
  return { dropdown, holder };
}

describe('catalogSelectPopupScrollLock', () => {
  beforeEach(() => {
    resetCatalogSelectPopupScrollLockForTests();
    setViewportWidth(390);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    resetCatalogSelectPopupScrollLockForTests();
    restoreViewportWidth();
    document.body.replaceChildren();
    document.body.style.overflow = '';
  });

  describe('shouldLockCatalogSelectBackgroundScroll', () => {
    it('locks stacked and sidebar widths, not horizontal', () => {
      expect(shouldLockCatalogSelectBackgroundScroll(767)).toBe(true);
      expect(shouldLockCatalogSelectBackgroundScroll(768)).toBe(true);
      expect(shouldLockCatalogSelectBackgroundScroll(900)).toBe(true);
      expect(shouldLockCatalogSelectBackgroundScroll(1099)).toBe(true);
      expect(shouldLockCatalogSelectBackgroundScroll(1100)).toBe(false);
      expect(shouldLockCatalogSelectBackgroundScroll(1280)).toBe(false);
    });

    it('does not lock non-finite width', () => {
      expect(shouldLockCatalogSelectBackgroundScroll(NaN)).toBe(false);
      expect(shouldLockCatalogSelectBackgroundScroll(undefined)).toBe(false);
    });
  });

  describe('acquire / release refcount', () => {
    it('attaches on first acquire and detaches on last release', () => {
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);

      acquireCatalogSelectPopupScrollLock();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);
      expect(
        document.documentElement.classList.contains(CATALOG_SELECT_POPUP_OPEN_CLASS)
      ).toBe(true);

      acquireCatalogSelectPopupScrollLock();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(2);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);

      releaseCatalogSelectPopupScrollLock();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);

      releaseCatalogSelectPopupScrollLock();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
      expect(
        document.documentElement.classList.contains(CATALOG_SELECT_POPUP_OPEN_CLASS)
      ).toBe(false);
    });

    it('ignores extra release and does not go negative', () => {
      releaseCatalogSelectPopupScrollLock();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
    });

    it('does not set body overflow hidden', () => {
      document.body.style.overflow = 'auto';
      acquireCatalogSelectPopupScrollLock();
      expect(document.body.style.overflow).toBe('auto');
      releaseCatalogSelectPopupScrollLock();
      expect(document.body.style.overflow).toBe('auto');
    });

    it('leaves an existing modal overflow snapshot untouched', () => {
      document.body.style.overflow = 'hidden';
      acquireCatalogSelectPopupScrollLock();
      releaseCatalogSelectPopupScrollLock();
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  describe('viewport width', () => {
    it.each([767, 900, 1099])(
      'attaches listeners at %ipx',
      (width) => {
        setViewportWidth(width);
        acquireCatalogSelectPopupScrollLock();
        expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);
        expect(dispatchWheel(document.body, 40).defaultPrevented).toBe(true);
      }
    );

    it('does not attach listeners at 1100px+', () => {
      setViewportWidth(1100);
      acquireCatalogSelectPopupScrollLock();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
      expect(
        document.documentElement.classList.contains(CATALOG_SELECT_POPUP_OPEN_CLASS)
      ).toBe(false);
      expect(dispatchWheel(document.body, 40).defaultPrevented).toBe(false);
    });

    it('reattaches when resizing from horizontal into sidebar while held', () => {
      setViewportWidth(1100);
      acquireCatalogSelectPopupScrollLock();
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);

      setViewportWidth(900);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);
      expect(dispatchWheel(document.body, 20).defaultPrevented).toBe(true);
    });

    it('detaches when resizing from sidebar into horizontal while held', () => {
      setViewportWidth(900);
      acquireCatalogSelectPopupScrollLock();
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);

      setViewportWidth(1100);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
      expect(dispatchWheel(document.body, 20).defaultPrevented).toBe(false);
    });
  });

  describe('allowlist and background prevention', () => {
    it('allows wheel inside the virtual list when it can still scroll', () => {
      acquireCatalogSelectPopupScrollLock();
      const { holder } = mountScrollerFixture({ scrollTop: 40 });
      expect(findCatalogSelectAllowedScroller(holder)).toBe(holder);
      expect(dispatchWheel(holder, 30).defaultPrevented).toBe(false);
    });

    it('prevents wheel at the list boundary so it does not chain to the page', () => {
      acquireCatalogSelectPopupScrollLock();
      const { holder } = mountScrollerFixture({
        scrollTop: 0,
        scrollHeight: 400,
        clientHeight: 120,
      });
      expect(dispatchWheel(holder, -20).defaultPrevented).toBe(true);
    });

    it('prevents wheel on sidebar search-form even when that form can scroll', () => {
      acquireCatalogSelectPopupScrollLock();
      const form = document.createElement('form');
      form.className = 'search-form';
      Object.defineProperty(form, 'scrollTop', { configurable: true, writable: true, value: 20 });
      Object.defineProperty(form, 'scrollHeight', { configurable: true, value: 800 });
      Object.defineProperty(form, 'clientHeight', { configurable: true, value: 200 });
      document.body.appendChild(form);

      expect(findCatalogSelectAllowedScroller(form)).toBeNull();
      expect(dispatchWheel(form, 40).defaultPrevented).toBe(true);
    });

    it('prevents touchmove on the page and allows it inside the list', () => {
      acquireCatalogSelectPopupScrollLock();
      const { holder } = mountScrollerFixture({ scrollTop: 40 });

      dispatchTouch(document.body, 'touchstart', 180);
      expect(dispatchTouch(document.body, 'touchmove', 120).defaultPrevented).toBe(true);

      dispatchTouch(holder, 'touchstart', 180);
      expect(dispatchTouch(holder, 'touchmove', 120).defaultPrevented).toBe(false);
    });

    it('restores listeners after release so the page can scroll again', () => {
      acquireCatalogSelectPopupScrollLock();
      expect(dispatchWheel(document.body, 40).defaultPrevented).toBe(true);
      releaseCatalogSelectPopupScrollLock();
      expect(dispatchWheel(document.body, 40).defaultPrevented).toBe(false);
    });
  });

  describe('onCatalogSelectOpenChange and catalogSearchSelectProps', () => {
    it('is the shared Select onOpenChange', () => {
      expect(catalogSearchSelectProps.classNames.popup.root).toBe(
        CATALOG_SELECT_DROPDOWN_CLASS
      );
      expect(catalogSearchSelectProps.onOpenChange).toBe(onCatalogSelectOpenChange);
    });

    it('increments and decrements through Select onOpenChange', () => {
      catalogSearchSelectProps.onOpenChange(true);
      catalogSearchSelectProps.onOpenChange(true);
      expect(getCatalogSelectPopupScrollLockCount()).toBe(2);
      catalogSearchSelectProps.onOpenChange(false);
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      catalogSearchSelectProps.onOpenChange(false);
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
    });
  });

  describe('useCatalogSelectPopupScrollLock', () => {
    it('releases on unmount while still open', () => {
      const { result, unmount } = renderHook(() => useCatalogSelectPopupScrollLock());

      act(() => {
        result.current.onOpenChange(true);
      });
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);

      unmount();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
      expect(dispatchWheel(document.body, 30).defaultPrevented).toBe(false);
    });

    it('does not double-count repeated true/false from one instance', () => {
      const { result } = renderHook(() => useCatalogSelectPopupScrollLock());

      act(() => {
        result.current.onOpenChange(true);
        result.current.onOpenChange(true);
      });
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);

      act(() => {
        result.current.onOpenChange(false);
        result.current.onOpenChange(false);
      });
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
    });

    it('keeps lock while two hook instances are open', () => {
      const first = renderHook(() => useCatalogSelectPopupScrollLock());
      const second = renderHook(() => useCatalogSelectPopupScrollLock());

      act(() => {
        first.result.current.onOpenChange(true);
        second.result.current.onOpenChange(true);
      });
      expect(getCatalogSelectPopupScrollLockCount()).toBe(2);

      act(() => {
        first.result.current.onOpenChange(false);
      });
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);

      second.unmount();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
    });
  });

  describe('useCatalogSelectCloseOnMouseLeave composition', () => {
    it('still returns open, onOpenChange and popupRender and locks while open', () => {
      const { result } = renderHook(() => useCatalogSelectCloseOnMouseLeave());

      expect(result.current.open).toBe(false);
      expect(typeof result.current.onOpenChange).toBe('function');
      expect(typeof result.current.popupRender).toBe('function');

      act(() => {
        result.current.onOpenChange(true);
      });
      expect(result.current.open).toBe(true);
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);

      act(() => {
        result.current.onOpenChange(false);
      });
      expect(result.current.open).toBe(false);
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
    });

    it('releases lock on mouseleave of popupRender', () => {
      const { result } = renderHook(() => useCatalogSelectCloseOnMouseLeave());

      act(() => {
        result.current.onOpenChange(true);
      });

      const view = render(result.current.popupRender(<span data-testid="menu" />));
      fireEvent.mouseLeave(view.getByTestId('menu').parentElement);

      expect(result.current.open).toBe(false);
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
    });

    it('releases lock if the brand hook unmounts while open', () => {
      const { result, unmount } = renderHook(() => useCatalogSelectCloseOnMouseLeave());
      act(() => {
        result.current.onOpenChange(true);
      });
      unmount();
      expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
    });
  });

  describe('antd Select onOpenChange', () => {
    it('releases when a catalog Select unmounts while the popup is open', async () => {
      const { Select } = require('antd');
      const view = render(
        <Select
          {...catalogSearchSelectProps}
          aria-label="Ширина"
          options={[205, 215, 225, 235].map((value) => ({ value, label: String(value) }))}
        />
      );

      fireEvent.mouseDown(view.getByRole('combobox', { name: 'Ширина' }));
      expect(getCatalogSelectPopupScrollLockCount()).toBe(1);
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(true);

      view.unmount();
      await waitFor(() => {
        expect(getCatalogSelectPopupScrollLockCount()).toBe(0);
      });
      expect(isCatalogSelectPopupBackgroundScrollLocked()).toBe(false);
    });
  });
});
