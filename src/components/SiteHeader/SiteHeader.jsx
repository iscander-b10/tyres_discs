import React, { useEffect, useRef, useState } from 'react';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import { ReactComponent as UserIcon } from '../../icons/User.svg';
import { ReactComponent as ThemeIcon } from '../../icons/Theme.svg';
import { THEME_TRANSITION_MS } from '../../theme/appearance';
import HoverTooltip from '../shared/HoverTooltip';
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
  const isDark = appearance === 'dark';
  const themeActionLabel = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
  const themeTooltip = isDark ? 'Светлая тема' : 'Тёмная тема';
  const [isThemePending, setIsThemePending] = useState(false);
  const themeTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (themeTimeoutRef.current != null) {
        window.clearTimeout(themeTimeoutRef.current);
      }
    };
  }, []);

  const handleThemeToggle = () => {
    if (isThemePending) return;

    const nextAppearance = isDark ? 'light' : 'dark';
    setIsThemePending(true);
    onAppearanceChange?.(nextAppearance);

    themeTimeoutRef.current = window.setTimeout(() => {
      themeTimeoutRef.current = null;
      setIsThemePending(false);
    }, THEME_TRANSITION_MS);
  };

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
            <a className="site-header__phone" href="tel:+78002508850">
              <PhoneIcon className="site-header__phone-icon" aria-hidden />
              <span>8 800 250 88 50</span>
            </a>

            <button
              type="button"
              className="site-header__icon-btn"
              aria-label="Личный кабинет"
            >
              <UserIcon className="site-header__icon-btn-icon" aria-hidden />
              <span className="site-header__icon-label">Войти</span>
            </button>

            <button
              type="button"
              className="site-header__icon-btn"
              aria-label="Корзина"
            >
              <ShoppingCartOutlined aria-hidden />
              <span className="site-header__icon-label">Корзина</span>
            </button>
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

          <HoverTooltip title={themeTooltip} placement="bottom">
            <button
              type="button"
              className={[
                'site-header__theme-btn',
                isDark ? 'is-to-light' : 'is-to-dark',
                isThemePending ? 'is-pending' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={themeActionLabel}
              aria-pressed={isDark}
              aria-busy={isThemePending || undefined}
              disabled={isThemePending}
              onClick={handleThemeToggle}
            >
              <ThemeIcon className="site-header__theme-btn-icon" aria-hidden />
            </button>
          </HoverTooltip>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
