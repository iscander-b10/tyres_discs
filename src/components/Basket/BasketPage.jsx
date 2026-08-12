import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useCart } from '../../cart/CartContext';
import {
  getUnitSellingPrice,
  parseStock,
} from '../../cart/cartUtils';
import { formatPriceDisplay } from '../shared/catalogCopy';
import CartQtyControls from '../shared/CartQtyControls/CartQtyControls';
import CatalogItemModalWindow from '../shared/CatalogItemModalWindow/CatalogItemModalWindow';
import CatalogPriceStrip from '../shared/CatalogPriceStrip/CatalogPriceStrip';
import { resolvePhotoUrl } from '../../utils/fetchSupplier';
import './BasketPage.scss';

const { Title, Text, Paragraph } = Typography;

const formatMoney = (value) => {
  if (!Number.isFinite(value) || value <= 0) return formatPriceDisplay(null);
  return `${Math.round(value).toLocaleString('ru-RU')}\u00A0руб.`;
};

function BasketPage({ isClientMode = false, onContinueSelection, isActive = true }) {
  const { items, totals, increment, decrement, removeItem, clear } = useCart();
  const [modalItem, setModalItem] = useState(null);

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
          Добавьте позиции из подбора шин или дисков — они появятся здесь со
          всеми ценами для заказа в магазин.
        </Paragraph>
        <Button
          type="primary"
          className="basket-page__cta"
          size="large"
          onClick={onContinueSelection}
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
              const photoSrc = resolvePhotoUrl(item.photoUrl, item.supplier);
              const maxStock = parseStock(item.maxStock ?? item.amount);

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
                    onClick={() => setModalItem(item)}
                    aria-label={`Открыть ${item.title}`}
                  >
                    <img
                      src={photoSrc}
                      alt=""
                      className="basket-line__image"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://via.placeholder.com/120x90?text=No+Image';
                      }}
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
                        onClick={() => setModalItem(item)}
                      >
                        {item.code ? (
                          <Text className="basket-line__code" type="secondary">
                            Код: {item.code}
                          </Text>
                        ) : null}
                        <Text className="basket-line__name">{item.title}</Text>
                        {item.sizeTitle ? (
                          <Text className="basket-line__size" type="secondary">
                            {item.sizeTitle}
                          </Text>
                        ) : null}
                        {!isClientMode && item.supplier ? (
                          <Text className="basket-line__supplier" type="secondary">
                            {item.supplier}
                          </Text>
                        ) : null}
                      </button>

                      <div className="basket-line__bottom">
                        <button
                          type="button"
                          className="basket-line__prices-hit"
                          onClick={() => setModalItem(item)}
                        >
                          <CatalogPriceStrip
                            item={item}
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
                      <div className="basket-line__sums">
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
                          <div className="basket-line__sum basket-line__sum--store">
                            <span className="basket-line__sum-total">
                              {formatMoney(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="basket-summary" aria-label="Детали подбора">
          <h3 className="basket-summary__title">Детали подбора</h3>
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
            onClick={onContinueSelection}
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
        onClose={() => setModalItem(null)}
        item={modalItem}
        isClientMode={isClientMode}
      />
    </section>
  );
}

export default BasketPage;
