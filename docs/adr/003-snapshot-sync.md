# ADR-003: Snapshot-синхронизация каталога

## Статус

**Принято** — cloud `catalog-sync` + frontend `checkAndSyncCatalog`.

## Контекст

Пять upstream API с разными форматами; браузер не должен опрашивать их в production (CORS, объём, частичные сбои).

## Проблема

Как доставить единый актуальный каталог на все клиенты?

## Рассмотренные варианты

- **Browser direct load** (`supplierOrchestrator`) — код сохранён, но **не** production path (legacy/manual).
- Другие альтернативы (SSE, WebSocket push, per-supplier REST) **не зафиксированы**.

## Принятое решение

Yandex Cloud Function по Timer собирает upstream → `snapshot.json` + `meta.json` в Object Storage. Browser autosync: meta version gate → download snapshot → validate → IDB apply. Команды: `replace`, `keepPrevious`, `purge`. **Пустой upstream ≠ purge.**

## Причины

- Единая normalization в cloud
- Частичный fail без потери всего каталога
- Versioned immutable snapshots

## Плюсы

- Shared transformers с frontend bundle в CF
- Predictable sync slots MSK
- Multi-tab coordination через locks

## Минусы

- Задержка до следующего slot/refresh
- Зависимость от Object Storage + Gateway
- Large snapshot download on mobile

## Последствия

- Frontend supplier env — dev/legacy only
- Wire schema — shared contract (`schemaVersion`)
- Тесты: `snapshotCommands.test.js`, `catalogSyncService.test.js`

## Связанные файлы

- `yandex/catalog-sync/src/runSync.js`, `snapshotCommands.js`
- `src/services/catalogSync/catalogSyncService.js`
- `src/services/catalogSync/catalogSnapshotValidation.js`

## Связанные страницы

- [Catalog lifecycle](/06-catalog-sync/catalog-lifecycle)
- [Snapshot protocol](/06-catalog-sync/snapshot-protocol-validation)
