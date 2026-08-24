# Изменение IndexedDB

::: tip Статус: проверено по коду
Схема, миграции и transaction boundaries.
:::

## Файлы

| Файл | Ответственность |
| --- | --- |
| `catalogSchema.js` | DB name, version, stores, indexes |
| `catalogIdbSession.js` | open, migrate, apply, search |
| `catalogIdbQueries.js` | cursors, index hints |
| `catalogSearchFilters.js` | post-filter |
| `catalogItemValidation.js` | pre-write validation |

## Типы изменений

### A. Новое поле item (без index)

1. Обновить validation/normalization в `catalogItemValidation.js` и `catalogSnapshotValidation.js`
2. Обновить wire schema docs
3. Cloud transformers должны заполнять поле
4. Тесты: validation + fakeIndexedDB apply

**Миграция IDB не нужна** если поле optional.

### B. Новый index

1. Bump `CATALOG_DB_VERSION` в `catalogSchema.js`
2. `onupgradeneeded` — создать index
3. Обновить `TIRE_SEARCH_INDEX_HINTS` / `pickEqualityIndex`
4. Тесты queries + search integration

### C. Новый store

1. Bump version, add store in upgrade
2. Update `ALL_CATALOG_STORES`, apply snapshot commands
3. Full migration path in session open

### D. Breaking item shape

1. Coordinate with snapshot `schemaVersion`
2. Migration или purge category via snapshot command
3. Document in [lifecycle](/05-catalog-storage/lifecycle-and-migration)

## Правила transaction

- **Один** `applyCatalogSnapshot` = одна transaction per category command batch
- Не читать partial state mid-transaction из UI
- После commit → `bumpCatalogDataVersion` / `postCatalogApplied`

См. `catalogSyncService.commitBoundary.test.js`.

## Per-store isolation

DB name: `CatalogDatabase.<encodeURIComponent(storeId)>`. Смена workspace → `setActiveStore`; товары разных магазинов не смешиваются в одной БД. Каноническая схема и точные имена stores описаны на странице [Схема IndexedDB](/05-catalog-storage/indexeddb-schema).

## Checklist перед merge

- [ ] `CATALOG_DB_VERSION` если schema change
- [ ] sync validation mirror updated
- [ ] search/showcase/cart read paths updated
- [ ] fakeIndexedDB tests green
- [ ] [ADR-002](/adr/002-indexeddb-catalog) constraints respected

## Связанные страницы

- [Схема IDB](/05-catalog-storage/indexeddb-schema)
- [Lifecycle](/05-catalog-storage/lifecycle-and-migration)
- [Queries](/05-catalog-storage/queries-filters-facets)
