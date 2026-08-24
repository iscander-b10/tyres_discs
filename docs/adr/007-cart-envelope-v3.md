# ADR-007: Envelope v3 корзины

## Статус

**Принято** — `cartStorage.js`, `CART_STORAGE_VERSION`.

## Контекст

Корзина local-first; multi-tab; migration from legacy keys; namespace per account/store.

## Проблема

Как persist корзину без server и поддержать sync/revision?

## Рассмотренные варианты

Legacy keys (`LEGACY_CART_KEYS`) существуют в коде миграции. Предыдущие форматы envelope v1/v2 **не документированы** как ADR; migration modal обрабатывает обнаруженный legacy.

## Принятое решение

Envelope v3 в localStorage: `{ version, revision, items, updatedAt }` keyed by store namespace. `createCartSync` для BroadcastChannel + storage events. Logout **не** удаляет persisted cart (flush + detach).

## Причины

- Revision для conflict detection между вкладками
- Store isolation после multi-store support
- Explicit migration path

## Плюсы

- Offline cart
- Multi-tab eventual consistency
- Reconciliation hook после catalog update

## Минусы

- localStorage size limit
- No server backup
- Legacy migration UX friction

## Последствия

- Breaking envelope → migration + tests
- `getCartStorageKey(accountId, storeId)` — единственный builder актуального store-key
- Logout policy tested in `useLogout.cartPolicy.test.jsx`

## Связанные файлы

- `src/cart/cartStorage.js`
- `src/cart/cartSync.js`
- `src/cart/CartContext.jsx`
- `src/cart/legacyCartMigration.js`

## Связанные страницы

- [Cart domain](/09-cart/cart-domain-and-storage)
- [Migration](/09-cart/migration-and-multitab)
