import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Spin, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useAppShell } from '../../app/AppShellContext';
import { pageFromPathname } from '../../app/paths';
import { useAuth } from '../../auth/AuthContext';
import { useCart } from '../../cart/CartContext';
import {
  getUnitSellingPrice,
  getUnitWebsitePrice,
  parseStock,
} from '../../cart/cartUtils';
import { ReactComponent as WebsiteIcon } from '../../icons/Website.svg';
import {
  CATALOG_PRICE_TOOLTIPS,
  formatPriceDisplay,
} from '../shared/catalogCopy';
import CartQtyControls from '../shared/CartQtyControls/CartQtyControls';
import CatalogItemModalWindow from '../shared/CatalogItemModalWindow/CatalogItemModalWindow';
import CatalogPriceStrip from '../shared/CatalogPriceStrip/CatalogPriceStrip';
import HoverTooltip from '../shared/HoverTooltip';
import { resolvePhotoUrl } from '../../utils/fetchSupplier';
import './BasketPage.scss';

const { Title, Text, Paragraph } = Typography;

const formatMoney = (value) => {
  if (!Number.isFinite(value) || value <= 0) return formatPriceDisplay(null);
  return `${Math.round(value).toLocaleString('ru-RU')}\u00A0руб.`;
};

function BasketLinePhoto({ photoSrc, supplier }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photoSrc]);

  if (!photoSrc || failed) return null;

  return (
    <img
      src={photoSrc}
      alt=""
      className="basket-line__image"
      data-supplier={supplier || undefined}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function BasketPage() {
  const { clientMode: isClientMode, continueSelection } = useAppShell();
  const { isWorkspaceReady } = useAuth();
  const { pathname } = useLocation();
  const isActive = pageFromPathname(pathname) === 'basket';
  const {
    items,
    isLoaded,
    totals,
    increment,
    decrement,
    removeItem,
    clear,
  } = useCart();
  const [modalItemKey, setModalItemKey] = useState(null);
  const modalItem = useMemo(
    () => items.find((item) => item.key === modalItemKey) ?? null,
    [items, modalItemKey]
  );

  const itemKeysSignature = useMemo(
    () => items.map((row) => row.key).join('|'),
    [items]
  );

  // Entering basket / set of positions changed → select all
  const [selected, setSelected] = useState(() => new Set(items.map((row) => row.key)));

  useEffect(() => {
    if (!isActive) return;
    const keys = itemKeysSignature ? itemKeysSignature.split('|').filter(Boolean) : [];
    setSelected(new Set(keys));
  }, [isActive, itemKeysSignature]);

  if (!isWorkspaceReady || !isLoaded) {
    return (
      <section className="basket-page basket-page--empty" aria-busy="true">
        <Spin size="large" tip="Загружаем корзину" />
      </section>
    );
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const hasSelection = selected.size > 0;

  const toggleAll = (checked) => {
    if (checked) setSelected(new Set(items.map((row) => row.key)));
    else setSelected(new Set());
  };

  const toggleOne = (key, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const removeSelected = () => {
    selected.forEach((key) => removeItem(key));
    setSelected(new Set());
  };

  if (items.length === 0) {
    return (
      <section className="basket-page basket-page--empty" aria-labelledby="basket-empty-title">
        <Title id="basket-empty-title" level={2} className="basket-page__title">
          Корзина пуста
        </Title>
        <Paragraph className="basket-page__lead">
          Добавьте позиции из подбора шин или дисков.
        </Paragraph>
        <Button
          type="primary"
          className="basket-page__cta"
          size="large"
          onClick={continueSelection}
        >
          Продолжить подбор
        </Button>
      </section>
    );
  }

  const qtyLabel =
    totals.quantity === 1
      ? '1 товар'
      : totals.quantity >= 2 && totals.quantity <= 4
        ? `${totals.quantity} товара`
        : `${totals.quantity} товаров`;

  return (
    <section
      className={`basket-page${isClientMode ? ' basket-page--client' : ''}`}
      aria-labelledby="basket-title"
    >
      <header className="basket-page__header">
        <Title id="basket-title" level={2} className="basket-page__title">
          Корзина
        </Title>
      </header>

      <div className="basket-page__layout">
        <div className="basket-page__main">
          <div className="basket-toolbar">
            <Checkbox
              checked={allSelected}
              indeterminate={hasSelection && !allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
            >
              Выбрать все
            </Checkbox>
            {hasSelection ? (
              <button
                type="button"
                className="basket-toolbar__link"
                onClick={removeSelected}
              >
                Удалить выбранные
              </button>
            ) : null}
          </div>

          <ul className="basket-list">
            {items.map((item) => {
              const unit = getUnitSellingPrice(item);
              const lineTotal = unit * (item.quantity || 0);
              const websiteUnit = getUnitWebsitePrice(item);
              const websiteLineTotal = websiteUnit * (item.quantity || 0);
              const showWebsiteTotal = !isClientMode && websiteUnit > 0;
              const photoSrc = resolvePhotoUrl(item.photoUrl, item.supplier);
              const maxStock = parseStock(item.maxStock ?? item.amount);
              const storeMoney = formatMoney(lineTotal);
              const websiteMoney = formatMoney(websiteLineTotal);

              return (
                <li key={item.key} className="basket-line">
                  <div
                    className="basket-line__check"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selected.has(item.key)}
                      onChange={(e) => toggleOne(item.key, e.target.checked)}
                      aria-label={`Выбрать ${item.title}`}
                    />
                  </div>

                  <button
                    type="button"
                    className="basket-line__media"
                    data-supplier={item.supplier || undefined}
                    onClick={() => setModalItemKey(item.key)}
                    aria-label={`Открыть ${item.title}`}
                  >
                    <BasketLinePhoto
                      photoSrc={photoSrc}
                      supplier={item.supplier}
                    />
                  </button>

                  <div className="basket-line__body">
                    <Button
                      className="basket-line__remove"
                      type="text"
                      icon={<CloseOutlined aria-hidden />}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.key);
                      }}
                      aria-label={`Удалить ${item.title}`}
                    />

                    <div className="basket-line__main">
                      <button
                        type="button"
                        className="basket-line__info"
                        onClick={() => setModalItemKey(item.key)}
                      >
                        <Text className="basket-line__name">{item.title}</Text>
                        {item.sizeTitle ? (
                          <Text className="basket-line__meta basket-line__size" type="secondary">
                            {item.sizeTitle}
                          </Text>
                        ) : null}
                        {item.code ? (
                          <Text className="basket-line__meta basket-line__code" type="secondary">
                            Код: {item.code}
                          </Text>
                        ) : null}
                        {!isClientMode && item.supplier ? (
                          <Text className="basket-line__meta basket-line__supplier" type="secondary">
                            {item.supplier}
                          </Text>
                        ) : null}
                      </button>

                      <div className="basket-line__bottom">
                        <button
                          type="button"
                          className="basket-line__prices-hit"
                          onClick={() => setModalItemKey(item.key)}
                        >
                          <CatalogPriceStrip
                            item={item}
                            /* Client → store unit only; manager → B2B / Internet / store */
                            isClientMode={isClientMode}
                            className="basket-line__price-strip"
                          />
                        </button>
                      </div>
                    </div>

                    <div
                      className="basket-line__end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className={`basket-line__sums${
                          showWebsiteTotal ? ' basket-line__sums--with-web' : ''
                        }`}
                        role="group"
                        aria-label={
                          showWebsiteTotal
                            ? `${CATALOG_PRICE_TOOLTIPS.website}: ${websiteMoney}, Магазин: ${storeMoney}`
                            : `Магазин: ${storeMoney}`
                        }
                      >
                        {showWebsiteTotal ? (
                          <HoverTooltip
                            title={CATALOG_PRICE_TOOLTIPS.website}
                            placement="top"
                          >
                            <span
                              className="basket-line__sum-web"
                              aria-hidden="true"
                            >
                              <WebsiteIcon
                                className="basket-line__sum-web-icon"
                                focusable="false"
                              />
                              <span className="basket-line__sum-web-value">
                                {websiteMoney}
                              </span>
                            </span>
                          </HoverTooltip>
                        ) : null}
                        <div className="basket-line__store">
                          <div className="basket-line__qty">
                            <CartQtyControls
                              quantity={item.quantity}
                              maxStock={maxStock}
                              onDecrement={() => decrement(item.key)}
                              onIncrement={() => increment(item.key)}
                              size="small"
                            />
                          </div>
                          <span
                            className="basket-line__sum-total"
                            aria-hidden="true"
                          >
                            {storeMoney}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="basket-summary" aria-label="К заказу">
          <h3 className="basket-summary__title">К заказу</h3>
          <div className="basket-summary__row">
            <span>{qtyLabel}</span>
            <span>{formatMoney(totals.selling)}</span>
          </div>
          {!isClientMode && totals.b2b > 0 ? (
            <div className="basket-summary__row basket-summary__row--muted">
              <span>Сумма B2B</span>
              <span>{formatMoney(totals.b2b)}</span>
            </div>
          ) : null}
          <div className="basket-summary__total">
            <span>Итого</span>
            <span>{formatMoney(totals.selling)}</span>
          </div>
          <Button
            className="basket-summary__continue"
            type="primary"
            block
            size="large"
            onClick={continueSelection}
          >
            Продолжить подбор
          </Button>
          <button type="button" className="basket-summary__clear" onClick={clear}>
            Очистить корзину
          </button>
        </aside>
      </div>

      <CatalogItemModalWindow
        isOpen={Boolean(modalItem)}
        onClose={() => setModalItemKey(null)}
        item={modalItem}
        category={modalItem?.category}
        isClientMode={isClientMode}
      />
    </section>
  );
}

export default BasketPage;
