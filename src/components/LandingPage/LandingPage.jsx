import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Flex } from 'antd';
import { PATHS, loginLinkTarget } from '../../app/paths';
import { SITE_BRAND, SITE_PHONE, SITE_TELEGRAM } from '../../config/site';
import './LandingPage.scss';

const PUBLIC_URL = process.env.PUBLIC_URL || '';

function landingSrc(file) {
  return `${PUBLIC_URL}/landing/${file}`;
}

/** Единый intent с хедером/футером: post-login → /tyres. */
const LOGIN_TARGET = loginLinkTarget({ pathname: '/', search: '' });

const SEARCH_POINTS = [
  'Один поиск по всем подключённым поставщикам — без переключения вкладок и повторного ввода размера, бренда и модели.',
  'Шины и диски в одном каталоге. Для каждой категории — своя форма и подходящие фильтры.',
  'Ежедневное обновление цен и остатков.',
];

const COMPARE_PAIRS = [
  {
    key: 'stock',
    problem: {
      title: '3 на складе',
      text: 'Разукомплектованный товар лежит на складе, оборота нет.',
    },
    solution: {
      title: '+1 у поставщика',
      text: 'Один запрос: видно, у кого есть эта модель и остаток. Комплект реализован, остатки под контролем.',
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

function DemoButton({ className, children = 'Посмотреть демо', style }) {
  return (
    <Link to={PATHS.demo} className="landing-page__btn-link" style={style}>
      <Button
        type="primary"
        size="large"
        className={['landing-page__btn', 'landing-page__btn--demo', className]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </Button>
    </Link>
  );
}

function MonitorFrame({ children }) {
  return (
    <figure className="landing-page__monitor">
      <div className="landing-page__monitor-bezel">
        <span className="landing-page__monitor-camera" aria-hidden="true" />
        <div className="landing-page__monitor-screen">{children}</div>
      </div>
    </figure>
  );
}

function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-page__hero landing-page__slide" aria-labelledby="landing-hero-title">
        <MonitorFrame>
          <img
            className="landing-page__hero-media"
            src={landingSrc('slide-01-home.png')}
            width={1482}
            height={897}
            alt="Главная каталога: поиск шин и витрина с фотографиями колёс"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
          <div className="landing-page__hero-scrim" aria-hidden="true" />
          <div className="landing-page__hero-copy">
            <h1
              id="landing-hero-title"
              className="landing-page__title enter"
              style={{ '--d': 0 }}
            >
              {SITE_BRAND}&nbsp;—
              <span className="landing-page__title-line">
                единый каталог шин и дисков под ваш магазин
              </span>
            </h1>
            <p className="landing-page__lead enter" style={{ '--d': 1 }}>
              Ваши поставщики, ваши цены — в одном окне браузера
            </p>
            <p className="landing-page__caption enter" style={{ '--d': 2 }}>
              Рабочее место, которое помогает команде вести подбор без
              лишних вкладок
            </p>
            <Flex
              className="landing-page__hero-actions enter"
              style={{ '--d': 3 }}
              gap={12}
              wrap="wrap"
            >
              <DemoButton />
              <Link to={LOGIN_TARGET} className="landing-page__btn-link">
                <Button
                  size="large"
                  className="landing-page__btn landing-page__btn--ghost"
                >
                  Войти
                </Button>
              </Link>
            </Flex>
          </div>
        </MonitorFrame>
      </section>

      <section
        className="landing-page__stack landing-page__slide"
        aria-labelledby="landing-search-title"
      >
        <div className="landing-page__stack-frame">
          <div className="landing-page__stack-copy">
            <p className="landing-page__stack-kicker enter" style={{ '--d': 0 }}>
              Меньше рутины
            </p>
            <h2 id="landing-search-title" className="enter" style={{ '--d': 1 }}>
              Один запрос вместо повторного поиска у каждого поставщика
            </h2>
            <ul className="landing-page__search-points">
              {SEARCH_POINTS.map((point, index) => (
                <li key={point} className="enter" style={{ '--d': index + 2 }}>
                  {point}
                </li>
              ))}
            </ul>
            <p className="landing-page__stack-note enter" style={{ '--d': 5 }}>
              Меньше переключений — больше внимания клиенту.
            </p>
          </div>
          <figure className="landing-page__stack-visual enter" style={{ '--d': 6 }}>
            <div className="landing-page__stack-visual-frame">
              <img
                src={landingSrc('slide-02-search-compare.png')}
                width={1280}
                height={720}
                alt="Сравнение: много вкладок поставщиков слева и один каталог silvertyres.pro справа"
                loading="lazy"
                decoding="async"
              />
            </div>
          </figure>
        </div>
      </section>

      <section
        className="landing-page__hero landing-page__hero--brand landing-page__slide"
        aria-labelledby="landing-brand-title"
      >
        <MonitorFrame>
          <img
            className="landing-page__hero-media"
            src={landingSrc('slide-04-discs.png')}
            width={1281}
            height={853}
            alt="Карточка диска: фото с логотипом магазина Ivanor, поставщик и цены справа"
            loading="lazy"
            decoding="async"
          />
          <div
            className="landing-page__hero-scrim landing-page__hero-scrim--brand"
            aria-hidden="true"
          />
          <div className="landing-page__hero-copy landing-page__hero-copy--brand">
            <h2
              id="landing-brand-title"
              className="landing-page__title landing-page__title--brand enter"
              style={{ '--d': 0 }}
            >
              <span className="landing-page__title-eyebrow">
                Фокус на вашем бренде. WhiteLabel
              </span>
              <span className="landing-page__title-line">
                Шины можно продать без демонстрации, диски нужно показать
              </span>
            </h2>
            <p
              className="landing-page__lead landing-page__lead--brand enter"
              style={{ '--d': 1 }}
            >
              Подбор производится на витрине вашего магазина — каталог брендируется
              под вас. Тему и фирменные цвета выбираете вы.
            </p>
          </div>
          <aside className="landing-page__brand-callout enter" style={{ '--d': 2 }}>
            <p>
              Логотип на фото подчёркивает ваш бренд,
              <br />
              а не поставщика
            </p>
          </aside>
          <svg
            className="landing-page__brand-pointer"
            viewBox="0 0 1281 853"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="landing-brand-arrowhead"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <path
              className="landing-page__brand-pointer-line"
              d="M 941 400 C 890 430, 840 510, 792 568"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              markerEnd="url(#landing-brand-arrowhead)"
            />
          </svg>
        </MonitorFrame>
      </section>

      <section
        className="landing-page__solutions landing-page__slide"
        aria-labelledby="landing-solutions-title"
      >
        <div className="landing-page__solutions-frame">
          <div className="landing-page__solutions-copy">
            <p className="landing-page__solutions-kicker enter" style={{ '--d': 0 }}>
              Оптимальные решения
            </p>
            <h2 id="landing-solutions-title" className="enter" style={{ '--d': 1 }}>
              Опыт сотрудников подсказывает, где искать. Сервис, где есть
              недостающая модель.
            </h2>
            <ul className="landing-page__solutions-grid">
              {COMPARE_PAIRS.map((pair, index) => (
                <li
                  key={pair.key}
                  className="landing-page__solutions-row enter"
                  style={{ '--d': index + 2 }}
                >
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
            <p className="landing-page__solutions-note enter" style={{ '--d': 4 }}>
              Бренды и модели пересекаются между поставщиками. То, что привычно
              искать у одного, иногда лежит у другого.
            </p>
          </div>
        </div>
      </section>

      <section
        className="landing-page__stack landing-page__stack--surface landing-page__slide"
        aria-labelledby="landing-devices-title"
      >
        <div className="landing-page__stack-frame">
          <div className="landing-page__stack-copy">
            <p className="landing-page__stack-kicker enter" style={{ '--d': 0 }}>
              С любого устройства
            </p>
            <h2 id="landing-devices-title" className="enter" style={{ '--d': 1 }}>
              Заказ собирают там, где удобно. Не через общий компьютер. Не через менеджера по заказам.
            </h2>
            <p className="landing-page__stack-note enter" style={{ '--d': 2 }}>
              У любого сотрудника появляется возможность через любое устройство смотреть позиции на заказ, что можно отдать по одной или две единицы. Минуя узкое горлышко и ускоряя процесс формирования заказа.
            </p>
          </div>
          <figure className="landing-page__stack-visual enter" style={{ '--d': 3 }}>
            <div className="landing-page__stack-visual-frame">
              <img
                src={landingSrc('slide-05-devices.png')}
                width={1523}
                height={748}
                alt="Каталог на компьютере, планшете и телефоне: один интерфейс подбора на любом устройстве"
                loading="lazy"
                decoding="async"
              />
            </div>
          </figure>
        </div>
      </section>

      <section className="landing-page__cta landing-page__slide" aria-labelledby="landing-cta-title">
        <div className="landing-page__cta-frame">
          <div className="landing-page__cta-copy">
            <p className="landing-page__cta-kicker enter" style={{ '--d': 0 }}>
              Проверка перед решением
            </p>
            <h2 id="landing-cta-title" className="enter" style={{ '--d': 1 }}>
              Проверьте каталог на реальном запросе вместе с командой
            </h2>
            <p className="landing-page__cta-lead enter" style={{ '--d': 2 }}>
              <span>
                <strong>Сотруднику</strong> — пройти знакомый подбор и показать
                демо владельцу.
              </span>
              <span>
                <strong>Владельцу</strong> — предложить команде проверить каталог
                и поделиться впечатлением.
              </span>
            </p>
          </div>
          <div className="landing-page__cta-mid enter" style={{ '--d': 3 }}>
            <DemoButton className="landing-page__cta-island">
              Открыть демо
            </DemoButton>
          </div>
          <div className="landing-page__cta-foot">
            <div className="landing-page__contacts enter" style={{ '--d': 4 }}>
              <a
                className="landing-page__contact"
                href={SITE_TELEGRAM.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <small>Telegram</small>
                <span>{SITE_TELEGRAM.display}</span>
              </a>
              <a className="landing-page__contact" href={SITE_PHONE.href}>
                <small>Телефон</small>
                <span>{SITE_PHONE.ctaDisplay}</span>
              </a>
            </div>
            <p className="landing-page__cta-note enter" style={{ '--d': 5 }}>
              В демо версии предоставлены поставщики как пример, чтоб вам было
              удобно разобраться с работой каталога. У вас в рабочей версии
              будут свои поставщики.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
