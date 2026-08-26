import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CatalogItemCard from './CatalogItemCard';

jest.mock('../AddToCartControl/AddToCartControl', () => () => null);
jest.mock('../CatalogPriceStrip/CatalogPriceStrip', () => () => null);
jest.mock('../CatalogItemPromoBadges/CatalogItemPromoBadges', () => () => null);
jest.mock('../HoverTooltip', () => ({ children }) => children);
jest.mock('../../../icons/Van.svg', () => ({ ReactComponent: () => null }));
jest.mock('../../../icons/runflat.jpg', () => 'runflat.jpg');
jest.mock('../../../utils/fetchSupplier', () => ({
  resolvePhotoUrl: (url) => (url ? String(url) : ''),
}));

const baseItem = {
  title: 'Test Tyre',
  photoUrl: 'https://example.com/tyre.jpg',
  supplier: 'demo',
  amount: 4,
};

describe('CatalogItemCard photo', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test('пустой photoUrl: рамка без img и без via.placeholder.com', async () => {
    await act(async () => {
      root.render(
        <CatalogItemCard
          item={{ ...baseItem, photoUrl: '' }}
          category="tyres"
        />
      );
    });

    expect(container.querySelector('.item-image-frame')).not.toBeNull();
    expect(container.querySelector('img.item-image')).toBeNull();
    expect(container.innerHTML).not.toContain('via.placeholder.com');
    expect(container.innerHTML).not.toContain('placeholder.com');
  });

  test('ошибка загрузки: убирает img, не ставит via.placeholder.com', async () => {
    await act(async () => {
      root.render(<CatalogItemCard item={baseItem} category="tyres" />);
    });

    const img = container.querySelector('img.item-image');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(baseItem.photoUrl);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(container.querySelector('.product-modal-overlay')).toBeNull();

    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });

    expect(container.querySelector('img.item-image')).toBeNull();
    expect(container.innerHTML).not.toContain('via.placeholder.com');
    expect(container.querySelector('.item-image-frame')).not.toBeNull();
  });
});
