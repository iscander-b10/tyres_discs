import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import { PATHS } from '../../app/paths';
import { SITE_BRAND, SITE_PHONE, SITE_TELEGRAM } from '../../config/site';

describe('LandingPage demo CTA', () => {
  test('Посмотреть демо включена и ведёт на /demo', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const demoButtons = screen.getAllByRole('button', { name: 'Посмотреть демо' });
    expect(demoButtons.length).toBeGreaterThanOrEqual(1);
    demoButtons.forEach((demoButton) => {
      expect(demoButton).not.toBeDisabled();
      expect(demoButton.closest('a')).toHaveAttribute('href', PATHS.demo);
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /SilverTyres/
    );
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Один запрос вместо повторного поиска у каждого поставщика',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(
        'Сравнение: много вкладок поставщиков слева и один каталог silvertyres.pro справа'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Фокус на вашем бренде\. WhiteLabel/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(
        'Карточка диска: фото с логотипом магазина Ivanor, поставщик и цены справа'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Оптимальные решения')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Опыт сотрудников подсказывает, где искать. Сервис, где есть недостающая модель.',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '3 на складе' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '+1 у поставщика' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Клиент ушёл' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Забрали заказ' })).toBeInTheDocument();
    expect(screen.getByText('С любого устройства')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Заказ собирают там, где удобно. Не через общий компьютер. Не через менеджера по заказам.',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /У любого сотрудника появляется возможность через любое устройство смотреть позиции на заказ/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(
        'Каталог на компьютере, планшете и телефоне: один интерфейс подбора на любом устройстве'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.getByText('Проверка перед решением')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Проверьте каталог на реальном запросе вместе с командой',
      })
    ).toBeInTheDocument();
    const openDemo = screen.getByRole('button', { name: 'Открыть демо' });
    expect(openDemo).not.toBeDisabled();
    expect(openDemo.closest('a')).toHaveAttribute('href', PATHS.demo);
    expect(screen.getByRole('link', { name: /Telegram/ })).toHaveAttribute(
      'href',
      SITE_TELEGRAM.href
    );
    expect(
      screen.getByText(SITE_TELEGRAM.display, {
        selector: '.landing-page__contact span',
      })
    ).toBeInTheDocument();
    expect(screen.getByText(SITE_PHONE.ctaDisplay)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Розничная цена поставщика рядом со своей',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Два режима: менеджера и клиента',
      })
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll('.landing-page__slide').length).toBe(6);
  });
});
