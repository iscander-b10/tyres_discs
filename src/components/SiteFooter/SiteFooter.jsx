import React from 'react';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import { ReactComponent as TelegramIcon } from '../../icons/Telegram.svg';
import {
  SITE_DEVELOPER_TELEGRAM,
  SITE_PHONE,
  SITE_PRODUCT_NAV,
  SITE_SERVICE_NAV,
} from '../../config/site';
import './SiteFooter.scss';

function NavColumn({ label, items, onNavigate }) {
  return (
    <nav className="site-footer__col" aria-label={label}>
      <h2 className="site-footer__heading">{label}</h2>
      <ul className="site-footer__list">
        {items.map((item) => (
          <li key={item.key} className="site-footer__list-item">
            <button
              type="button"
              className={[
                'site-footer__link',
                item.disabled ? 'is-disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) onNavigate?.(item.key);
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SiteFooter({ onActiveKeyChange, onBrandClick }) {
  const goTo = (key) => {
    onActiveKeyChange?.(key);
  };

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__grid">
          <div className="site-footer__col site-footer__col--brand">
            <a
              className="site-footer__brand"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onBrandClick?.();
              }}
            >
              <span className="site-footer__brand-mark">IVANOR</span>
            </a>
          </div>

          <NavColumn
            label="Каталог товаров"
            items={SITE_PRODUCT_NAV}
            onNavigate={goTo}
          />
          <NavColumn
            label="Каталог услуг"
            items={SITE_SERVICE_NAV}
            onNavigate={goTo}
          />

          <div className="site-footer__col site-footer__col--contacts">
            <h2 className="site-footer__heading">Контакты</h2>
            <ul className="site-footer__list">
              <li className="site-footer__list-item">
                <a className="site-footer__contact-link" href={SITE_PHONE.href}>
                  <PhoneIcon
                    className="site-footer__contact-icon"
                    aria-hidden
                  />
                  <span>{SITE_PHONE.display}</span>
                </a>
              </li>
            </ul>
          </div>

          <nav className="site-footer__col" aria-label="Клиентам">
            <h2 className="site-footer__heading">Клиентам</h2>
            <ul className="site-footer__list">
              <li className="site-footer__list-item">
                <button
                  type="button"
                  className="site-footer__link"
                  aria-label="Личный кабинет"
                >
                  Личный кабинет
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <p className="site-footer__credit">
          <span className="site-footer__credit-label">Разработка сайта</span>
          <a
            className="site-footer__credit-link"
            href={SITE_DEVELOPER_TELEGRAM.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            <TelegramIcon
              className="site-footer__credit-icon"
              aria-hidden
            />
            <span>{SITE_DEVELOPER_TELEGRAM.handle}</span>
          </a>
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
