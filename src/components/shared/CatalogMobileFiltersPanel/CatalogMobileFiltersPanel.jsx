import React, {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { Button } from 'antd';
import { ReactComponent as FiltersIcon } from '../../../icons/Filters.svg';
import { CATALOG_SEARCH_LAYOUT } from '../useCatalogSearchFormLayout';
import { useVisualViewportBottomInset } from '../useVisualViewportBottomInset';
import './CatalogMobileFiltersPanel.scss';

const FILTERS_LABEL = 'Фильтры';

const isBlockingOverlayOpen = () =>
  Boolean(
    document.querySelector('.catalog-brand-sheet') ||
      document.querySelector(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden)'
      )
  );

/**
 * Stacked-only chrome around the existing tire/disc search Form:
 * collapsed trigger «Фильтры», open panel with the same form (not a copy).
 * Sidebar / horizontal render children unchanged.
 */
function CatalogMobileFiltersPanel({
  layout,
  isActive = true,
  open = false,
  onOpenChange,
  formId = 'catalog-search-form',
  children,
}) {
  const isStacked = layout === CATALOG_SEARCH_LAYOUT.STACKED;
  const triggerRef = useRef(null);
  const wasOpenRef = useRef(false);
  const imeInset = useVisualViewportBottomInset(isStacked && open && isActive);
  const child = React.Children.only(children);

  useEffect(() => {
    if (!isStacked || !open || !isActive) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented) return;
      if (isBlockingOverlayOpen()) return;
      event.preventDefault();
      onOpenChange?.(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isStacked, open, isActive, onOpenChange]);

  useLayoutEffect(() => {
    if (!isStacked) {
      wasOpenRef.current = open;
      return;
    }

    const form = document.getElementById(formId);
    if (form) {
      if (open) {
        form.removeAttribute('hidden');
      } else {
        form.setAttribute('hidden', '');
      }
    }

    const justOpened = open && !wasOpenRef.current;
    const justClosed = !open && wasOpenRef.current;
    wasOpenRef.current = open;

    if (justOpened && form) {
      form.setAttribute('tabindex', '-1');
      form.focus({ preventScroll: true });
      return;
    }

    if (justClosed) {
      triggerRef.current?.focus?.({ preventScroll: true });
    }
  }, [formId, isStacked, open]);

  if (!isStacked) {
    return children;
  }

  return (
    <>
      {open ? null : (
        <Button
          ref={triggerRef}
          type="primary"
          htmlType="button"
          block
          className="catalog-mobile-filters-trigger"
          icon={<FiltersIcon aria-hidden />}
          aria-label={FILTERS_LABEL}
          aria-expanded={false}
          aria-controls={formId}
          onClick={() => onOpenChange?.(true)}
        >
          {FILTERS_LABEL}
        </Button>
      )}
      {cloneElement(child, {
        id: child.props.id ?? formId,
        hidden: open ? undefined : true,
        style: {
          ...child.props.style,
          '--mobile-filters-ime-inset': `${imeInset}px`,
        },
      })}
    </>
  );
}

export default CatalogMobileFiltersPanel;
