import fs from 'fs';
import path from 'path';
import { STORE_PROFILES } from '../config/stores';
import {
  calculateSellingPrice,
  getDiscMargin,
  getMargin,
} from './dataTransformers';
import { transformDiscs as transformShinserviceDiscs } from './suppliers/shinservice/transformers';

const OTHER_STORE_ID = 'TestOtherStore';

function installOtherStore() {
  STORE_PROFILES[OTHER_STORE_ID] = {
    id: OTHER_STORE_ID,
    displayName: 'Other',
    phone: { display: '0', href: 'tel:+7000' },
    pricing: {
      tyreMargins: { russian: 10, import: 40, default: 30 },
      russianBrands: [...STORE_PROFILES.ElistaIvanor.pricing.russianBrands],
      importBrands: [...STORE_PROFILES.ElistaIvanor.pricing.importBrands],
      discMargin: 50,
    },
  };
}

function removeOtherStore() {
  delete STORE_PROFILES[OTHER_STORE_ID];
}

describe('getMargin', () => {
  test('Кама → 15, Michelin/Ikon → 23, неизвестный → 18', () => {
    expect(getMargin('Кама')).toBe(15);
    expect(getMargin('Michelin')).toBe(23);
    expect(getMargin('Ikon')).toBe(23);
    expect(getMargin('UnknownBrand')).toBe(18);
  });

  test('trim и регистр как раньше', () => {
    expect(getMargin('  кама  ')).toBe(15);
    expect(getMargin('MICHELIN')).toBe(23);
    expect(getMargin('ikon')).toBe(23);
  });

  test('ElistaIvanor явно даёт те же 15/23/18', () => {
    expect(getMargin('Кама', 'ElistaIvanor')).toBe(15);
    expect(getMargin('Michelin', 'ElistaIvanor')).toBe(23);
    expect(getMargin('Ikon', 'ElistaIvanor')).toBe(23);
    expect(getMargin('NoSuchBrand', 'ElistaIvanor')).toBe(18);
  });

  test('проценты другого storeId не протекают в Иванор', () => {
    installOtherStore();
    try {
      expect(getMargin('Кама', OTHER_STORE_ID)).toBe(10);
      expect(getMargin('Michelin', OTHER_STORE_ID)).toBe(40);
      expect(getMargin('NoSuchBrand', OTHER_STORE_ID)).toBe(30);
      expect(getMargin('Кама', 'ElistaIvanor')).toBe(15);
      expect(getMargin('Michelin', 'ElistaIvanor')).toBe(23);
      expect(getMargin('NoSuchBrand', 'ElistaIvanor')).toBe(18);
    } finally {
      removeOtherStore();
    }
  });
});

describe('getDiscMargin / calculateSellingPrice', () => {
  test('Иванор: 20% и 1000 → 1200', () => {
    expect(getDiscMargin('ElistaIvanor')).toBe(20);
    expect(getDiscMargin()).toBe(20);
    expect(calculateSellingPrice(1000, 20)).toBe(1200);
  });

  test('discMargin другого storeId не протекает в Иванор', () => {
    installOtherStore();
    try {
      expect(getDiscMargin(OTHER_STORE_ID)).toBe(50);
      expect(getDiscMargin('ElistaIvanor')).toBe(20);
      expect(calculateSellingPrice(1000, getDiscMargin(OTHER_STORE_ID))).toBe(
        1500
      );
      expect(calculateSellingPrice(1000, getDiscMargin('ElistaIvanor'))).toBe(
        1200
      );
    } finally {
      removeOtherStore();
    }
  });
});

describe('transformDiscs pricing', () => {
  const TRANSFORMER_FILES = [
    'shinservice/transformers.js',
    'semisotnov/transformers.js',
    '4tochki/transformers.js',
    'ShinaSu/transformers.js',
    'Vershina/transformers.js',
  ];

  test('ни один transformDiscs не содержит литерал * 1.2', () => {
    const dir = path.join(__dirname, 'suppliers');
    for (const rel of TRANSFORMER_FILES) {
      const src = fs.readFileSync(path.join(dir, rel), 'utf8');
      expect(src).not.toMatch(/\*\s*1\.2/);
    }
  });

  test('shinservice диски Иванор: 1000 → 1200 через discMargin', () => {
    const [item] = transformShinserviceDiscs(
      {
        disk: [
          {
            sku: '1',
            brand: 'Test',
            model: 'Rim',
            diameter: '16 / 6.5J',
            type: 'Литой / Black',
            pn: 5,
            pcd: 114.3,
            et: 45,
            cb: 67.1,
            price: 1000,
            priceRetail: 1100,
            amountDetailed: [{ total: 4 }],
            amountTotal: 4,
            photoUrl: '',
          },
        ],
      },
      'ElistaIvanor'
    );
    expect(item.sellingPrice).toBe(1200);
  });
});
