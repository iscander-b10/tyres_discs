import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import CatalogBootstrapOverlay from './CatalogBootstrapOverlay';
import { CATALOG_SURFACE_FADE_MS } from '../shared/CatalogResultsFade/catalogSurfaceFade';

describe('CatalogBootstrapOverlay', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('не рендерится на idle и ready (warm start)', () => {
    const { rerender } = render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{ phase: 'idle', progress: 0, label: '' }}
      />
    );
    expect(
      screen.queryByTestId('catalog-bootstrap-overlay')
    ).not.toBeInTheDocument();

    rerender(
      <CatalogBootstrapOverlay
        catalogBootstrap={{ phase: 'ready', progress: 100, label: '' }}
      />
    );
    expect(
      screen.queryByTestId('catalog-bootstrap-overlay')
    ).not.toBeInTheDocument();
  });

  test('blocking показывает процент и не закрывается по маске и Escape', () => {
    const retry = jest.fn();
    render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'blocking',
          progress: 42,
          label: 'Загружаем каталог шин и дисков',
        }}
        retryCatalogBootstrap={retry}
      />
    );

    const overlay = screen.getByTestId('catalog-bootstrap-overlay');
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(
      screen.getByText('Загружаем каталог шин и дисков')
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '42'
    );
    expect(overlay.querySelector('.ant-progress')).toBeNull();
    expect(overlay.querySelector('.catalog-bootstrap-overlay__bar')).toBeNull();
    const circle = overlay.querySelector('.catalog-bootstrap-overlay__circle');
    const spinner = overlay.querySelector('.catalog-bootstrap-overlay__spinner');
    expect(circle).toBeTruthy();
    expect(spinner).toBeTruthy();
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(spinner).toHaveTextContent('');
    const headline = overlay.querySelector('.catalog-bootstrap-overlay__percent');
    expect(headline).toHaveTextContent('42%');
    expect(circle).toHaveTextContent('42%');

    fireEvent.mouseDown(overlay);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(overlay).toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
  });

  test('демо-загрузка с известным total показывает %, без текста про МБ', () => {
    render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'blocking',
          progress: 37,
          label: 'Загружаем каталог шин и дисков',
        }}
      />
    );

    expect(screen.getByText('37%')).toBeInTheDocument();
    expect(screen.queryByText(/МБ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/байт/i)).not.toBeInTheDocument();
    expect(
      screen.getByText('Загружаем каталог шин и дисков')
    ).toBeInTheDocument();
  });

  test('без известного total крупно показывает МБ, а не процент файла', () => {
    render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'blocking',
          progress: 47,
          label: 'Загружено 2,4 МБ',
        }}
      />
    );

    expect(screen.getByText('2,4 МБ')).toBeInTheDocument();
    expect(screen.queryByText('47%')).not.toBeInTheDocument();
    expect(
      screen.getByText('Загружаем каталог шин и дисков')
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Загружено 2,4 МБ'
    );
    const overlay = screen.getByTestId('catalog-bootstrap-overlay');
    expect(overlay.querySelector('.catalog-bootstrap-overlay__bar')).toBeNull();
    const circle = overlay.querySelector('.catalog-bootstrap-overlay__circle');
    expect(circle).toHaveTextContent('2,4 МБ');
    expect(overlay.querySelector('.catalog-bootstrap-overlay__percent')).toHaveTextContent(
      '2,4 МБ'
    );
  });

  test('ожидание lock не показывает фейковый download %', () => {
    render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'blocking',
          progress: 0,
          label: 'Каталог загружается в другой вкладке',
        }}
      />
    );

    const overlay = screen.getByTestId('catalog-bootstrap-overlay');
    expect(
      screen.getByText('Каталог загружается в другой вкладке')
    ).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Каталог загружается в другой вкладке'
    );
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
    const circle = overlay.querySelector(
      '.catalog-bootstrap-overlay__circle--waiting'
    );
    expect(circle).toBeTruthy();
    expect(circle.querySelector('.catalog-bootstrap-overlay__spinner')).toBeTruthy();
    expect(circle).not.toHaveTextContent('0%');
    expect(circle).not.toHaveTextContent('Каталог загружается в другой вкладке');
    expect(overlay.querySelector('.catalog-bootstrap-overlay__bar')).toBeNull();
  });

  test('error показывает текст и кнопку Повторить', () => {
    const retry = jest.fn();
    render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'error',
          progress: 18,
          label: '',
          error: 'Нет сети. Проверьте подключение.',
        }}
        retryCatalogBootstrap={retry}
      />
    );

    expect(
      screen.getByText('Нет сети. Проверьте подключение.')
    ).toBeInTheDocument();
    const overlay = screen.getByTestId('catalog-bootstrap-overlay');
    expect(overlay.querySelector('.catalog-bootstrap-overlay__circle')).toBeNull();
    expect(overlay.querySelector('.catalog-bootstrap-overlay__spinner')).toBeNull();
    expect(overlay.querySelector('.catalog-bootstrap-overlay__bar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('ready без waitForShowcase снимает шторку сразу', () => {
    const { rerender } = render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'blocking',
          progress: 0,
          label: 'Загружаем каталог шин и дисков',
        }}
      />
    );
    expect(screen.getByTestId('catalog-bootstrap-overlay')).toBeInTheDocument();

    rerender(
      <CatalogBootstrapOverlay
        catalogBootstrap={{ phase: 'ready', progress: 100, label: '' }}
      />
    );
    expect(
      screen.queryByTestId('catalog-bootstrap-overlay')
    ).not.toBeInTheDocument();
  });

  test('waitForShowcase держит шторку до готовой витрины, затем гаснет', () => {
    jest.useFakeTimers();
    const onRevealSurface = jest.fn();
    const { rerender } = render(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'blocking',
          progress: 40,
          label: 'Загружаем каталог шин и дисков',
          waitForShowcase: true,
        }}
        holdUntilSurface
        onRevealSurface={onRevealSurface}
      />
    );

    rerender(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'ready',
          progress: 100,
          label: '',
          waitForShowcase: true,
        }}
        holdUntilSurface
        onRevealSurface={onRevealSurface}
      />
    );
    expect(screen.getByTestId('catalog-bootstrap-overlay')).toBeInTheDocument();
    expect(onRevealSurface).not.toHaveBeenCalled();

    rerender(
      <CatalogBootstrapOverlay
        catalogBootstrap={{
          phase: 'ready',
          progress: 100,
          label: '',
          waitForShowcase: true,
        }}
        holdUntilSurface={false}
        onRevealSurface={onRevealSurface}
      />
    );
    expect(onRevealSurface).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('catalog-bootstrap-overlay')).toHaveClass(
      'catalog-bootstrap-overlay--exit'
    );

    act(() => {
      jest.advanceTimersByTime(CATALOG_SURFACE_FADE_MS);
    });
    expect(
      screen.queryByTestId('catalog-bootstrap-overlay')
    ).not.toBeInTheDocument();
  });
});
