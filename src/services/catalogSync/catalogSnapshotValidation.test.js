import {
  VALIDATION_PROBLEM_LIMIT,
  normalizeNumber,
  validateAndNormalizeCatalogSnapshot,
  validateCatalogSnapshot,
} from './catalogSnapshotValidation';

const VERSION = '2026-08-23T12:00:00Z';
const SUPPLIER = 'Поставщик A';

const replace = (items = []) => ({ action: 'replace', status: 'ok', items });
const purge = () => ({ action: 'purge', status: 'ok' });
const keepPrevious = (status = 'failed') => ({ action: 'keepPrevious', status });

const baseItem = (over = {}) => ({
  id: 'item-1',
  code: 'CODE-1',
  supplier: SUPPLIER,
  amount: 4,
  price: 1000,
  sellingPrice: 1200,
  brand: 'Brand',
  model: 'Model',
  title: 'Brand Model',
  sizeTitle: '205/55R16',
  ...over,
});

const tyreItem = (over = {}) =>
  baseItem({
    id: 'tyre-1',
    width: 205,
    profile: 55,
    diameter: 'R16',
    season: 's',
    spikes: false,
    runflat: false,
    ...over,
  });

const discItem = (over = {}) =>
  baseItem({
    id: 'disc-1',
    code: 'DISC-1',
    width: 7,
    diameter: 'R16',
    pn: 5,
    pcd: 114.3,
    et: 40,
    cb: 66.1,
    diskType: 'Литой',
    color: 'Black',
    sizeTitle: 'R16 / 7J',
    ...over,
  });

const snapshotOf = ({
  schemaVersion,
  tyres = replace([tyreItem()]),
  discs = keepPrevious(),
  suppliers,
} = {}) => {
  const body = {
    version: VERSION,
    suppliers: suppliers || {
      'supplier-a': { supplier: SUPPLIER, tyres, discs },
    },
  };
  if (schemaVersion !== undefined) body.schemaVersion = schemaVersion;
  return body;
};

describe('normalizeNumber', () => {
  test.each([
    [4, 4],
    ['4', 4],
    ['4,0', 4],
    ['114,3', 114.3],
    [' 205 ', 205],
    ['123abc', null],
    [NaN, null],
    [Infinity, null],
    ['', null],
    [null, null],
  ])('%p → %p', (input, expected) => {
    expect(normalizeNumber(input)).toBe(expected);
  });
});

describe('validateAndNormalizeCatalogSnapshot — envelope', () => {
  test('отсутствует version', () => {
    const { report } = validateAndNormalizeCatalogSnapshot({
      suppliers: { a: { supplier: SUPPLIER, tyres: purge(), discs: purge() } },
    });
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'INVALID_VERSION')).toBe(true);
  });

  test('suppliers не объект', () => {
    const { report } = validateAndNormalizeCatalogSnapshot({
      version: VERSION,
      suppliers: [],
    });
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'INVALID_SUPPLIERS')).toBe(true);
  });

  test('неизвестная schemaVersion — fatal', () => {
    const { report, commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({ schemaVersion: 99 })
    );
    expect(report.valid).toBe(false);
    expect(commands).toEqual([]);
    expect(
      report.errors.some((e) => e.code === 'UNSUPPORTED_SCHEMA_VERSION')
    ).toBe(true);
  });

  test('отсутствующая schemaVersion принимается с warning', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(snapshotOf());
    expect(report.valid).toBe(true);
    expect(
      report.warnings.some((w) => w.code === 'MISSING_SCHEMA_VERSION')
    ).toBe(true);
  });

  test('schemaVersion === 1 принимается', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({ schemaVersion: 1 })
    );
    expect(report.valid).toBe(true);
    expect(report.schemaVersion).toBe(1);
  });

  test('неизвестный action', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        tyres: { action: 'merge', status: 'ok' },
      })
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'UNKNOWN_ACTION')).toBe(true);
  });

  test('items является объектом вместо массива', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        tyres: { action: 'replace', status: 'ok', items: { id: 'x' } },
      })
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'INVALID_ITEMS')).toBe(true);
  });

  test('validateCatalogSnapshot бросает с validationReport', () => {
    expect(() =>
      validateCatalogSnapshot({ version: VERSION, suppliers: {} })
    ).toThrow(/Некорректный snapshot/);
    try {
      validateCatalogSnapshot({ version: VERSION, suppliers: {} });
    } catch (err) {
      expect(err.validationReport).toBeTruthy();
      expect(err.validationReport.valid).toBe(false);
    }
  });
});

describe('validateAndNormalizeCatalogSnapshot — identity', () => {
  test('отсутствует id', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        tyres: replace([tyreItem({ id: '' })]),
      })
    );
    expect(report.errors.some((e) => e.code === 'MISSING_ID')).toBe(true);
  });

  test('отсутствует code', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        tyres: replace([tyreItem({ code: null })]),
      })
    );
    expect(report.errors.some((e) => e.code === 'MISSING_CODE')).toBe(true);
  });

  test('отсутствует supplier', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        tyres: replace([tyreItem({ supplier: '' })]),
      })
    );
    expect(report.errors.some((e) => e.code === 'MISSING_SUPPLIER')).toBe(true);
  });

  test('supplier не совпадает с секцией', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        tyres: replace([tyreItem({ supplier: 'Другой' })]),
      })
    );
    expect(report.errors.some((e) => e.code === 'SUPPLIER_MISMATCH')).toBe(true);
  });

  test('duplicate итогового id внутри supplier', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        tyres: replace([
          tyreItem({ id: 'same', code: '1' }),
          tyreItem({ id: 'same', code: '2' }),
        ]),
      })
    );
    const dup = report.errors.find((e) => e.code === 'DUPLICATE_ID');
    expect(dup).toBeTruthy();
    expect(dup.firstPath).toContain('items[0]');
    expect(dup.path).toContain('items[1]');
  });

  test('duplicate итогового id между suppliers', () => {
    const { report } = validateAndNormalizeCatalogSnapshot({
      version: VERSION,
      schemaVersion: 1,
      suppliers: {
        a: {
          supplier: 'A',
          tyres: replace([tyreItem({ id: 'shared', code: '1', supplier: 'A' })]),
          discs: purge(),
        },
        b: {
          supplier: 'B',
          tyres: replace([tyreItem({ id: 'shared', code: '1', supplier: 'B' })]),
          discs: purge(),
        },
      },
    });
    expect(report.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
  });

  test('одинаковый code у разных suppliers с разными id проходит', () => {
    const { report, commands } = validateAndNormalizeCatalogSnapshot({
      version: VERSION,
      schemaVersion: 1,
      suppliers: {
        shinservice: {
          supplier: 'Шинсервис',
          tyres: replace([
            tyreItem({
              id: 'shinservice_12345',
              code: '12345',
              supplier: 'Шинсервис',
            }),
          ]),
          discs: purge(),
        },
        shinasu: {
          supplier: 'ШинаСу',
          tyres: replace([
            tyreItem({
              id: 'shinasu_12345',
              code: '12345',
              supplier: 'ШинаСу',
            }),
          ]),
          discs: purge(),
        },
      },
    });
    expect(report.valid).toBe(true);
    expect(commands).toHaveLength(4);
  });

  test('legacy numeric id допускается', () => {
    const { report, commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([tyreItem({ id: 42, code: 99 })]),
      })
    );
    expect(report.valid).toBe(true);
    expect(commands[0].items[0].id).toBe(42);
    expect(commands[0].items[0].code).toBe(99);
  });
});

describe('validateAndNormalizeCatalogSnapshot — numbers', () => {
  test('amount number / numeric string / comma', () => {
    const cases = [
      [4, 4],
      ['4', 4],
      ['4,0', 4],
    ];
    cases.forEach(([amount, expected]) => {
      const { commands } = validateAndNormalizeCatalogSnapshot(
        snapshotOf({
          schemaVersion: 1,
          tyres: replace([tyreItem({ amount })]),
        })
      );
      expect(commands[0].items[0].amount).toBe(expected);
    });
  });

  test('отрицательный amount → 0 + warning', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([tyreItem({ amount: -3 })]),
      })
    );
    expect(commands[0].items[0].amount).toBe(0);
    expect(report.warnings.some((w) => w.code === 'INVALID_AMOUNT')).toBe(true);
  });

  test('нечисловой amount → 0 + warning', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([tyreItem({ amount: 'много' })]),
      })
    );
    expect(commands[0].items[0].amount).toBe(0);
    expect(report.warnings.some((w) => w.code === 'INVALID_AMOUNT')).toBe(true);
  });

  test('дробный amount округляется с warning', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([tyreItem({ amount: 4.9 })]),
      })
    );
    expect(commands[0].items[0].amount).toBe(4);
    expect(report.warnings.some((w) => w.code === 'AMOUNT_ROUNDED')).toBe(true);
  });

  test('NaN/null/Infinity в ценах → null + warning', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([
          tyreItem({
            price: NaN,
            sellingPrice: Infinity,
            websitePrice: 'abc',
          }),
        ]),
      })
    );
    const item = commands[0].items[0];
    expect(item.price).toBeNull();
    expect(item.sellingPrice).toBeNull();
    expect(item.websitePrice).toBeNull();
    expect(report.warnings.filter((w) => w.code === 'INVALID_PRICE').length).toBe(
      3
    );
  });
});

describe('validateAndNormalizeCatalogSnapshot — tires', () => {
  test('205/55R16 сохраняется', () => {
    const { commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([
          tyreItem({
            width: 205,
            profile: 55,
            diameter: 'r16',
            sizeTitle: '205/55R16',
          }),
        ]),
      })
    );
    const item = commands[0].items[0];
    expect(item.width).toBe(205);
    expect(item.profile).toBe(55);
    expect(item.diameter).toBe('R16');
    expect(item.sizeTitle).toBe('205/55R16');
  });

  test('145R13C с profile null', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([
          tyreItem({
            width: 145,
            profile: null,
            diameter: 'R13C',
            sizeTitle: '145R13C',
            model: undefined,
            websitePrice: undefined,
            runflat: undefined,
          }),
        ]),
      })
    );
    const item = commands[0].items[0];
    expect(item.profile).toBeNull();
    expect(item.model).toBeNull();
    expect(item.websitePrice).toBeNull();
    expect(item.runflat).toBeNull();
    expect(report.valid).toBe(true);
  });

  test('profile 0 → null', () => {
    const { commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([tyreItem({ profile: 0, sizeTitle: '145R13C' })]),
      })
    );
    expect(commands[0].items[0].profile).toBeNull();
  });

  test('31x10.5R15 не ломается', () => {
    const { commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([
          tyreItem({
            width: 31,
            profile: 10.5,
            diameter: 'R15',
            sizeTitle: '31x10.5R15',
          }),
        ]),
      })
    );
    const item = commands[0].items[0];
    expect(item.width).toBe(31);
    expect(item.profile).toBe(10.5);
    expect(item.diameter).toBe('R15');
    expect(item.sizeTitle).toBe('31x10.5R15');
  });

  test('дробный diameter R17.5 / R22.5 сохраняется (не null)', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([
          tyreItem({
            id: 't-175',
            code: 'c-175',
            diameter: 'R17.5',
            sizeTitle: '215/75R17.5',
          }),
          tyreItem({
            id: 't-225',
            code: 'c-225',
            diameter: 'r22,5',
            sizeTitle: '295/80R22.5',
          }),
          tyreItem({
            id: 't-num',
            code: 'c-num',
            diameter: 17.5,
            sizeTitle: '215/75R17.5',
          }),
        ]),
      })
    );
    expect(report.valid).toBe(true);
    expect(report.warnings.some((w) => w.code === 'INVALID_DIAMETER')).toBe(
      false
    );
    expect(commands[0].items.map((i) => i.diameter)).toEqual([
      'R17.5',
      'R22.5',
      'R17.5',
    ]);
  });

  test('неизвестные season/spikes/runflat → null + warning', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([
          tyreItem({ season: 'all', spikes: 'yes', runflat: 2 }),
        ]),
      })
    );
    const item = commands[0].items[0];
    expect(item.season).toBeNull();
    expect(item.spikes).toBeNull();
    expect(item.runflat).toBeNull();
    expect(report.warningCount).toBeGreaterThanOrEqual(3);
    expect(report.valid).toBe(true);
  });

  test('сохраняет неизвестные cloneable-поля', () => {
    const { commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([
          tyreItem({ promoBadge: 'sale', loadIndex: '91' }),
        ]),
      })
    );
    expect(commands[0].items[0].promoBadge).toBe('sale');
    expect(commands[0].items[0].loadIndex).toBe('91');
  });

  test('function-поле товара даёт NOT_CLONEABLE', () => {
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace([tyreItem({ toJSON: () => ({}) })]),
      })
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((problem) => problem.code === 'NOT_CLONEABLE')).toBe(
      true
    );
  });

  test('не вызывает structuredClone на JSON-товары snapshot', () => {
    const original = global.structuredClone;
    const spy = jest.fn();
    global.structuredClone = spy;
    try {
      const items = Array.from({ length: 40 }, (_, index) =>
        tyreItem({ id: `tyre-${index}`, code: `C-${index}` })
      );
      const { report } = validateAndNormalizeCatalogSnapshot(
        snapshotOf({
          schemaVersion: 1,
          tyres: replace(items),
        })
      );
      expect(report.valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      global.structuredClone = original;
    }
  });
});

describe('validateAndNormalizeCatalogSnapshot — discs', () => {
  test('отрицательный ET и дробный PCD', () => {
    const { commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: purge(),
        discs: replace([discItem({ et: -12, pcd: '114,3', width: '7,5' })]),
      })
    );
    const item = commands[1].items[0];
    expect(item.et).toBe(-12);
    expect(item.pcd).toBe(114.3);
    expect(item.width).toBe(7.5);
  });

  test('отсутствующие color/model/pn/pcd/cb сохраняют карточку', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: purge(),
        discs: replace([
          discItem({
            color: '',
            model: '',
            pn: null,
            pcd: null,
            cb: null,
          }),
        ]),
      })
    );
    expect(report.valid).toBe(true);
    const item = commands[1].items[0];
    expect(item.color).toBeNull();
    expect(item.model).toBeNull();
    expect(item.pn).toBeNull();
  });

  test('неизвестный diskType → null + warning', () => {
    const { commands, report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: purge(),
        discs: replace([discItem({ diskType: 'Кованый' })]),
      })
    );
    expect(commands[1].items[0].diskType).toBeNull();
    expect(report.warnings.some((w) => w.code === 'INVALID_DISK_TYPE')).toBe(
      true
    );
    expect(report.valid).toBe(true);
  });
});

describe('validateAndNormalizeCatalogSnapshot — large snapshot', () => {
  test('одна нормализуемая запись среди 10000 не блокирует snapshot', () => {
    const items = Array.from({ length: 10000 }, (_, i) =>
      tyreItem({
        id: `tyre-${i}`,
        code: `C${i}`,
        amount: i === 5000 ? '4,5' : 4,
      })
    );
    const { report, commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace(items),
        discs: purge(),
      })
    );
    expect(report.valid).toBe(true);
    expect(commands[0].items).toHaveLength(10000);
    expect(commands[0].items[5000].amount).toBe(4);
    expect(report.warnings.some((w) => w.code === 'AMOUNT_ROUNDED')).toBe(true);
  });

  test('одна fatal identity error среди 10000 отклоняет snapshot', () => {
    const items = Array.from({ length: 10000 }, (_, i) =>
      tyreItem({
        id: i === 9999 ? '' : `tyre-${i}`,
        code: `C${i}`,
      })
    );
    const { report, commands } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace(items),
        discs: purge(),
      })
    );
    expect(report.valid).toBe(false);
    expect(commands).toEqual([]);
    expect(report.errors.some((e) => e.code === 'MISSING_ID')).toBe(true);
  });

  test('duplicate id в конце большого массива обнаруживается', () => {
    const items = Array.from({ length: 5000 }, (_, i) =>
      tyreItem({
        id: i === 4999 ? 'tyre-0' : `tyre-${i}`,
        code: `C${i}`,
      })
    );
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace(items),
        discs: purge(),
      })
    );
    const dup = report.errors.find((e) => e.code === 'DUPLICATE_ID');
    expect(dup).toBeTruthy();
    expect(dup.path).toContain('items[4999]');
    expect(dup.firstPath).toContain('items[0]');
  });

  test('report ограничивается 100 подробными проблемами', () => {
    const items = Array.from({ length: 250 }, (_, i) =>
      tyreItem({
        id: `tyre-${i}`,
        code: `C${i}`,
        amount: 'bad',
        season: 'x',
      })
    );
    const { report } = validateAndNormalizeCatalogSnapshot(
      snapshotOf({
        schemaVersion: 1,
        tyres: replace(items),
        discs: purge(),
      })
    );
    expect(report.valid).toBe(true);
    expect(report.warningCount).toBeGreaterThan(VALIDATION_PROBLEM_LIMIT);
    expect(report.warnings.length + report.errors.length).toBe(
      VALIDATION_PROBLEM_LIMIT
    );
    expect(report.truncated).toBe(true);
  });
});
