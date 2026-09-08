import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import {
  SITE_BRAND,
  SITE_PHONE,
  SITE_PRODUCT_NAV,
  SITE_SERVICE_NAV,
} from '../../config/site';
import {
  DEFAULT_STORE_PROFILE_ID,
  getStoreProfile,
} from '../../config/stores';
import { DEFAULT_APP_HOME, PATHS, isDemoPath, loginLinkTarget, toAppPath } from '../../app/paths';
import { canUseApp } from '../../app/appMode';
import { useAppShell } from '../../app/AppShellContext';
import { useAuth } from '../../auth/AuthContext';
import HoverTooltip from '../shared/HoverTooltip';
import './SiteFooter.scss';

function NavColumn({ label, items }) {
  return (
    <nav className="site-footer__col" aria-label={label}>
      <h2 className="site-footer__heading">{label}</h2>
      <ul className="site-footer__list">
        {items.map((item) => (
          <li key={item.key} className="site-footer__list-item">
            {item.disabled || !item.path ? (
              <HoverTooltip title="Скоро">
                <span className="site-footer__link-wrap">
                  <button
                    type="button"
                    className="site-footer__link is-disabled"
                    disabled
                  >
                    {item.label}
                  </button>
                </span>
              </HoverTooltip>
            ) : (
              <Link className="site-footer__link" to={item.path}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SiteFooter() {
  const { handleBrandClick } = useAppShell();
  const { isAuthenticated, workspace } = useAuth();
  const location = useLocation();
  const demo = isDemoPath(location.pathname);
  const staffCatalog = canUseApp(isAuthenticated, location.pathname) && !demo;
  const storeProfile = demo
    ? getStoreProfile(DEFAULT_STORE_PROFILE_ID)
    : staffCatalog
      ? getStoreProfile(workspace?.storeId)
      : null;
  const brandName = storeProfile?.displayName ?? SITE_BRAND;
  const phone = storeProfile?.phone ?? SITE_PHONE;
  const brandPath = demo
    ? toAppPath(location.pathname, PATHS.tyres)
    : isAuthenticated
      ? DEFAULT_APP_HOME
      : PATHS.home;
  const loginTarget = loginLinkTarget(location);

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__grid">
          <div className="site-footer__col site-footer__col--brand">
            <Link
              className="site-footer__brand"
              to={brandPath}
              onClick={handleBrandClick}
            >
              <span className="site-footer__brand-mark">{brandName}</span>
            </Link>
          </div>

          <NavColumn
            label="Каталог"
            items={SITE_PRODUCT_NAV.map((item) =>
              item.path
                ? { ...item, path: toAppPath(location.pathname, item.path) }
                : item
            )}
          />
          <NavColumn label="Услуги" items={SITE_SERVICE_NAV} />

          <div className="site-footer__col site-footer__col--contacts">
            <h2 className="site-footer__heading">Контакты</h2>
            <ul className="site-footer__list">
              <li className="site-footer__list-item">
                <a className="site-footer__contact-link" href={phone.href}>
                  <PhoneIcon
                    className="site-footer__contact-icon"
                    aria-hidden
                  />
                  <span>{phone.display}</span>
                </a>
              </li>
            </ul>
          </div>

          {demo ? null : (
          <nav className="site-footer__col" aria-label="Аккаунт">
            <h2 className="site-footer__heading">Аккаунт</h2>
            <ul className="site-footer__list">
              <li className="site-footer__list-item">
                {isAuthenticated ? (
                  <HoverTooltip title="Скоро">
                    <span className="site-footer__link-wrap">
                      <button
                        type="button"
                        className="site-footer__link is-disabled"
                        aria-label="Личный кабинет"
                        disabled
                      >
                        Личный кабинет
                      </button>
                    </span>
                  </HoverTooltip>
                ) : (
                  <Link className="site-footer__link" to={loginTarget}>
                    Войти
                  </Link>
                )}
              </li>
            </ul>
          </nav>
          )}
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
