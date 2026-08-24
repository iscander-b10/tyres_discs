# ADR-002: IndexedDB как локальное хранилище каталога

## Статус

**Принято** — подтверждено `catalogIdbSession`, schema tests.

## Контекст

Каталог десятки тысяч items; нужны indexed query, offline read, facets. SPA на GitHub Pages без server-side DB.

## Проблема

Где хранить materialized catalog для поиска и showcase в браузере?

## Рассмотренные варианты

Исторические альтернативы **не зафиксированы** в repo (localStorage, in-memory only, SQL.js и т.д. не документированы как рассматривавшиеся).

## Принятое решение

IndexedDB database per `storeId`: `CatalogDatabase.<encodeURIComponent(storeId)>`. Object stores: `tires`, `discs`, `metadata`; equality indexes ускоряют часть запросов. Snapshot apply — одна общая `readwrite`-транзакция на batch нормализованных команд.

## Причины

- Объём данных превышает localStorage
- Нативные indexes + cursors
- Transaction API для atomic apply

## Плюсы

- Быстрый поиск с index hint + post-filter
- Изоляция multi-store
- Offline после sync

## Минусы

- Quota limits браузера
- Сложность migration schema
- DevTools debugging сложнее SQL

## Последствия

- Любое изменение schema → version bump + tests
- Facade `indexedDBService.js` для stable import path
- Legacy per-supplier save API сохранён, но не primary writer

## Связанные файлы

- `src/services/catalogIdb/catalogSchema.js`
- `src/services/catalogIdb/catalogIdbSession.js`
- `src/services/catalogIdb/catalogIdbQueries.js`
- Tests: `indexedDBService.fakeIndexedDB.test.js`

## Связанные страницы

- [Схема IDB](/05-catalog-storage/indexeddb-schema)
- [Изменение IDB](/14-development/change-indexeddb)
