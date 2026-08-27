import '@testing-library/jest-dom';

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

if (typeof window.ResizeObserver !== 'function') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  const {
    resetCatalogSelectPopupScrollLockForTests,
  } = require('./components/shared/catalogSelectPopupScrollLock');
  resetCatalogSelectPopupScrollLockForTests();
});
