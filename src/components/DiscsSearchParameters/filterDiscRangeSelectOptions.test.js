import { filterDiscRangeSelectOptions } from './filterDiscRangeSelectOptions';

const CB = [54, 67, 67.1, 80];
const ET = [-12, 0, 35, 45];

describe('filterDiscRangeSelectOptions', () => {
  test('пустой other возвращает исходный список', () => {
    expect(filterDiscRangeSelectOptions(CB, 'to', undefined)).toBe(CB);
    expect(filterDiscRangeSelectOptions(CB, 'from', null)).toBe(CB);
    expect(filterDiscRangeSelectOptions(CB, 'to', '')).toBe(CB);
  });

  test('from=67 оставляет в «до» только значения ≥ 67, включая 67', () => {
    expect(filterDiscRangeSelectOptions(CB, 'to', 67)).toEqual([67, 67.1, 80]);
  });

  test('to=67 оставляет в «от» только значения ≤ 67, включая 67', () => {
    expect(filterDiscRangeSelectOptions(CB, 'from', 67)).toEqual([54, 67]);
  });

  test('дробные ЦО сравниваются через Number', () => {
    expect(filterDiscRangeSelectOptions(CB, 'to', 67.1)).toEqual([67.1, 80]);
    expect(filterDiscRangeSelectOptions(CB, 'from', 67.1)).toEqual([54, 67, 67.1]);
  });

  test('отрицательный и нулевой ET — активные границы', () => {
    expect(filterDiscRangeSelectOptions(ET, 'to', -12)).toEqual([-12, 0, 35, 45]);
    expect(filterDiscRangeSelectOptions(ET, 'from', 0)).toEqual([-12, 0]);
    expect(filterDiscRangeSelectOptions(ET, 'to', 0)).toEqual([0, 35, 45]);
  });

  test('не мутирует входной массив', () => {
    const source = [54, 67, 80];
    filterDiscRangeSelectOptions(source, 'to', 67);
    expect(source).toEqual([54, 67, 80]);
  });

  test('нечисловой other не фильтрует список', () => {
    expect(filterDiscRangeSelectOptions(CB, 'to', 'abc')).toBe(CB);
  });
});
