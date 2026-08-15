import React from 'react';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import { ReactComponent as UserIcon } from '../../icons/User.svg';
import { SITE_NAV_ITEMS, SITE_PHONE } from '../../config/site';
import { useAppShell } from '../../app/AppShellContext';
import { useCart } from '../../cart/CartContext';
import HoverTooltip from '../shared/HoverTooltip';
import ThemeSwitch from '../shared/ThemeSwitch/ThemeSwitch';
import './SiteHeader.scss';

function SiteHeader({
  appearance = 'light',
  onAppearanceChange,
}) {
  const { activeKey, setActiveKey, goToBasket, handleBrandClick } = useAppShell();
  const { totalQuantity } = useCart();
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
              handleBrandClick();
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

              <a className="site-header__phone" href={SITE_PHONE.href}>
                <PhoneIcon className="site-header__phone-icon" aria-hidden />
                <span>{SITE_PHONE.display}</span>
              </a>
            </div>

            <HoverTooltip title="Скоро">
              <span className="site-header__icon-btn-wrap">
                <button
                  type="button"
                  className="site-header__icon-btn is-disabled"
                  aria-label="Личный кабинет"
                  disabled
                >
                  <UserIcon className="site-header__icon-btn-icon" aria-hidden />
                  <span className="site-header__icon-label">Войти</span>
                </button>
              </span>
            </HoverTooltip>

            <button
              type="button"
              className="site-header__icon-btn"
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

        <nav className="site-header__nav" aria-label="Категории каталога">
          <div className="site-header__nav-list">
            {SITE_NAV_ITEMS.map((item) => {
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
                    if (!item.disabled) setActiveKey(item.key);
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
