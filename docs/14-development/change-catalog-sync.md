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

`CATALOG_SYNC_CHECK_SLOTS` в `catalogSyncService.js` — MSK slots + 10 min offset from Timer.

Cloud Timer slots — `yandex/catalog-sync/src/time.js` + Yandex triggers.

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

### Новый storeId

`REACT_APP_STORE_ID`, cloud `STORE_ID`, bucket path `stores/{storeId}/`.

## Deploy order

1. Cloud CF + Gateway (backward compatible snapshot if possible)
2. Frontend with matching validation
3. Verify meta/snapshot endpoints
4. Monitor `catalog-sync-finish` logs

## Опасные места

- Разделение `meta.version` и локального `localStorage` version key
- Commit boundary — не apply partial IDB state
- Fatal validation → skip apply entirely
- Warning → apply with normalized data

## Связанные страницы

- [Frontend autosync](/06-catalog-sync/frontend-autosync)
- [Snapshot protocol](/06-catalog-sync/snapshot-protocol-validation)
- [Yandex runbook](/12-operations/yandex-runbook)
- [ADR-003 Snapshot sync](/adr/003-snapshot-sync)
