import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSnapshotSuppliers,
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  readPreviousCategoryState,
  resolveCategoryCommand,
} from './snapshotCommands.js';

const tyre = { id: 'tyre-1' };
const disc = { id: 'disc-1' };

test('wire schema version зафиксирована как 1', () => {
  assert.equal(CATALOG_SNAPSHOT_SCHEMA_VERSION, 1);
});

test('непустой успешный результат заменяет категорию', () => {
  const result = resolveCategoryCommand({
    loaded: true,
    items: [tyre],
    previousCategory: [{ id: 'old-tyre' }],
  });

  assert.deepEqual(result, {
    command: { action: 'replace', status: 'ok', items: [tyre] },
    degraded: false,
    reason: null,
  });
});

test('пустой результат сохраняет предыдущий materialized payload', () => {
  const previousItems = [{ id: 'old-tyre' }];
  const result = resolveCategoryCommand({
    loaded: true,
    items: [],
    previousCategory: previousItems,
  });

  assert.deepEqual(result.command, {
    action: 'replace',
    status: 'ok',
    items: previousItems,
  });
  assert.equal(result.degraded, true);
});

test('ошибка без предыдущего payload создаёт keepPrevious', () => {
  const result = resolveCategoryCommand({
    loaded: false,
    items: null,
    previousCategory: undefined,
  });

  assert.deepEqual(result.command, {
    action: 'keepPrevious',
    status: 'failed',
  });
});

test('подтверждённый предыдущий purge переносится без неоднозначного replace([])', () => {
  const result = resolveCategoryCommand({
    loaded: false,
    items: null,
    previousCategory: { action: 'purge', status: 'ok' },
  });

  assert.deepEqual(result.command, { action: 'purge', status: 'ok' });
});

test('предыдущее состояние читается из legacy- и command-форматов', () => {
  assert.deepEqual(readPreviousCategoryState([tyre]), {
    known: true,
    action: 'replace',
    items: [tyre],
  });
  assert.deepEqual(
    readPreviousCategoryState({
      action: 'replace',
      status: 'ok',
      items: [disc],
    }),
    { known: true, action: 'replace', items: [disc] }
  );
});

test('пустая категория помечает поставщика деградировавшим и не удаляет данные', () => {
  const previousTyres = [{ id: 'old-tyre' }];
  const { suppliers, metaSuppliers } = buildSnapshotSuppliers({
    previousSnapshot: {
      suppliers: {
        supplierA: {
          label: 'Поставщик A',
          tyres: previousTyres,
          discs: [disc],
        },
      },
    },
    loadResults: [
      {
        key: 'supplierA',
        status: 'fulfilled',
        value: { label: 'Поставщик A', tyres: [], discs: [disc] },
      },
    ],
    supplierKeys: ['supplierA'],
    getSupplierLabel: () => 'Поставщик A',
  });

  assert.deepEqual(suppliers.supplierA.tyres, {
    action: 'replace',
    status: 'ok',
    items: previousTyres,
  });
  assert.equal(suppliers.supplierA.ok, false);
  assert.match(suppliers.supplierA.error, /tyres/);
  assert.equal(metaSuppliers[0].keptPrevious, true);
});

test('повторный сбой сохраняет snapshot пригодным для bootstrap', () => {
  const previousItems = [{ id: 'old-tyre' }];
  const first = buildSnapshotSuppliers({
    previousSnapshot: {
      suppliers: {
        supplierA: {
          label: 'Поставщик A',
          tyres: previousItems,
          discs: [disc],
        },
      },
    },
    loadResults: [
      { key: 'supplierA', status: 'rejected', reason: new Error('HTTP 500') },
    ],
    supplierKeys: ['supplierA'],
    getSupplierLabel: () => 'Поставщик A',
  });
  const second = buildSnapshotSuppliers({
    previousSnapshot: { suppliers: first.suppliers },
    loadResults: [
      { key: 'supplierA', status: 'rejected', reason: new Error('HTTP 500') },
    ],
    supplierKeys: ['supplierA'],
    getSupplierLabel: () => 'Поставщик A',
  });

  assert.deepEqual(second.suppliers.supplierA.tyres, {
    action: 'replace',
    status: 'ok',
    items: previousItems,
  });
});
