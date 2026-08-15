import React, { useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { resolvePhotoUrl } from '../../../utils/fetchSupplier';
import AddToCartControl from '../AddToCartControl/AddToCartControl';
import CatalogPriceStrip from '../CatalogPriceStrip/CatalogPriceStrip';
import CatalogItemPromoBadges from '../CatalogItemPromoBadges/CatalogItemPromoBadges';
import {
  CATALOG_IMAGE_FALLBACK,
  formatCatalogSizeDisplay,
  formatCatalogStockDisplay,
  resolveCatalogLoadIndex,
  resolveCatalogModel,
  resolveCatalogSpeedIndex,
} from '../catalogCopy';
import './CatalogItemModalWindow.scss';

const CatalogItemModalWindow = ({ isOpen, onClose, item, isClientMode = false }) => {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => closeBtnRef.current?.focus());
    } else {
      document.body.style.overflow = '';
      previouslyFocusedRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const nodes = Array.from(focusable);
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const photoSrc = useMemo(
    () => (item ? resolvePhotoUrl(item.photoUrl, item.supplier) : ''),
    [item]
  );

  const model = useMemo(() => resolveCatalogModel(item), [item]);
  const sizeDisplay = useMemo(() => formatCatalogSizeDisplay(item), [item]);
  const loadIndex = useMemo(() => resolveCatalogLoadIndex(item), [item]);
  const speedIndex = useMemo(() => resolveCatalogSpeedIndex(item), [item]);

  const metaFields = useMemo(() => {
    if (!item) return [];
    const fields = [];

    if (item.brand) fields.push({ key: 'brand', label: 'Бренд', value: item.brand });
    if (model) fields.push({ key: 'model', label: 'Модель', value: model });
    if (sizeDisplay) {
      fields.push({ key: 'size', label: 'Типоразмер', value: sizeDisplay });
    }
    if (loadIndex) {
      fields.push({ key: 'loadIndex', label: 'Индекс нагрузки', value: loadIndex });
    }
    if (speedIndex) {
      fields.push({ key: 'speedIndex', label: 'Индекс скорости', value: speedIndex });
    }
    if (item.code) fields.push({ key: 'code', label: 'Код', value: item.code });

    const stock = formatCatalogStockDisplay(item.amount);
    if (stock) fields.push({ key: 'stock', label: 'В наличии', value: stock });

    if (!isClientMode && item.supplier) {
      fields.push({ key: 'supplier', label: 'Поставщик', value: item.supplier });
    }
    return fields;
  }, [item, isClientMode, model, sizeDisplay, loadIndex, speedIndex]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen || !item) return null;

  return ReactDOM.createPortal(
    <div
      className="product-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="product-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          ref={closeBtnRef}
          className="product-modal__close"
          type="text"
          icon={<CloseOutlined aria-hidden="true" />}
          onClick={onClose}
          aria-label="Закрыть"
        />

        <div className="product-modal__layout">
          <div className="product-modal__stage">
            <div className="product-modal__frame">
              <img
                src={photoSrc}
                alt={item.title}
                className="product-modal__image"
                data-supplier={item.supplier || undefined}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.target.src = CATALOG_IMAGE_FALLBACK;
                }}
              />
              <CatalogItemPromoBadges item={item} variant="modal" />
            </div>
          </div>

          <aside className="product-modal__meta">
            <header className="product-modal__header">
              <h2 id="product-modal-title" className="product-modal__title">
                {item.title}
              </h2>
              {sizeDisplay ? (
                <p className="product-modal__subtitle">{sizeDisplay}</p>
              ) : null}
            </header>

            {metaFields.length > 0 && (
              <dl className="product-modal__meta-fields">
                {metaFields.map((field) => (
                  <div key={field.key} className="product-modal__meta-field">
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="product-modal__footer">
              <CatalogPriceStrip
                item={item}
                isClientMode={isClientMode}
                className="product-modal__prices"
              />

              <AddToCartControl
                item={item}
                className="product-modal__cart-control"
                onGoToCart={() => {
                  onClose?.();
                }}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CatalogItemModalWindow;
