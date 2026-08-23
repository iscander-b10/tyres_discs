import {
  createCartEnvelope,
  getCartStorageKey,
  isEnvelopeNewer,
  parseCartEnvelope,
  readCartEnvelope,
  validateCartEnvelope,
  writeCartEnvelope,
} from './cartStorage';

describe('cartStorage v3', () => {
  beforeEach(() => localStorage.clear());

  test('формирует персональный ключ', () => {
    expect(getCartStorageKey('abc-123')).toBe('cart.staff.v3.abc-123');
  });

  test('принимает строгий envelope и выполняет round-trip', () => {
    const envelope = createCartEnvelope({
      revision: 7,
      updatedAt: 123,
      items: [
        {
          key: 'tyres:1',
          quantity: 2,
          amount: '4,0',
          price: 1000,
          sellingPrice: '1200.50',
        },
      ],
    });
    writeCartEnvelope(localStorage, 'account', envelope);
    expect(readCartEnvelope(localStorage, 'account')).toEqual(envelope);
  });

  test.each([
    ['не объект', []],
    ['другая версия', { version: 2, revision: 0, updatedAt: 0, items: [] }],
    ['дробная revision', { version: 3, revision: 1.5, updatedAt: 0, items: [] }],
    ['отрицательное время', { version: 3, revision: 0, updatedAt: -1, items: [] }],
    [
      'пустой key',
      {
        version: 3,
        revision: 0,
        updatedAt: 0,
        items: [{ key: '', quantity: 1 }],
      },
    ],
    [
      'дробное quantity',
      {
        version: 3,
        revision: 0,
        updatedAt: 0,
        items: [{ key: 'x', quantity: 1.2 }],
      },
    ],
    [
      'нулевое quantity',
      {
        version: 3,
        revision: 0,
        updatedAt: 0,
        items: [{ key: 'x', quantity: 0 }],
      },
    ],
    [
      'неполное число',
      {
        version: 3,
        revision: 0,
        updatedAt: 0,
        items: [{ key: 'x', quantity: 1, price: '12abc' }],
      },
    ],
    [
      'отрицательная цена',
      {
        version: 3,
        revision: 0,
        updatedAt: 0,
        items: [{ key: 'x', quantity: 1, price: -1 }],
      },
    ],
    [
      'дубликат key',
      {
        version: 3,
        revision: 0,
        updatedAt: 0,
        items: [
          { key: 'x', quantity: 1 },
          { key: 'x', quantity: 2 },
        ],
      },
    ],
  ])('отклоняет: %s', (_, value) => {
    expect(validateCartEnvelope(value)).toBeNull();
  });

  test('повреждённый JSON возвращает null', () => {
    expect(parseCartEnvelope('{"version":3')).toBeNull();
  });

  test('сравнивает revision, затем updatedAt', () => {
    const current = createCartEnvelope({
      items: [],
      revision: 2,
      updatedAt: 20,
    });
    expect(
      isEnvelopeNewer(
        createCartEnvelope({ items: [], revision: 3, updatedAt: 1 }),
        current
      )
    ).toBe(true);
    expect(
      isEnvelopeNewer(
        createCartEnvelope({ items: [], revision: 2, updatedAt: 21 }),
        current
      )
    ).toBe(true);
    expect(
      isEnvelopeNewer(
        createCartEnvelope({ items: [], revision: 2, updatedAt: 20 }),
        current
      )
    ).toBe(false);
  });
});
