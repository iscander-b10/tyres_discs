import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CatalogItemModalWindow from './CatalogItemModalWindow';

jest.mock('../AddToCartControl/AddToCartControl', () => () => null);
jest.mock('../CatalogPriceStrip/CatalogPriceStrip', () => () => null);
jest.mock('../CatalogItemPromoBadges/CatalogItemPromoBadges', () => () => null);
jest.mock('../../../utils/fetchSupplier', () => ({
  resolvePhotoUrl: (url) => (url ? String(url) : ''),
}));

const tyreItem = {
  title: 'Test Tyre',
  brand: 'Brand',
  sizeTitle: '205/55R16',
  photoUrl: 'https://example.com/tyre.jpg',
  supplier: 'demo',
};

const discItem = {
  title: 'Test Disc',
  brand: 'Brand',
  sizeTitle: '7x17',
  color: 'Black',
  photoUrl: 'https://example.com/disc.jpg',
  supplier: 'demo',
};

describe('CatalogItemModalWindow meta fields', () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
  });

  test('шина: лейбл размера — «Размер», без поля «Цвет»', async () => {
    await act(async () => {
      root.render(
        <CatalogItemModalWindow
          isOpen
          onClose={() => {}}
          item={tyreItem}
          category="tyres"
        />
      );
    });

    const fields = Array.from(
      document.querySelectorAll('.product-modal__meta-field')
    ).map((node) => ({
      label: node.querySelector('dt')?.textContent,
      value: node.querySelector('dd')?.textContent,
    }));

    expect(fields).toEqual(
      expect.arrayContaining([{ label: 'Размер', value: '205/55R16' }])
    );
    expect(fields.some((field) => field.label === 'Типоразмер')).toBe(false);
    expect(fields.some((field) => field.label === 'Цвет')).toBe(false);
  });

  test('диск: после «Размер» идёт «Цвет» с переданным значением', async () => {
    await act(async () => {
      root.render(
        <CatalogItemModalWindow
          isOpen
          onClose={() => {}}
          item={discItem}
          category="discs"
        />
      );
    });

    const fields = Array.from(
      document.querySelectorAll('.product-modal__meta-field')
    ).map((node) => ({
      label: node.querySelector('dt')?.textContent,
      value: node.querySelector('dd')?.textContent,
    }));

    const sizeIndex = fields.findIndex((field) => field.label === 'Размер');
    const colorIndex = fields.findIndex((field) => field.label === 'Цвет');

    expect(sizeIndex).toBeGreaterThanOrEqual(0);
    expect(colorIndex).toBe(sizeIndex + 1);
    expect(fields[colorIndex].value).toBe('Black');
  });

  test('диск без color показывает «—»', async () => {
    await act(async () => {
      root.render(
        <CatalogItemModalWindow
          isOpen
          onClose={() => {}}
          item={{ ...discItem, color: '' }}
          category="discs"
        />
      );
    });

    const colorField = Array.from(
      document.querySelectorAll('.product-modal__meta-field')
    ).find((node) => node.querySelector('dt')?.textContent === 'Цвет');

    expect(colorField?.querySelector('dd')?.textContent).toBe('—');
  });
});

describe('CatalogItemModalWindow photo', () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
  });

  test('пустой photoUrl: рамка без img и без via.placeholder.com', async () => {
    await act(async () => {
      root.render(
        <CatalogItemModalWindow
          isOpen
          onClose={() => {}}
          item={{ ...tyreItem, photoUrl: '' }}
          category="tyres"
        />
      );
    });

    expect(document.querySelector('.product-modal__frame')).not.toBeNull();
    expect(document.querySelector('.product-modal__image')).toBeNull();
    expect(document.body.innerHTML).not.toContain('via.placeholder.com');
    expect(document.body.innerHTML).not.toContain('placeholder.com');
  });

  test('ошибка загрузки: убирает img, не ставит via.placeholder.com', async () => {
    await act(async () => {
      root.render(
        <CatalogItemModalWindow
          isOpen
          onClose={() => {}}
          item={tyreItem}
          category="tyres"
        />
      );
    });

    const img = document.querySelector('.product-modal__image');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(tyreItem.photoUrl);

    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });

    expect(document.querySelector('.product-modal__image')).toBeNull();
    expect(document.body.innerHTML).not.toContain('via.placeholder.com');
    expect(document.querySelector('.product-modal__frame')).not.toBeNull();
  });
});
