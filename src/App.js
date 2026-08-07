import React, { useState } from 'react';
import { Flex, Layout, Switch } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { ReactComponent as PhoneIcon } from './icons/Phone.svg';
import { ReactComponent as UserIcon } from './icons/User.svg';
import TiresSearchParameters from './components/TiresSearchParameters/TiresSearchParameters';
import DiscsSearchParameters from './components/DiscsSearchParameters/DiscsSearchParameters';
import SideBar from './components/SideBar/SideBar';
import HoverTooltip from './components/shared/HoverTooltip';
import './App.scss';

const NAV_ITEMS = [
  { key: 'tires', label: 'Шины' },
  { key: 'disks', label: 'Диски' },
  { key: 'akb', label: 'АКБ', disabled: true },
  { key: 'sensors', label: 'Датчики давления', disabled: true },
  { key: 'fitting', label: 'Примерка дисков', disabled: true },
  { key: 'service', label: 'Шиномонтаж', disabled: true },
];

function App({ appearance = 'light', onAppearanceChange }) {
  const [clientMode, setClientMode] = useState(true);
  const [activeKey, setActiveKey] = useState('tires');
  const [catalogDataVersion, setCatalogDataVersion] = useState(0);
  const isDark = appearance === 'dark';

  return (
    <Layout className="app-layout">
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__top">
            <a className="site-brand" href="/" onClick={(e) => e.preventDefault()}>
              <span className="site-brand__mark">IVANOR</span>
            </a>

            <div className="site-header__actions">
              <label className="site-header__theme">
                <span className="site-header__theme-label">Тёмная тема</span>
                <Switch
                  size="small"
                  checked={isDark}
                  onChange={(checked) => onAppearanceChange?.(checked ? 'dark' : 'light')}
                  aria-label="Переключить тёмную тему"
                />
              </label>

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
          </nav>
        </div>
      </header>

      <Layout className="app-content-layout">
        <Layout.Content className="app-content">
          <Flex className="app-content-wrapper" vertical>
            {activeKey === 'tires' ? (
              <TiresSearchParameters
                isClientMode={clientMode}
                catalogDataVersion={catalogDataVersion}
              />
            ) : (
              <DiscsSearchParameters
                isClientMode={clientMode}
                catalogDataVersion={catalogDataVersion}
              />
            )}
          </Flex>
        </Layout.Content>
      </Layout>

      <SideBar
        clientMode={clientMode}
        setClientMode={setClientMode}
        onCatalogDataLoaded={() => setCatalogDataVersion((v) => v + 1)}
      />
    </Layout>
  );
}

export default App;
