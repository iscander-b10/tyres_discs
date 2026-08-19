import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import { ReactComponent as UserIcon } from '../../icons/User.svg';
import { SITE_NAV_ITEMS, SITE_PHONE } from '../../config/site';
import { PATHS } from '../../app/paths';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import { useCart } from '../../cart/CartContext';
import HoverTooltip from '../shared/HoverTooltip';
import ThemeSwitch from '../shared/ThemeSwitch/ThemeSwitch';
import './SiteHeader.scss';

function navClassName({ isActive }) {
  return ['site-nav-item', isActive ? 'is-active' : ''].filter(Boolean).join(' ');
}

function SiteHeader({
  appearance = 'light',
  onAppearanceChange,
}) {
  const { handleBrandClick } = useAppShell();
  const { isAuthenticated, logout } = useAuth();
  const { totalQuantity } = useCart();
  const location = useLocation();
  const loginState =
    location.pathname === PATHS.login
      ? location.state
      : { from: `${location.pathname}${location.search}` };

  const badgeLabel =
    totalQuantity > 99 ? '99+' : totalQuantity > 0 ? String(totalQuantity) : null;
  const brandPath = isAuthenticated ? PATHS.tyres : PATHS.home;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__top">
          <Link
            className="site-brand"
            to={brandPath}
            onClick={handleBrandClick}
          >
            <span className="site-brand__mark">IVANOR</span>
          </Link>

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

            {isAuthenticated ? (
              <button
                type="button"
                className="site-header__icon-btn"
                aria-label="Выйти"
                onClick={logout}
              >
                <UserIcon className="site-header__icon-btn-icon" aria-hidden />
                <span className="site-header__icon-label">Выйти</span>
              </button>
            ) : (
              <NavLink
                className={({ isActive }) =>
                  [
                    'site-header__icon-btn',
                    isActive ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                to={PATHS.login}
                end
                state={loginState}
                aria-label="Войти"
              >
                <UserIcon className="site-header__icon-btn-icon" aria-hidden />
                <span className="site-header__icon-label">Войти</span>
              </NavLink>
            )}

            <NavLink
              className={({ isActive }) =>
                [
                  'site-header__icon-btn',
                  isActive ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
              to={PATHS.basket}
              end
              aria-label={
                totalQuantity > 0
                  ? `Корзина, ${totalQuantity}`
                  : 'Корзина'
              }
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
            </NavLink>
          </div>
        </div>

        <nav className="site-header__nav" aria-label="Категории каталога">
          <div className="site-header__nav-list">
            {SITE_NAV_ITEMS.map((item) => {
              if (item.disabled || !item.path) {
                const button = (
                  <button
                    type="button"
                    className="site-nav-item is-disabled"
                    disabled
                  >
                    {item.label}
                  </button>
                );

                return (
                  <HoverTooltip key={item.key} title="Скоро">
                    <span className="site-nav-item-wrap">{button}</span>
                  </HoverTooltip>
                );
              }

              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end
                  className={navClassName}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
