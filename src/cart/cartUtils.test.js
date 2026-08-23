import {
  getUnitSellingPrice,
  isCatalogItemSellable,
  parseStock,
  reconcileCartItems,
  snapshotCartItem,
} from './cartUtils';

const isSellableTire = (item) => isCatalogItemSellable(item, 'tyres');

describe('isCatalogItemSellable / prices', () => {
  test('amount > 0 и положительная цена → можно добавить', () => {
    expect(
      isSellableTire({
        id: '1',
        amount: 4,
        sellingPrice: 1200,
        price: 1000,
      })
    ).toBe(true);
  });

  test('amount = 0 → нельзя', () => {
    expect(
      isSellableTire({
        id: '1',
        amount: 0,
        sellingPrice: 1200,
      })
    ).toBe(false);
  });

  test('цена null → нельзя', () => {
    expect(
      isSellableTire({
        id: '1',
        amount: 4,
        sellingPrice: null,
        price: null,
      })
    ).toBe(false);
  });

  test('sellingPrice некорректна, но price корректна → используется price', () => {
    const item = {
      id: '1',
      amount: 4,
      sellingPrice: 'abc',
      price: '1500',
    };
    expect(getUnitSellingPrice(item)).toBe(1500);
    expect(isSellableTire(item)).toBe(true);
  });

  test('обе цены некорректны → нельзя', () => {
    expect(
      isSellableTire({
        id: '1',
        amount: 4,
        sellingPrice: -1,
        price: 0,
      })
    ).toBe(false);
  });

  test('numeric string amount и price с запятой', () => {
    expect(parseStock('4,9')).toBe(4);
    expect(
      isSellableTire({
        id: '1',
        amount: '4,0',
        sellingPrice: '1200,5',
      })
    ).toBe(true);
  });

  test('неполный numeric string не парсится как число', () => {
    expect(parseStock('123abc')).toBe(0);
    expect(
      getUnitSellingPrice({ sellingPrice: '123abc', price: null })
    ).toBe(0);
  });
});

const catalogItem = (overrides = {}) => ({
  id: 'same-id',
  supplier: 'supplier',
  code: 'code',
  title: 'Старое название',
  photoUrl: '/old.jpg',
  amount: 8,
  price: 7000,
  sellingPrice: 8000,
  websitePrice: 8500,
  ...overrides,
});

const resultFor = (line, matches) => ({
  requestKey: line.key,
  matches: { tyres: null, discs: null, ...matches },
});

describe('reconcileCartItems', () => {
  test('полностью обновляет snapshot и цену', () => {
    const line = snapshotCartItem(catalogItem(), 'tyres', 1);
    const current = catalogItem({
      title: 'Новое название',
      photoUrl: '/new.jpg',
      sellingPrice: 9500,
      price: 9000,
      websitePrice: 10000,
      color: 'black',
    });

    const [updated] = reconcileCartItems(
      [line],
      [resultFor(line, { tyres: current })]
    );

    expect(updated).toEqual(snapshotCartItem(current, 'tyres', 1));
    expect(updated.sellingPrice * updated.quantity).toBe(9500);
  });

  test('уменьшает quantity и maxStock до нового остатка', () => {
    const line = snapshotCartItem(catalogItem({ amount: 8 }), 'tyres', 4);
    const [updated] = reconcileCartItems(
      [line],
      [resultFor(line, { tyres: catalogItem({ amount: 2 }) })]
    );

    expect(updated.quantity).toBe(2);
    expect(updated.maxStock).toBe(2);
  });

  test.each([
    ['нулевой остаток', catalogItem({ amount: 0 })],
    ['неположительная цена', catalogItem({ sellingPrice: 0, price: 0 })],
    ['удалённый товар', null],
  ])('%s удаляет строку', (_, item) => {
    const line = snapshotCartItem(catalogItem(), 'tyres', 4);
    expect(
      reconcileCartItems([line], [resultFor(line, { tyres: item })])
    ).toEqual([]);
  });

  test('увеличивает maxStock, не увеличивая quantity', () => {
    const line = snapshotCartItem(catalogItem({ amount: 2 }), 'tyres', 2);
    const [updated] = reconcileCartItems(
      [line],
      [resultFor(line, { tyres: catalogItem({ amount: 9 }) })]
    );

    expect(updated.quantity).toBe(2);
    expect(updated.maxStock).toBe(9);
  });

  test('одинаковые id шин и дисков остаются разными строками', () => {
    const tireLine = snapshotCartItem(catalogItem(), 'tyres', 1);
    const discItem = catalogItem({ title: 'Диск' });
    const discLine = snapshotCartItem(discItem, 'discs', 2);

    const updated = reconcileCartItems(
      [tireLine, discLine],
      [
        resultFor(tireLine, { tyres: catalogItem({ title: 'Шина' }) }),
        resultFor(discLine, { discs: discItem }),
      ]
    );

    expect(updated.map((line) => line.key)).toEqual([
      'tyres:same-id',
      'discs:same-id',
    ]);
  });

  test('неоднозначная legacy-строка не переносится', () => {
    const legacyLine = {
      ...catalogItem(),
      key: 'same-id',
      quantity: 1,
      supplier: null,
      code: null,
    };
    expect(
      reconcileCartItems(
        [legacyLine],
        [resultFor(legacyLine, { tyres: catalogItem(), discs: catalogItem() })]
      )
    ).toEqual([]);
  });

  test('строка, добавленная после начала чтения, сохраняется', () => {
    const line = snapshotCartItem(catalogItem({ id: 'new' }), 'tyres', 1);
    expect(reconcileCartItems([line], [])).toEqual([line]);
  });
});
