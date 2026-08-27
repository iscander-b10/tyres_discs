import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Button } from 'antd';
import {
  CATALOG_BOOTSTRAP_LOADING_LABEL,
  catalogBootstrapHeadline,
  catalogBootstrapValueText,
  isCatalogBytesLabel,
  isCatalogWaitingLabel,
} from '../../app/catalogBootstrap';
import {
  CATALOG_SURFACE_FADE_MS,
  prefersCatalogSurfaceFadeInstant,
} from '../shared/CatalogResultsFade/catalogSurfaceFade';
import './CatalogBootstrapOverlay.scss';

const APP_ROOT_ID = 'root';

function isOverlayForcedOpen(phase) {
  return phase === 'blocking' || phase === 'error';
}

function CatalogBootstrapOverlay({
  catalogBootstrap,
  retryCatalogBootstrap,
  holdUntilSurface = false,
  onRevealSurface,
}) {
  const panelRef = useRef(null);
  const retryRef = useRef(null);
  const previousFocusRef = useRef(null);
  const revealRef = useRef(onRevealSurface);
  revealRef.current = onRevealSurface;
  const phase = catalogBootstrap?.phase || 'idle';
  const progress = Math.max(0, Math.min(100, Number(catalogBootstrap?.progress) || 0));
  const label = catalogBootstrap?.label || '';
  const error = catalogBootstrap?.error;
  const open = isOverlayForcedOpen(phase) || holdUntilSurface;
  const waitForShowcase = Boolean(catalogBootstrap?.waitForShowcase);
  const renderRef = useRef(open);
  const [render, setRender] = useState(open);
  const [exiting, setExiting] = useState(false);
  const isError = phase === 'error';
  const percent = Math.floor(progress);
  const displayPercent = Math.min(99, percent);
  const headline = catalogBootstrapHeadline(catalogBootstrap);
  const valueText = catalogBootstrapValueText(catalogBootstrap);
  const isWaiting = isCatalogWaitingLabel(label);
  const caption =
    isCatalogBytesLabel(label) || isWaiting
      ? CATALOG_BOOTSTRAP_LOADING_LABEL
      : label || CATALOG_BOOTSTRAP_LOADING_LABEL;

  useEffect(() => {
    if (open) {
      renderRef.current = true;
      setRender(true);
      setExiting(false);
      return undefined;
    }
    if (!renderRef.current) return undefined;

    revealRef.current?.();
    if (prefersCatalogSurfaceFadeInstant() || !waitForShowcase) {
      renderRef.current = false;
      setRender(false);
      setExiting(false);
      return undefined;
    }

    setExiting(true);
    const timer = window.setTimeout(() => {
      renderRef.current = false;
      setRender(false);
      setExiting(false);
    }, CATALOG_SURFACE_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [open, waitForShowcase]);

  useEffect(() => {
    if (!render) return undefined;

    previousFocusRef.current = document.activeElement;
    const appRoot = document.getElementById(APP_ROOT_ID);
    if (appRoot) appRoot.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTarget = () => {
      if (isError) {
        retryRef.current?.focus();
        return;
      }
      panelRef.current?.focus();
    };
    const raf = requestAnimationFrame(focusTarget);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const nodes = Array.from(focusable);
      if (nodes.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = false;
      previousFocusRef.current?.focus?.();
    };
  }, [render, isError]);

  if (!render || typeof document === 'undefined' || !document.body) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className={[
        'catalog-bootstrap-overlay',
        exiting ? 'catalog-bootstrap-overlay--exit' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="catalog-bootstrap-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={panelRef}
        className="catalog-bootstrap-overlay__panel"
        tabIndex={-1}
        role={isError ? 'alert' : 'progressbar'}
        aria-busy={isError ? undefined : true}
        aria-live={isError ? 'assertive' : 'polite'}
        aria-valuemin={isError ? undefined : 0}
        aria-valuemax={isError ? undefined : 100}
        aria-valuenow={isError ? undefined : displayPercent}
        aria-valuetext={isError ? undefined : valueText}
        aria-label={isError ? error || 'Не удалось загрузить каталог.' : valueText}
      >
        {isError ? (
          <>
            <p className="catalog-bootstrap-overlay__error">{error}</p>
            <Button
              ref={retryRef}
              type="primary"
              className="catalog-bootstrap-overlay__retry"
              onClick={() => retryCatalogBootstrap?.()}
            >
              Повторить
            </Button>
          </>
        ) : (
          <>
            <div className="catalog-bootstrap-overlay__meters">
              <div
                className={[
                  'catalog-bootstrap-overlay__circle',
                  isWaiting ? 'catalog-bootstrap-overlay__circle--waiting' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  className="catalog-bootstrap-overlay__spinner"
                  aria-hidden="true"
                />
                {isWaiting ? null : (
                  <span className="catalog-bootstrap-overlay__percent">
                    {headline}
                  </span>
                )}
              </div>
              {isWaiting ? (
                <p className="catalog-bootstrap-overlay__percent">{headline}</p>
              ) : null}
            </div>
            <p className="catalog-bootstrap-overlay__label">{caption}</p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default CatalogBootstrapOverlay;
