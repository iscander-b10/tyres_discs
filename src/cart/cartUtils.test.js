import {
  getUnitSellingPrice,
  isCatalogItemSellable,
  parseStock,
} from './cartUtils';

describe('isCatalogItemSellable / prices', () => {
  test('amount > 0 и положительная цена → можно добавить', () => {
    expect(
      isCatalogItemSellable({
        id: '1',
        amount: 4,
        sellingPrice: 1200,
        price: 1000,
      })
    ).toBe(true);
  });

  test('amount = 0 → нельзя', () => {
    expect(
      isCatalogItemSellable({
        id: '1',
        amount: 0,
        sellingPrice: 1200,
      })
    ).toBe(false);
  });

  test('цена null → нельзя', () => {
    expect(
      isCatalogItemSellable({
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
    expect(isCatalogItemSellable(item)).toBe(true);
  });

  test('обе цены некорректны → нельзя', () => {
    expect(
      isCatalogItemSellable({
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
      isCatalogItemSellable({
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
