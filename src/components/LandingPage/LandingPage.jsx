import React from 'react';
import { Link } from 'react-router-dom';
import {
  AppstoreOutlined,
  PhoneOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Flex, Tooltip } from 'antd';
import { PATHS } from '../../app/paths';
import { SITE_PHONE } from '../../config/site';
import './LandingPage.scss';

const FEATURES = [
  {
    key: 'search',
    icon: SearchOutlined,
    title: 'Поиск по параметрам',
    text: 'Ширина, профиль, диаметр, сезон, тип диска — фильтруйте так же, как привыкли в зале. Без лишних шагов.',
  },
  {
    key: 'compare',
    icon: AppstoreOutlined,
    title: 'Сравнение в одном окне',
    text: 'Наличие и цены — рядом, на одном экране. Не нужно прыгать между вкладками и чужими сайтами.',
  },
  {
    key: 'cart',
    icon: ShoppingCartOutlined,
    title: 'Корзина и режим для клиента',
    text: 'Сложите подборку в корзину и покажите клиенту только нужное — служебные детали спрячутся сами.',
  },
  {
    key: 'prices',
    icon: TeamOutlined,
    title: 'Актуальные остатки и цены',
    text: 'После входа каталог подтягивает свежие данные из облака автоматически.',
  },
];

const LOGIN_STATE = { from: PATHS.tyres };

function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-page__hero" aria-labelledby="landing-hero-title">
        <p className="landing-page__eyebrow">IVANOR</p>
        <h1 id="landing-hero-title" className="landing-page__title">
          Каталог шин и дисков
        </h1>
        <p className="landing-page__lead">
          Подбирайте шины и диски за столом и показывайте клиенту подборку на месте.
          Войдите — откроются актуальные остатки и цены.
        </p>
        <a className="landing-page__phone" href={SITE_PHONE.href}>
          <PhoneOutlined aria-hidden />
          <span>{SITE_PHONE.display}</span>
        </a>
      </section>

      <section className="landing-page__features" aria-labelledby="landing-features-title">
        <h2 id="landing-features-title" className="landing-page__section-title">
          Для работы в зале
        </h2>
        <ul className="landing-page__feature-grid">
          {FEATURES.map(({ key, icon: Icon, title, text }) => (
            <li key={key}>
              <Card className="landing-page__feature-card" bordered={false}>
                <Flex vertical gap={12}>
                  <span className="landing-page__feature-icon" aria-hidden>
                    <Icon />
                  </span>
                  <h3 className="landing-page__feature-title">{title}</h3>
                  <p className="landing-page__feature-text">{text}</p>
                </Flex>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-page__cta" aria-labelledby="landing-cta-title">
        <div className="landing-page__cta-inner">
          <h2 id="landing-cta-title" className="landing-page__cta-title">
            Готовы подобрать?
          </h2>
          <p className="landing-page__cta-text">
            Вход для сотрудников магазина. После авторизации попадёте в каталог — начнёте с шин.
          </p>
          <Flex className="landing-page__cta-actions" gap={12} wrap="wrap">
            <Link to={PATHS.login} state={LOGIN_STATE}>
              <Button type="primary" size="large">
                Войти
              </Button>
            </Link>
            <Tooltip title="Скоро">
              <span className="landing-page__demo-wrap">
                <Button size="large" disabled>
                  Посмотреть демо
                </Button>
              </span>
            </Tooltip>
          </Flex>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
