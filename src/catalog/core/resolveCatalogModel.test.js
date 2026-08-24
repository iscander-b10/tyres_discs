import { resolveCatalogModel } from './resolveCatalogModel';

describe('resolveCatalogModel', () => {
  test('берёт явное поле model', () => {
    expect(
      resolveCatalogModel({
        brand: 'Ikon',
        title: 'Ikon Character Eco 91H',
        model: 'Character Eco',
      })
    ).toBe('Character Eco');
  });

  test('выводит модель из title, если model нет', () => {
    expect(
      resolveCatalogModel({
        brand: 'Ikon',
        title: 'Ikon Character Eco 91H',
      })
    ).toBe('Character Eco');
  });
});
