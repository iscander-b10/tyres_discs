import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Flex } from 'antd';
import { PATHS, loginLinkTarget } from '../../app/paths';
import {
  SITE_DEVELOPER_PHONE,
  SITE_DEVELOPER_TELEGRAM,
} from '../../config/site';
import { ReactComponent as PhoneIcon } from '../../icons/Phone.svg';
import { ReactComponent as TelegramIcon } from '../../icons/Telegram.svg';
import './LandingPage.scss';

const PUBLIC_URL = process.env.PUBLIC_URL || '';

function landingSrc(file) {
  return `${PUBLIC_URL}/landing/${file}`;
}

/** Единый intent с хедером/футером: post-login → /tyres. */
const LOGIN_TARGET = loginLinkTarget({ pathname: '/', search: '' });

const COMPARE_PAIRS = [
  {
    key: 'stock',
    problem: {
      title: '3 на складе',
      text: 'Разукомплектованный товар лежит на складе, оборота нет.',
    },
    solution: {
      title: '+1 у поставщика',
      text: 'Один запрос: видно, у кого есть эта модель и остаток.',
    },
  },
  {
    key: 'order',
    problem: {
      title: 'Клиент ушёл',
      text: 'Просят конкретную модель, у привычного поставщика её нет.',
    },
    solution: {
      title: 'Забрали заказ',
      text: 'Товар оказался у другого поставщика.',
    },
  },
];

function DemoButton({ className }) {
  return (
    <Link to={PATHS.demo} className="landing-page__btn-link">
      <Button
        type="primary"
        size="large"
        className={['landing-page__btn', 'landing-page__btn--demo', className]
          .filter(Boolean)
          .join(' ')}
      >
        Посмотреть демо
      </Button>
    </Link>
  );
}

function VisualFrame({ src, width, height, alt, className, eager = false }) {
  return (
    <figure className={['landing-page__frame', className].filter(Boolean).join(' ')}>
      <img
        src={src}
        width={width}
        height={height}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        {...(eager ? { fetchPriority: 'high' } : {})}
      />
    </figure>
  );
}

function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-page__hero landing-page__slide" aria-labelledby="landing-hero-title">
        <img
          className="landing-page__hero-media"
          src={landingSrc('hero-catalog.png')}
          width={1920}
          height={1080}
          alt=""
          loading="eager"
          decoding="sync"
          fetchPriority="high"
        />
        <div className="landing-page__hero-scrim" aria-hidden="true" />
        <div className="landing-page__hero-copy">
          <h1 id="landing-hero-title" className="landing-page__title">
            Единый каталог шин и дисков
          </h1>
          <p className="landing-page__lead">
            Ваши поставщики, ваши цены и корзина в одном окне.
          </p>
          <Flex className="landing-page__hero-actions" gap={12} wrap="wrap">
            <DemoButton />
            <Link to={LOGIN_TARGET} className="landing-page__btn-link">
              <Button size="large" className="landing-page__btn landing-page__btn--ghost">
                Войти
              </Button>
            </Link>
          </Flex>
        </div>
      </section>

      <section className="landing-page__section landing-page__slide" aria-labelledby="landing-search-title">
        <div className="landing-page__inner">
          <h2 id="landing-search-title" className="landing-page__heading">
            Один запрос вместо повторного поиска
          </h2>
          <p className="landing-page__body">
            Шины и диски в одном каталоге, со своими формами и фильтрами.
            Цены и остатки обновляются каждый день.
          </p>
          <VisualFrame
            className="landing-page__visual"
            src={landingSrc('search-compare.png')}
            width={1280}
            height={720}
            alt="Слева несколько кабинетов поставщиков, справа один поиск по каталогу"
          />
        </div>
      </section>

      <section
        className="landing-page__section landing-page__section--compare landing-page__slide"
        aria-labelledby="landing-compare-title"
      >
        <div className="landing-page__inner">
          <h2 id="landing-compare-title" className="landing-page__heading">
            Опыт подсказывает, где искать. Каталог показывает, где есть модель.
          </h2>
          <ul className="landing-page__compare">
            {COMPARE_PAIRS.map((pair) => (
              <li key={pair.key} className="landing-page__compare-row">
                <article className="landing-page__tile landing-page__tile--problem">
                  <h3>{pair.problem.title}</h3>
                  <p>{pair.problem.text}</p>
                </article>
                <article className="landing-page__tile landing-page__tile--ok">
                  <h3>{pair.solution.title}</h3>
                  <p>{pair.solution.text}</p>
                </article>
              </li>
            ))}
          </ul>
          <p className="landing-page__footnote">
            Бренды и модели пересекаются между поставщиками. То, что привычно
            искать у одного, иногда лежит у другого.
          </p>
        </div>
      </section>

      <section
        className="landing-page__section landing-page__section--brand landing-page__slide"
        aria-labelledby="landing-brand-title"
      >
        <div className="landing-page__inner">
          <h2 id="landing-brand-title" className="landing-page__heading landing-page__heading--on-dark">
            В кадре ваш магазин
          </h2>
          <p className="landing-page__body landing-page__body--on-dark">
            Шины можно продать без демонстрации.{' '}
            <em>Диски</em> нужно показывать. Логотип на фото подчеркнёт ваш бренд, а не поставщика.
          </p>
          <VisualFrame
            className="landing-page__brand-shot"
            src={landingSrc('whitelabel.png')}
            width={1728}
            height={1117}
            alt="Окно диска с логотипом магазина на фото"
          />
        </div>
      </section>

      <section className="landing-page__section landing-page__slide" aria-labelledby="landing-devices-title">
        <div className="landing-page__inner">
          <h2 id="landing-devices-title" className="landing-page__heading">
            Заказ собирают там, где удобно
          </h2>
          <p className="landing-page__body">
            Не через общий компьютер. Не через менеджера по заказам.
          </p>
          <VisualFrame
            className="landing-page__visual"
            src={landingSrc('devices.png')}
            width={1523}
            height={748}
            alt="Каталог на компьютере, планшете и телефоне"
          />
        </div>
      </section>

      <section
        className="landing-page__section landing-page__section--prices landing-page__slide"
        aria-labelledby="landing-prices-title"
      >
        <div className="landing-page__inner landing-page__prices">
          <VisualFrame
            className="landing-page__prices-visual"
            src={landingSrc('cart-prices.png')}
            width={1432}
            height={747}
            alt="Строка корзины с B2B, интернет-ценой поставщика и ценой магазина"
          />
          <div className="landing-page__prices-copy">
            <h2 id="landing-prices-title" className="landing-page__heading">
              Розничная цена поставщика рядом со своей
            </h2>
            <p className="landing-page__body">
              Не все поставщики передают интернет-цену. Когда она есть,
              сотрудник сравнивает её со своей и даёт индивидуальные условия.
            </p>
          </div>
        </div>
      </section>

      <section
        className="landing-page__section landing-page__section--modes landing-page__slide"
        aria-labelledby="landing-modes-title"
      >
        <div className="landing-page__inner">
          <h2 id="landing-modes-title" className="landing-page__heading">
            Два режима: менеджера и клиента
          </h2>
          <p className="landing-page__body">
            Менеджер видит поставщика и служебные цены. Клиенту только цена
            магазина и остаток.
          </p>
          <div className="landing-page__modes">
            <figure className="landing-page__mode">
              <figcaption>
                <p className="landing-page__mode-label">Режим менеджера</p>
                <p className="landing-page__mode-desc">
                  Поставщик, B2B, интернет-цена, цена магазина
                </p>
              </figcaption>
              <div className="landing-page__mode-shots">
                <VisualFrame
                  src={landingSrc('manager-card.png')}
                  width={364}
                  height={655}
                  alt="Карточка товара в режиме менеджера: поставщик и служебные цены"
                />
                <VisualFrame
                  src={landingSrc('manager-modal.png')}
                  width={1283}
                  height={856}
                  alt="Окно товара в режиме менеджера: поставщик и служебные цены"
                />
              </div>
            </figure>
            <figure className="landing-page__mode">
              <figcaption>
                <p className="landing-page__mode-label">Режим клиента</p>
                <p className="landing-page__mode-desc">
                  Только цена магазина и остаток
                </p>
              </figcaption>
              <div className="landing-page__mode-shots">
                <VisualFrame
                  src={landingSrc('client-card.png')}
                  width={364}
                  height={561}
                  alt="Карточка товара в режиме клиента: цена магазина и остаток"
                />
                <VisualFrame
                  src={landingSrc('client-modal.png')}
                  width={1284}
                  height={859}
                  alt="Окно товара в режиме клиента: цена магазина без служебных полей"
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      <section className="landing-page__cta landing-page__slide" aria-labelledby="landing-cta-title">
        <div className="landing-page__inner landing-page__cta-island">
          <h2 id="landing-cta-title" className="landing-page__heading landing-page__heading--on-dark">
            Проверьте каталог на реальном запросе
          </h2>
          <p className="landing-page__body landing-page__body--on-dark">
            Сотруднику пройти знакомый подбор и показать демо владельцу.
            Владельцу отдать каталог команде.
          </p>
          <DemoButton className="landing-page__btn--cta" />
          <div className="landing-page__contacts">
            <a
              className="landing-page__contact"
              href={SITE_DEVELOPER_TELEGRAM.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <TelegramIcon aria-hidden />
              <span>
                <small>Telegram</small>
                {SITE_DEVELOPER_TELEGRAM.name}
              </span>
            </a>
            <a className="landing-page__contact" href={SITE_DEVELOPER_PHONE.href}>
              <PhoneIcon aria-hidden />
              <span>
                <small>Телефон</small>
                {SITE_DEVELOPER_PHONE.display}
              </span>
            </a>
          </div>
          <p className="landing-page__footnote landing-page__footnote--on-dark">
            В демо поставщики даны как пример. В рабочей версии будут ваши.
          </p>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
