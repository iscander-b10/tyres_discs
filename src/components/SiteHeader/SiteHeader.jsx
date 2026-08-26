import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LeftOutlined,
  RightOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import { ReactComponent as UserIcon } from '../../icons/User.svg';
import { SITE_NAV_ITEMS, SITE_PHONE } from '../../config/site';
import {
  DEFAULT_APP_HOME,
  PATHS,
  appHomePath,
  isDemoPath,
  loginLinkTarget,
  toAppPath,
} from '../../app/paths';
import { canUseApp } from '../../app/appMode';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import { useLogout } from '../../auth/useLogout';
import { useCart } from '../../cart/CartContext';
import HoverTooltip from '../shared/HoverTooltip';
import ThemeSwitch from '../shared/ThemeSwitch/ThemeSwitch';
import { useSiteHeaderNavScroll } from './useSiteHeaderNavScroll';
import './SiteHeader.scss';

function navClassName({ isActive }) {
  return ['site-nav-item', isActive ? 'is-active' : ''].filter(Boolean).join(' ');
}

function SiteHeader({
  appearance = 'light',
  onAppearanceChange,
}) {
  const { handleBrandClick } = useAppShell();
  const { isAuthenticated, isWorkspaceReady } = useAuth();
  const logout = useLogout();
  const { isLoaded, totalQuantity } = useCart();
  const location = useLocation();
  const demo = isDemoPath(location.pathname);
  const loginTarget = loginLinkTarget(location);
  const appEnabled = canUseApp(isAuthenticated, location.pathname);

  const visibleQuantity =
    isWorkspaceReady && isLoaded ? totalQuantity : 0;
  const badgeLabel =
    visibleQuantity > 99
      ? '99+'
      : visibleQuantity > 0
        ? String(visibleQuantity)
        : null;
  const brandPath = demo
    ? appHomePath(location.pathname)
    : appEnabled
      ? DEFAULT_APP_HOME
      : PATHS.home;

  const { listRef, canPrev, canNext, hasOverflow, scrollByDir } =
    useSiteHeaderNavScroll(location.pathname);

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

              <a
                className="site-header__phone"
                href={SITE_PHONE.href}
                aria-label={SITE_PHONE.display}
              >
                <PhoneIcon className="site-header__phone-icon" aria-hidden />
                <span className="site-header__phone-text">
                  {SITE_PHONE.display}
                </span>
              </a>
            </div>

            {demo ? null : isAuthenticated ? (
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
                to={loginTarget}
                end
                aria-label="Войти"
              >
                <UserIcon className="site-header__icon-btn-icon" aria-hidden />
                <span className="site-header__icon-label">Войти</span>
              </NavLink>
            )}

            {appEnabled ? (
              <NavLink
                className={({ isActive }) =>
                  [
                    'site-header__icon-btn',
                    isActive ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                to={toAppPath(location.pathname, PATHS.basket)}
                end
                aria-label={
                  visibleQuantity > 0
                    ? `Корзина, ${visibleQuantity}`
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
            ) : null}
          </div>
        </div>

        <nav
          className={[
            'site-header__nav',
            hasOverflow ? 'is-overflow' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Категории каталога"
        >
          {hasOverflow ? (
            <button
              type="button"
              className="site-header__nav-scroll site-header__nav-scroll--prev"
              aria-label="Показать предыдущие категории"
              disabled={!canPrev}
              onClick={() => scrollByDir(-1)}
            >
              <LeftOutlined aria-hidden />
            </button>
          ) : null}

          <div
            ref={listRef}
            className={[
              'site-header__nav-list',
              canPrev ? 'site-header__nav-list--fade-start' : '',
              canNext ? 'site-header__nav-list--fade-end' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
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
                  to={toAppPath(location.pathname, item.path)}
                  end
                  className={navClassName}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          {hasOverflow ? (
            <button
              type="button"
              className="site-header__nav-scroll site-header__nav-scroll--next"
              aria-label="Показать следующие категории"
              disabled={!canNext}
              onClick={() => scrollByDir(1)}
            >
              <RightOutlined aria-hidden />
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
