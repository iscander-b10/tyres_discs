import React, { useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button, Flex, Typography, message } from 'antd';
import { CloseOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { resolvePhotoUrl } from '../../../utils/fetchSupplier';
import './CatalogItemModalWindow.scss';

const { Text, Title } = Typography;

const isValidPrice = (value) => {
  if (value == null || value === '') return false;
  const num =
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(num) && num > 0;
};

const formatPriceDisplay = (value) => {
  if (!isValidPrice(value)) return '—';
  const num =
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return `${num.toLocaleString('ru-RU')} руб.`;
};

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

  const priceRows = useMemo(() => {
    if (!item) return [];

    if (isClientMode) {
      return [
        {
          key: 'selling',
          label: 'Цена',
          value: formatPriceDisplay(item.sellingPrice ?? item.price),
          emphasize: true,
        },
      ];
    }

    return [
      { key: 'b2b', label: 'B2B', value: item.price, show: isValidPrice(item.price) },
      {
        key: 'website',
        label: 'Интернет цена',
        value: item.websitePrice,
        show: isValidPrice(item.websitePrice),
      },
      {
        key: 'selling',
        label: 'Цена',
        value: item.sellingPrice ?? item.price,
        show: isValidPrice(item.sellingPrice) || isValidPrice(item.price),
        emphasize: true,
      },
    ]
      .filter((row) => row.show)
      .map(({ show, value, ...row }) => ({
        ...row,
        value: formatPriceDisplay(value),
      }));
  }, [item, isClientMode]);

  const specs = useMemo(() => {
    if (!item) return [];
    const rows = [];
    if (item.brand) rows.push({ label: 'Бренд', value: item.brand });
    if (item.sizeTitle) rows.push({ label: 'Размер', value: item.sizeTitle });
    if (item.width != null) rows.push({ label: 'Ширина', value: String(item.width) });
    if (item.profile != null) rows.push({ label: 'Профиль', value: String(item.profile) });
    if (item.diameter != null) rows.push({ label: 'Диаметр', value: String(item.diameter) });
    if (item.color) rows.push({ label: 'Цвет', value: item.color });
    if (item.code) rows.push({ label: 'Код', value: item.code });
    if (item.amount != null) rows.push({ label: 'В наличии', value: `${item.amount} шт.` });
    if (item.runflat) rows.push({ label: 'Runflat', value: 'Да' });
    if (!isClientMode && item.supplier) {
      rows.push({ label: 'Поставщик', value: item.supplier });
    }
    return rows;
  }, [item, isClientMode]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAddToCart = () => {
    message.info('Корзина скоро будет доступна');
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
          icon={<CloseOutlined />}
          onClick={onClose}
          aria-label="Закрыть"
        />

        <div className="product-modal__layout">
          <div className="product-modal__media">
            <img
              src={photoSrc}
              alt={item.title}
              className="product-modal__image"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/800x600?text=No+Image';
              }}
            />
          </div>

          <div className="product-modal__info">
            <Title id="product-modal-title" level={3} className="product-modal__title">
              {item.title}
            </Title>

            {(item.brand || item.sizeTitle) && (
              <Text className="product-modal__subtitle">
                {[item.brand, item.sizeTitle].filter(Boolean).join(', ')}
              </Text>
            )}

            {specs.length > 0 && (
              <dl className="product-modal__specs">
                {specs.map((row) => (
                  <div key={row.label} className="product-modal__spec-row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="product-modal__prices">
              {priceRows.map((row) => (
                <Flex
                  key={row.key}
                  className={[
                    'product-modal__price-row',
                    row.emphasize ? 'is-emphasize' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  justify="space-between"
                  align="baseline"
                >
                  <Text className="product-modal__price-label">{row.label}</Text>
                  <Text className="product-modal__price-value">{row.value}</Text>
                </Flex>
              ))}
            </div>

            <Button
              className="product-modal__cart-btn"
              type="primary"
              size="large"
              icon={<ShoppingCartOutlined />}
              onClick={handleAddToCart}
              block
            >
              В корзину
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CatalogItemModalWindow;
