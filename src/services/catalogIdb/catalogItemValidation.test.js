import {
  canBeStoredInIndexedDB,
  isIndexedDbCloneable,
  isValidCatalogItem,
} from './catalogItemValidation';

describe('isIndexedDbCloneable', () => {
  test('принимает JSON-значения snapshot', () => {
    expect(isIndexedDbCloneable(null)).toBe(true);
    expect(isIndexedDbCloneable('Ikon')).toBe(true);
    expect(isIndexedDbCloneable(205)).toBe(true);
    expect(isIndexedDbCloneable(false)).toBe(true);
    expect(
      isIndexedDbCloneable({
        id: '1',
        supplier: 'Шинсервис',
        nested: { a: [1, 'x', null] },
      })
    ).toBe(true);
  });

  test('отклоняет function/symbol/Promise', () => {
    expect(isIndexedDbCloneable(() => {})).toBe(false);
    expect(isIndexedDbCloneable(Symbol('x'))).toBe(false);
    expect(isIndexedDbCloneable(Promise.resolve(1))).toBe(false);
    expect(isIndexedDbCloneable({ id: 1, fn: function noop() {} })).toBe(false);
  });

  test('циклические ссылки не зацикливают проверку', () => {
    const cyclic = { id: '1', supplier: 'A' };
    cyclic.self = cyclic;
    expect(isIndexedDbCloneable(cyclic)).toBe(true);
  });

  test('canBeStoredInIndexedDB не вызывает structuredClone', () => {
    const original = global.structuredClone;
    const spy = jest.fn();
    global.structuredClone = spy;
    try {
      expect(canBeStoredInIndexedDB({ id: '1', supplier: 'A' })).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      global.structuredClone = original;
    }
  });

  test('isValidCatalogItem требует id, supplier и cloneable-поля', () => {
    expect(
      isValidCatalogItem({ id: '1', supplier: 'A', title: 'T' })
    ).toBe(true);
    expect(isValidCatalogItem({ id: '1', supplier: 'A', fn: () => {} })).toBe(
      false
    );
  });
});
