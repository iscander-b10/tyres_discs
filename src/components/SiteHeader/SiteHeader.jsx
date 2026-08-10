import React from 'react';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import { ReactComponent as UserIcon } from '../../icons/User.svg';
import { useCart } from '../../cart/CartContext';
import HoverTooltip from '../shared/HoverTooltip';
import ThemeSwitch from '../shared/ThemeSwitch/ThemeSwitch';
import './SiteHeader.scss';

const NAV_ITEMS = [
  { key: 'tires', label: 'Шины' },
  { key: 'disks', label: 'Диски' },
  { key: 'sensors', label: 'Датчики давления', disabled: true },
  { key: 'fitting', label: 'Примерка дисков', disabled: true },
  { key: 'service', label: 'Шиномонтаж', disabled: true },
  { key: 'storage', label: 'Хранение шин', disabled: true },
];

function SiteHeader({
  appearance = 'light',
  onAppearanceChange,
  activeKey,
  onActiveKeyChange,
  onBrandClick,
}) {
  const { totalQuantity, goToBasket } = useCart();
  const cartActive = activeKey === 'basket';
  const badgeLabel =
    totalQuantity > 99 ? '99+' : totalQuantity > 0 ? String(totalQuantity) : null;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__top">
          <a
            className="site-brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onBrandClick?.();
            }}
          >
            <span className="site-brand__mark">IVANOR</span>
          </a>

          <div className="site-header__actions">
            <div className="site-header__contact">
              <ThemeSwitch
                appearance={appearance}
                onAppearanceChange={onAppearanceChange}
              />

              <a className="site-header__phone" href="tel:+78002508850">
                <PhoneIcon className="site-header__phone-icon" aria-hidden />
                <span>8 800 250 88 50</span>
              </a>
            </div>

            <button
              type="button"
              className="site-header__icon-btn"
              aria-label="Личный кабинет"
            >
              <UserIcon className="site-header__icon-btn-icon" aria-hidden />
              <span className="site-header__icon-label">Войти</span>
            </button>

            <div
              className={[
                'site-header__cart-shell',
                cartActive ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                className={[
                  'site-header__icon-btn',
                  'site-header__cart-btn',
                  cartActive ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={
                  totalQuantity > 0
                    ? `Корзина, ${totalQuantity}`
                    : 'Корзина'
                }
                aria-current={cartActive ? 'page' : undefined}
                onClick={() => goToBasket()}
              >
                <span className="site-header__cart-icon-wrap">
                  <ShoppingCartOutlined aria-hidden />
                  {badgeLabel ? (
                    <span className="site-header__cart-badge" aria-hidden>
                      {badgeLabel}
                    </span>
                  ) : null}
                </span>
                <span className="site-header__icon-label">Корзина</span>
              </button>
            </div>
          </div>
        </div>

        <nav className="site-header__nav" aria-label="Категории каталога">
          <div className="site-header__nav-list">
            {NAV_ITEMS.map((item) => {
              const isActive = !item.disabled && item.key === activeKey;
              const button = (
                <button
                  type="button"
                  className={[
                    'site-nav-item',
                    isActive ? 'is-active' : '',
                    item.disabled ? 'is-disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={item.disabled}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    if (!item.disabled) onActiveKeyChange?.(item.key);
                  }}
                >
                  {item.label}
                </button>
              );

              if (item.disabled) {
                return (
                  <HoverTooltip key={item.key} title="Скоро">
                    <span className="site-nav-item-wrap">{button}</span>
                  </HoverTooltip>
                );
              }

              return <React.Fragment key={item.key}>{button}</React.Fragment>;
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
