# Изменение catalog sync

::: tip Статус: проверено по коду
Frontend autosync + cloud pipeline + wire protocol.
:::

## Границы

| Слой | Файлы |
| --- | --- |
| Browser triggers | `CatalogSyncHost.jsx` |
| Version gate + fetch | `catalogSyncService.js` |
| Validation | `catalogSnapshotValidation.js` |
| Lock/channel | `catalogSyncLock.js`, `catalogSyncChannel.js` |
| IDB apply | `catalogIdbSession.applyCatalogSnapshot` |
| Cloud sync | `yandex/catalog-sync/src/runSync.js`, `handler.js` |
| Commands | `snapshotCommands.js` |

## Типичные задачи

### Изменить расписание проверок (browser)

`CATALOG_SYNC_CHECK_SLOTS` в `catalogSyncService.js` — MSK slots + 10 min offset from Timer. Слоты облака те же: `08:00`, `09:30`, `12:00`, `15:00`. Чаще к поставщикам не ходить.

Показ вкладки кроме слота: `start`, `visibilitychange` → visible, `online`, `pageshow` (включая bfcache) и `resume`. `focus` не чаще одного meta за 30 секунд. `start`, слот и retry шторки эту паузу не ждут.

Cloud Timer slots — `yandex/catalog-sync/src/time.js` + Yandex triggers.

`version` публикации — `versionForPublication` (московское время окончания прогона, до секунды). `slot` остаётся подписью окна. Повтор слота в тот же день меняет version. Порядок записи: сначала snapshot, потом meta. `versionForSlot` остаётся у frozen demo snapshot.

### Изменить wire format

1. Bump `schemaVersion` / `CATALOG_SNAPSHOT_SCHEMA_VERSION`
2. Update `validateAndNormalizeCatalogSnapshot` (browser + cloud share rules)
3. Update `applyCatalogSnapshot` command handling
4. Tests: `catalogSnapshotValidation.test.js`, `snapshotCommands.test.js`

### Изменить partial failure policy

`resolveCategoryCommand` — `replace` / `keepPrevious` / `purge`.  
**Подтверждённое правило:** empty upstream ≠ purge ([ADR-003](/adr/003-snapshot-sync)).

### Изменить multi-tab behavior

`withCatalogSyncLock` + `postCatalogApplied`. Integration test обязателен.

Файл качает одна вкладка. Текст «Каталог загружается в другой вкладке» на экран не выводится: пустая база ждёт lock на обычной шторке загрузки. Вкладка, где каталог уже лежит, шторку не открывает и после чужого commit читает ту же базу через channel. Сбой на непустой базе не чистит IndexedDB и не закрывает витрину: строка «Каталог не обновился» до более новой version.

### Новый storeId

`REACT_APP_STORE_ID`, cloud `STORE_ID`, bucket path `stores/{storeId}/`.

## Deploy order

1. Cloud CF `yandex/catalog-sync`, затем фронт. Новая version — тот же сортируемый формат `YYYY-MM-DDTHH:mm:ss+03:00`: старый фронт понимает более позднюю строку.
2. Frontend with matching validation
3. Verify meta/snapshot endpoints
4. Monitor `catalog-sync-finish` logs

## Опасные места

- Разделение `meta.version` и локального `localStorage` version key
- Commit boundary — не apply partial IDB state
- Blocking fatal → skip apply entirely. Секционный `DUPLICATE_ID` оставляет свою supplier+category и применяет остальные
- Warning → apply with normalized data

## Связанные страницы

- [Frontend autosync](/06-catalog-sync/frontend-autosync)
- [Snapshot protocol](/06-catalog-sync/snapshot-protocol-validation)
- [Yandex runbook](/12-operations/yandex-runbook)
- [ADR-003 Snapshot sync](/adr/003-snapshot-sync)
