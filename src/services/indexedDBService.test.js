import indexedDBService from './indexedDBService';

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)])
    );
  }
  return value;
};

const makeError = (name, message = name) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

function createFakeDatabase(initialItems, failure = null) {
  let committedItems = clone(initialItems);
  let transactionCount = 0;

  return {
    get transactionCount() {
      return transactionCount;
    },
    getItems() {
      return clone(committedItems);
    },
    transaction() {
      transactionCount += 1;
      const stagedItems = new Map(
        committedItems.map((item) => [item.id, clone(item)])
      );
      let putIndex = 0;
      let done = false;
      let pendingError = null;

      const abort = (error) => {
        if (done) return;
        done = true;
        transaction.error = error || transaction.error;
        setTimeout(() => transaction.onabort?.());
      };
      const complete = () => {
        if (done) return;
        if (pendingError) {
          abort(pendingError);
          return;
        }
        done = true;
        committedItems = Array.from(stagedItems.values());
        setTimeout(() => transaction.oncomplete?.());
      };

      const transaction = {
        error: null,
        onabort: null,
        oncomplete: null,
        abort: () => abort(transaction.error || makeError('AbortError')),
        objectStore: () => ({
          index: () => ({
            openCursor: (supplier) => {
              const matchingIds = committedItems
                .filter((item) => item.supplier === supplier)
                .map((item) => item.id);
              const request = { result: null, onsuccess: null };
              let cursorIndex = 0;

              const deliverCursor = () => {
                if (done) return;
                const id = matchingIds[cursorIndex];
                if (id === undefined) {
                  request.result = null;
                  request.onsuccess?.();
                  setTimeout(complete);
                  return;
                }

                request.result = {
                  delete: () => {
                    if (failure?.type === 'delete') {
                      pendingError = failure.error;
                    } else {
                      stagedItems.delete(id);
                    }
                    return {};
                  },
                  continue: () => {
                    cursorIndex += 1;
                    queueMicrotask(deliverCursor);
                  },
                };
                request.onsuccess?.();
              };

              queueMicrotask(deliverCursor);
              return request;
            },
          }),
          put: (item) => {
            const currentPutIndex = putIndex;
            putIndex += 1;
            if (
              failure?.type === 'put' &&
              failure.putIndex === currentPutIndex
            ) {
              pendingError = failure.error;
            } else {
              stagedItems.set(item.id, clone(item));
            }
            return {};
          },
        }),
      };

      return transaction;
    },
  };
}

const catalogCases = [
  {
    label: 'шины',
    save: (items) => indexedDBService.saveTires(items),
    replace: (supplier, items) =>
      indexedDBService.replaceTiresForSupplier(supplier, items),
    setDatabase: (database) => {
      indexedDBService.db = database;
      indexedDBService.discDb = null;
    },
  },
  {
    label: 'диски',
    save: (items) => indexedDBService.saveDiscs(items),
    replace: (supplier, items) =>
      indexedDBService.replaceDiscsForSupplier(supplier, items),
    setDatabase: (database) => {
      indexedDBService.discDb = database;
      indexedDBService.db = null;
    },
  },
];

describe.each(catalogCases)('безопасное сохранение: $label', ({ save, setDatabase }) => {
  const oldSupplierItem = {
    id: 'old-a',
    supplier: 'Поставщик A',
    model: 'Старая модель',
  };
  const otherSupplierItem = {
    id: 'old-b',
    supplier: 'Поставщик B',
  };
  const validItems = [
    { id: 'new-1', supplier: 'Поставщик A' },
    { id: 'new-2', supplier: 'Поставщик A', photoUrl: undefined },
    { id: 'new-3', supplier: 'Поставщик A', price: null },
  ];

  beforeAll(() => {
    global.IDBKeyRange = { only: (value) => value };
  });

  test('полный успех заменяет данные поставщика и возвращает счётчики', async () => {
    const database = createFakeDatabase([oldSupplierItem, otherSupplierItem]);
    setDatabase(database);

    await expect(save(validItems)).resolves.toEqual({ saved: 3, skipped: 0 });
    expect(database.getItems()).toEqual(
      expect.arrayContaining([otherSupplierItem, ...validItems])
    );
    expect(database.getItems()).not.toContainEqual(oldSupplierItem);
  });

  test('один невалидный товар пропускается до транзакции', async () => {
    const database = createFakeDatabase([oldSupplierItem]);
    setDatabase(database);
    const invalid = {
      id: 'invalid',
      supplier: 'Поставщик A',
      callback: () => {},
    };

    await expect(save([validItems[0], invalid])).resolves.toEqual({
      saved: 1,
      skipped: 1,
    });
    expect(database.transactionCount).toBe(1);
    expect(database.getItems()).toEqual([validItems[0]]);
  });

  test('все невалидные товары возвращают ошибку и не открывают транзакцию', async () => {
    const database = createFakeDatabase([oldSupplierItem]);
    setDatabase(database);

    await expect(
      save([null, { supplier: 'Поставщик A' }, { id: 'x' }])
    ).rejects.toThrow(/некорректны/);
    expect(database.transactionCount).toBe(0);
    expect(database.getItems()).toEqual([oldSupplierItem]);
  });

  test('товар без id пропускается, остальные сохраняются', async () => {
    const database = createFakeDatabase([oldSupplierItem]);
    setDatabase(database);

    await expect(
      save([{ supplier: 'Поставщик A' }, validItems[0]])
    ).resolves.toEqual({ saved: 1, skipped: 1 });
    expect(database.getItems()).toEqual([validItems[0]]);
  });

  test('товар другого поставщика пропускается', async () => {
    const database = createFakeDatabase([oldSupplierItem, otherSupplierItem]);
    setDatabase(database);

    await expect(
      save([validItems[0], { id: 'foreign', supplier: 'Поставщик B' }])
    ).resolves.toEqual({ saved: 1, skipped: 1 });
    expect(database.getItems()).toEqual(
      expect.arrayContaining([validItems[0], otherSupplierItem])
    );
    expect(database.getItems()).not.toContainEqual({
      id: 'foreign',
      supplier: 'Поставщик B',
    });
  });

  test.each([
    ['первого', 0],
    ['среднего', 1],
    ['последнего', 2],
  ])('ошибка %s put отменяет всю транзакцию', async (_, putIndex) => {
    const error = makeError('UnknownError', `put ${putIndex}`);
    const database = createFakeDatabase(
      [oldSupplierItem, otherSupplierItem],
      { type: 'put', putIndex, error }
    );
    setDatabase(database);

    await expect(save(validItems)).rejects.toBe(error);
    expect(database.getItems()).toEqual([oldSupplierItem, otherSupplierItem]);
  });

  test('ошибка удаления отменяет транзакцию и сохраняет старые данные', async () => {
    const error = makeError('UnknownError', 'delete failed');
    const database = createFakeDatabase(
      [oldSupplierItem, otherSupplierItem],
      { type: 'delete', error }
    );
    setDatabase(database);

    await expect(save(validItems)).rejects.toBe(error);
    expect(database.getItems()).toEqual([oldSupplierItem, otherSupplierItem]);
  });

  test('QuotaExceededError отменяет транзакцию и сохраняет старые данные', async () => {
    const error = makeError('QuotaExceededError');
    const database = createFakeDatabase(
      [oldSupplierItem, otherSupplierItem],
      { type: 'put', putIndex: 1, error }
    );
    setDatabase(database);

    await expect(save(validItems)).rejects.toBe(error);
    expect(database.getItems()).toEqual([oldSupplierItem, otherSupplierItem]);
  });
});

describe.each(catalogCases)(
  'явная замена категории: $label',
  ({ replace, setDatabase }) => {
    const supplier = 'Поставщик A';
    const oldSupplierItems = Array.from({ length: 500 }, (_, index) => ({
      id: `old-a-${index}`,
      supplier,
    }));
    const otherSupplierItem = { id: 'old-b', supplier: 'Поставщик B' };

    beforeAll(() => {
      global.IDBKeyRange = { only: (value) => value };
    });

    test('пустая замена удаляет все 500 товаров только указанного поставщика', async () => {
      const database = createFakeDatabase([
        ...oldSupplierItems,
        otherSupplierItem,
      ]);
      setDatabase(database);

      await expect(replace(supplier, [])).resolves.toEqual({
        saved: 0,
        skipped: 0,
      });
      expect(database.transactionCount).toBe(1);
      expect(database.getItems()).toEqual([otherSupplierItem]);
    });

    test('явный supplier не выводится из items', async () => {
      const database = createFakeDatabase(oldSupplierItems);
      setDatabase(database);

      await expect(
        replace(supplier, [{ id: 'foreign', supplier: 'Поставщик B' }])
      ).rejects.toThrow(/не совпадает/);
      expect(database.transactionCount).toBe(0);
      expect(database.getItems()).toHaveLength(500);
    });
  }
);

describe('изоляция TireDatabase и DiscDatabase', () => {
  const tireA = { id: 'tire-a', supplier: 'Поставщик A' };
  const tireB = { id: 'tire-b', supplier: 'Поставщик B' };
  const discA = { id: 'disc-a', supplier: 'Поставщик A' };

  beforeAll(() => {
    global.IDBKeyRange = { only: (value) => value };
  });

  test('очистка шин не изменяет диски', async () => {
    const tireDatabase = createFakeDatabase([tireA, tireB]);
    const discDatabase = createFakeDatabase([discA]);
    indexedDBService.db = tireDatabase;
    indexedDBService.discDb = discDatabase;

    await indexedDBService.replaceTiresForSupplier('Поставщик A', []);

    expect(tireDatabase.getItems()).toEqual([tireB]);
    expect(discDatabase.getItems()).toEqual([discA]);
    expect(discDatabase.transactionCount).toBe(0);
  });

  test('замена дисков не изменяет шины', async () => {
    const tireDatabase = createFakeDatabase([tireA]);
    const discDatabase = createFakeDatabase([discA]);
    const newDisc = { id: 'disc-new', supplier: 'Поставщик A' };
    indexedDBService.db = tireDatabase;
    indexedDBService.discDb = discDatabase;

    await indexedDBService.replaceDiscsForSupplier('Поставщик A', [newDisc]);

    expect(tireDatabase.getItems()).toEqual([tireA]);
    expect(tireDatabase.transactionCount).toBe(0);
    expect(discDatabase.getItems()).toEqual([newDisc]);
  });
});
