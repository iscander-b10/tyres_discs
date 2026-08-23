import { getCartStorageKey } from './cartStorage';
import {
  LEGACY_CART_KEYS,
  detectLegacyCart,
  discardLegacyCart,
  migrateLegacyCart,
} from './legacyCartMigration';

const legacyItems = [
  { key: 'tyres:1', quantity: 2, price: 1000, amount: 4 },
];

describe('legacyCartMigration', () => {
  beforeEach(() => localStorage.clear());

  test('не читает legacy без отдельного detector и распознаёт v2', () => {
    localStorage.setItem(
      LEGACY_CART_KEYS[0],
      JSON.stringify({ version: 2, items: legacyItems })
    );
    expect(detectLegacyCart(localStorage, 'account')).toMatchObject({
      accountId: 'account',
      keys: [LEGACY_CART_KEYS[0]],
      status: 'valid',
      items: legacyItems,
    });
  });

  test('повреждённые данные помечаются и не мигрируют', () => {
    localStorage.setItem(LEGACY_CART_KEYS[1], '{"broken"');
    const detection = detectLegacyCart(localStorage, 'account');
    expect(detection.status).toBe('corrupted');
    expect(() => migrateLegacyCart(localStorage, detection)).toThrow();
    expect(localStorage.getItem(LEGACY_CART_KEYS[1])).not.toBeNull();
  });

  test('перенос записывает и проверяет v3, затем удаляет legacy и ставит marker', () => {
    localStorage.setItem(
      LEGACY_CART_KEYS[0],
      JSON.stringify({ version: 2, items: legacyItems })
    );
    const detection = detectLegacyCart(localStorage, 'account');
    const envelope = migrateLegacyCart(localStorage, detection);

    expect(envelope).toMatchObject({
      version: 3,
      revision: 1,
      items: legacyItems,
    });
    expect(
      JSON.parse(localStorage.getItem(getCartStorageKey('account')))
    ).toEqual(envelope);
    expect(localStorage.getItem(LEGACY_CART_KEYS[0])).toBeNull();
    expect(localStorage.getItem(detection.markerKey)).not.toBeNull();

    localStorage.setItem(
      LEGACY_CART_KEYS[0],
      JSON.stringify({ version: 2, items: legacyItems })
    );
    expect(detectLegacyCart(localStorage, 'account')).toBeNull();
  });

  test('не затирает существующие строки v3 при переносе', () => {
    localStorage.setItem(
      getCartStorageKey('account'),
      JSON.stringify({
        version: 3,
        revision: 5,
        updatedAt: 10,
        items: [{ key: 'discs:2', quantity: 1 }],
      })
    );
    localStorage.setItem(
      LEGACY_CART_KEYS[0],
      JSON.stringify({ version: 2, items: legacyItems })
    );
    const envelope = migrateLegacyCart(
      localStorage,
      detectLegacyCart(localStorage, 'account')
    );
    expect(envelope.revision).toBe(6);
    expect(envelope.items.map(({ key }) => key)).toEqual([
      'discs:2',
      'tyres:1',
    ]);
  });

  test('ошибка записи v3 оставляет legacy и marker неизменными', () => {
    const values = new Map([
      [
        LEGACY_CART_KEYS[0],
        JSON.stringify({ version: 2, items: legacyItems }),
      ],
    ]);
    const storage = {
      getItem: jest.fn((key) => values.get(key) ?? null),
      setItem: jest.fn((key, value) => {
        if (key === getCartStorageKey('account')) throw new Error('quota');
        values.set(key, value);
      }),
      removeItem: jest.fn((key) => values.delete(key)),
    };
    const detection = detectLegacyCart(storage, 'account');
    expect(() => migrateLegacyCart(storage, detection)).toThrow('quota');
    expect(values.has(LEGACY_CART_KEYS[0])).toBe(true);
    expect(values.has(detection.markerKey)).toBe(false);
  });

  test('ошибка marker откатывает перенос и сохраняет legacy', () => {
    const legacyRaw = JSON.stringify({ version: 2, items: legacyItems });
    const values = new Map([[LEGACY_CART_KEYS[0], legacyRaw]]);
    let markerKey;
    const storage = {
      getItem: jest.fn((key) => values.get(key) ?? null),
      setItem: jest.fn((key, value) => {
        if (key === markerKey) throw new Error('marker quota');
        values.set(key, value);
      }),
      removeItem: jest.fn((key) => values.delete(key)),
    };
    const detection = detectLegacyCart(storage, 'account');
    markerKey = detection.markerKey;

    expect(() => migrateLegacyCart(storage, detection)).toThrow('marker quota');
    expect(values.get(LEGACY_CART_KEYS[0])).toBe(legacyRaw);
    expect(values.has(getCartStorageKey('account'))).toBe(false);
    expect(values.has(markerKey)).toBe(false);
  });

  test('ошибка marker откатывает удаление legacy', () => {
    const legacyRaw = JSON.stringify(legacyItems);
    const values = new Map([[LEGACY_CART_KEYS[0], legacyRaw]]);
    let markerKey;
    const storage = {
      getItem: jest.fn((key) => values.get(key) ?? null),
      setItem: jest.fn((key, value) => {
        if (key === markerKey) throw new Error('marker quota');
        values.set(key, value);
      }),
      removeItem: jest.fn((key) => values.delete(key)),
    };
    const detection = detectLegacyCart(storage, 'account');
    markerKey = detection.markerKey;

    expect(() => discardLegacyCart(storage, detection)).toThrow('marker quota');
    expect(values.get(LEGACY_CART_KEYS[0])).toBe(legacyRaw);
    expect(values.has(markerKey)).toBe(false);
  });

  test('удаление очищает весь найденный набор и делает решение идемпотентным', () => {
    LEGACY_CART_KEYS.forEach((key) =>
      localStorage.setItem(key, JSON.stringify(legacyItems))
    );
    const detection = detectLegacyCart(localStorage, 'account');
    discardLegacyCart(localStorage, detection);
    LEGACY_CART_KEYS.forEach((key) =>
      expect(localStorage.getItem(key)).toBeNull()
    );
    expect(localStorage.getItem(detection.markerKey)).not.toBeNull();

    LEGACY_CART_KEYS.forEach((key) =>
      localStorage.setItem(key, JSON.stringify(legacyItems))
    );
    expect(detectLegacyCart(localStorage, 'account')).toBeNull();
  });

  test('marker изолирован по accountId', () => {
    localStorage.setItem(
      LEGACY_CART_KEYS[0],
      JSON.stringify({ version: 2, items: legacyItems })
    );
    discardLegacyCart(localStorage, detectLegacyCart(localStorage, 'a'));
    localStorage.setItem(
      LEGACY_CART_KEYS[0],
      JSON.stringify({ version: 2, items: legacyItems })
    );
    expect(detectLegacyCart(localStorage, 'b')).not.toBeNull();
  });
});
