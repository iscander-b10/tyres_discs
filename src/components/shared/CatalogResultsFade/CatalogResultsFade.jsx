import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CATALOG_SURFACE_FADE_MS,
  prefersCatalogSurfaceFadeInstant,
} from './catalogSurfaceFade';
import './CatalogResultsFade.scss';

/**
 * Opacity 0↔1 для зоны результатов каталога. Старое гаснет, затем новое проявляется.
 * Без transform и без stagger детей.
 */
const CatalogResultsFade = ({ viewKey, children, hold = false }) => {
  const [displayed, setDisplayed] = useState({ key: viewKey, node: children });
  const [opacityOn, setOpacityOn] = useState(true);
  const [reveal, setReveal] = useState(false);
  const pendingRef = useRef({ key: viewKey, node: children });
  pendingRef.current = { key: viewKey, node: children };
  const displayedKeyRef = useRef(viewKey);
  const wasHoldRef = useRef(hold);

  useLayoutEffect(() => {
    if (viewKey !== displayed.key) return;
    setDisplayed({ key: viewKey, node: children });
  }, [children, viewKey, displayed.key]);

  useEffect(() => {
    if (viewKey === displayedKeyRef.current) return undefined;

    const swapToPending = () => {
      const next = pendingRef.current;
      displayedKeyRef.current = next.key;
      setDisplayed({ key: next.key, node: next.node });
      if (prefersCatalogSurfaceFadeInstant()) {
        setOpacityOn(true);
        return;
      }
      setOpacityOn(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpacityOn(true);
        });
      });
    };

    if (prefersCatalogSurfaceFadeInstant()) {
      swapToPending();
      return undefined;
    }

    setOpacityOn(false);
    const timer = window.setTimeout(swapToPending, CATALOG_SURFACE_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [viewKey]);

  useEffect(() => {
    const wasHold = wasHoldRef.current;
    wasHoldRef.current = hold;
    if (hold) {
      setReveal(false);
      return undefined;
    }
    if (!wasHold || prefersCatalogSurfaceFadeInstant()) {
      setReveal(false);
      return undefined;
    }
    setReveal(true);
    const timer = window.setTimeout(() => {
      setReveal(false);
    }, CATALOG_SURFACE_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [hold]);

  const hidden = (hold || !opacityOn) && !reveal;
  const instant = hold || prefersCatalogSurfaceFadeInstant();
  const className = [
    'catalog-results-fade',
    hidden ? 'catalog-results-fade--hidden' : '',
    instant ? 'catalog-results-fade--instant' : '',
    reveal ? 'catalog-results-fade--reveal' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={className}>{displayed.node}</div>;
};

export default CatalogResultsFade;
