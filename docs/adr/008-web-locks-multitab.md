# ADR-008: Web Locks и BroadcastChannel для multi-tab

## Статус

**Принято** — `catalogSyncLock.js`, `catalogSyncChannel.js`, `cartSync.js`.

## Контекст

Несколько вкладок staff app; autosync writer и cart updates должны не corrupt data.

## Проблема

Координация единственного writer snapshot и broadcast cart/catalog updates.

## Рассмотренные варианты

- **localStorage lease only** — реализован как fallback если Web Locks недоступны.
- Leader election через SharedWorker и т.п. **не зафиксированы**.

## Принятое решение

Catalog sync: `withCatalogSyncLock` (Web Locks API + LS lease TTL). После apply: `postCatalogApplied` / `subscribeCatalogApplied` (BroadcastChannel + storage fallback). Cart: `createCartSync` аналогично.

## Причины

- Native browser primitives
- Graceful fallback без locks

## Плюсы

- Один writer per store sync
- Другие вкладки получают notify без reload

## Минусы

- Safari/older browser quirks
- Lease timeout tuning
- Debugging distributed state

## Последствия

- Integration tests для lock + channel
- Не удалять LS fallback
- `notifyCatalogApplied` bump AppShell version

## Связанные файлы

- `src/services/catalogSync/catalogSyncLock.js`
- `src/services/catalogSync/catalogSyncChannel.js`
- `src/cart/cartSync.js`
- Tests: `catalogSyncLock.integration.test.js`, `cartSync.test.js`

## Связанные страницы

- [Locks and channels](/06-catalog-sync/locks-and-channels)
