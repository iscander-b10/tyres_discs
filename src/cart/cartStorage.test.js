import {
  createCartEnvelope,
  getCartAccountStorageKey,
  getCartStorageKey,
  isEnvelopeNewer,
  parseCartEnvelope,
  readCartEnvelope,
  validateCartEnvelope,
  writeCartEnvelope,
} from './cartStorage';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

describe('cartStorage v3', () => {
  beforeEach(() => localStorage.clear());

  test('формирует персональный ключ с safeStoreId', () => {
    expect(getCartStorageKey('abc-123', STORE_A)).toBe(
      'cart.staff.v3.abc-123.store-a'
    );
  });

  test('getCartStorageKey отличается для разных storeId', () => {
    expect(getCartStorageKey('account', STORE_A)).not.toBe(
      getCartStorageKey('account', STORE_B)
    );
    expect(getCartStorageKey('account', 'store/a')).toBe(
      'cart.staff.v3.account.store%2Fa'
    );
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
    writeCartEnvelope(localStorage, 'account', STORE_A, envelope);
    expect(readCartEnvelope(localStorage, 'account', STORE_A)).toEqual(
      envelope
    );
  });

  test('один раз переносит cart.staff.v3.{accountId} в ключ текущего storeId', () => {
    const envelope = createCartEnvelope({
      items: [{ key: 'tyres:1', quantity: 1 }],
      revision: 3,
      updatedAt: 50,
    });
    const legacyKey = getCartAccountStorageKey('account');
    localStorage.setItem(legacyKey, JSON.stringify(envelope));

    expect(readCartEnvelope(localStorage, 'account', STORE_A)).toEqual(
      envelope
    );
    expect(localStorage.getItem(getCartStorageKey('account', STORE_A))).toBe(
      JSON.stringify(envelope)
    );
    expect(localStorage.getItem(legacyKey)).toBeNull();

    const other = createCartEnvelope({
      items: [{ key: 'discs:9', quantity: 2 }],
      revision: 1,
      updatedAt: 1,
    });
    localStorage.setItem(legacyKey, JSON.stringify(other));
    expect(readCartEnvelope(localStorage, 'account', STORE_B)).toEqual(other);
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(readCartEnvelope(localStorage, 'account', STORE_A)).toEqual(
      envelope
    );
  });

  test('не дублирует legacy account-ключ, если store-ключ уже есть', () => {
    const storeEnvelope = createCartEnvelope({
      items: [{ key: 'tyres:store', quantity: 1 }],
      revision: 2,
      updatedAt: 20,
    });
    const legacyEnvelope = createCartEnvelope({
      items: [{ key: 'tyres:legacy', quantity: 9 }],
      revision: 9,
      updatedAt: 90,
    });
    localStorage.setItem(
      getCartStorageKey('account', STORE_A),
      JSON.stringify(storeEnvelope)
    );
    localStorage.setItem(
      getCartAccountStorageKey('account'),
      JSON.stringify(legacyEnvelope)
    );

    expect(readCartEnvelope(localStorage, 'account', STORE_A)).toEqual(
      storeEnvelope
    );
    expect(localStorage.getItem(getCartAccountStorageKey('account'))).toBeNull();
    expect(readCartEnvelope(localStorage, 'account', STORE_B)).toBeNull();
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
