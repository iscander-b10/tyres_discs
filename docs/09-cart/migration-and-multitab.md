# Миграция и вкладки

::: tip Статус: проверено по коду
`cartSync`, legacy migration, account→store перенос и политика logout сверены с `cartSync.js`, `legacyCartMigration.js`, `useLogout.js` и тестами `*.test.js` / `useLogout.cartPolicy.test.jsx`.
:::

## Назначение

Объяснить:

5. как синхронизируются вкладки;
8. как работает legacy migration;
9. что происходит при login и logout;
а также схему хранения и каналов между вкладками.

Домен envelope и мутации — в [Домен корзины и хранение](/09-cart/cart-domain-and-storage).

## Простыми словами

Две вкладки одного менеджера в одном магазине должны видеть одну корзину. После успешного commit вкладка A публикует envelope; вкладка B применяет его, только если revision/updatedAt новее. Старые форматы `cart.staff.v1` / `v2` / `ivanor.cart.v1` не импортируются молча: появляется модалка «Перенести» или «Удалить». Решение запоминается маркером, чтобы вопрос не всплывал снова.

Выход из аккаунта **сохраняет** v3 на диске и отцепляет runtime. Следующий вход в тот же `accountId` + `storeId` поднимает ту же корзину.

## Исходные файлы

- [`src/cart/cartSync.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/cart/cartSync.js)
- [`src/cart/legacyCartMigration.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/cart/legacyCartMigration.js)
- [`src/cart/LegacyCartMigrationModal.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/cart/LegacyCartMigrationModal.jsx)
- [`src/cart/cartStorage.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/cart/cartStorage.js) — account→store
- [`src/auth/useLogout.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/auth/useLogout.js)

---

## Схема хранения и синхронизации вкладок

```mermaid
flowchart TB
  subgraph Persist[localStorage]
    V3["cart.staff.v3.{account}.{store}<br/>envelope JSON"]
    Acc["cart.staff.v3.{account}<br/>legacy account-only"]
    Leg["cart.staff.v1 / v2<br/>ivanor.cart.v1"]
    Marker["cart.staff.v3.legacy-decision.{account}.{keys}"]
    SyncKey["cart.staff.v3.sync.event<br/>краткоживущий fallback"]
  end

  subgraph TabA[Вкладка A]
    CtxA[CartProviderCore]
    SyncA[createCartSync]
  end

  subgraph TabB[Вкладка B]
    CtxB[CartProviderCore]
    SyncB[createCartSync]
  end

  BC((BroadcastChannel<br/>cart.staff.v3.sync))

  CtxA -->|commit write| V3
  CtxA -->|publish| SyncA
  SyncA -->|primary| BC
  SyncA -->|fallback set+remove| SyncKey
  BC --> SyncB
  SyncKey -->|storage event| SyncB
  SyncB -->|onEnvelope if newer| CtxB
  CtxB --> V3

  Acc -.->|migrateAccountCartToStore| V3
  Leg -.->|модалка migrate/discard| V3
  Leg -.-> Marker
```

Константы:

| Имя | Значение |
| --- | --- |
| `CART_KEY_PREFIX` | `cart.staff.v3.` |
| `CART_SYNC_CHANNEL` | `cart.staff.v3.sync` |
| `CART_SYNC_STORAGE_KEY` | `cart.staff.v3.sync.event` |
| `LEGACY_CART_KEYS` | `cart.staff.v2`, `cart.staff.v1`, `ivanor.cart.v1` |
| Marker prefix | `cart.staff.v3.legacy-decision.` |

---

## 5. Синхронизация вкладок

### `createCartSync`

| | |
| --- | --- |
| **Назначение** | Доставить envelope другим вкладкам того же account+store |
| **Вход** | `{ accountId, storeId, storage, windowObject, BroadcastChannelClass, onEnvelope }` |
| **Выход** | `{ publish(envelope) → bool, close() }` |
| **Состояние** | `channel`, флаг `closed`, ожидаемый `resolvedStoreId` |
| **Side effects** | BroadcastChannel postMessage; или setItem+removeItem sync-ключа; listener `storage` |
| **Зависимости** | `validateCartEnvelope`, `resolveCatalogStoreId` |
| **Кто вызывает** | `CartProviderCore` при готовности workspace |

### Пошаговый алгоритм

1. Всегда подписаться на `storage` для ключа `CART_SYNC_STORAGE_KEY`.
2. Если `BroadcastChannel` доступен — создать канал `CART_SYNC_CHANNEL` (primary publish).
3. `publish`: проверить envelope; собрать `{ accountId, storeId, envelope }`; postMessage **или** fallback setItem → removeItem (чтобы другие вкладки получили storage event).
4. `receive`: отбросить closed / чужой account / чужой store / невалидный envelope; иначе `onEnvelope`.
5. В `CartProvider` `onEnvelope` применяет только если generation current и `isEnvelopeNewer`.
6. `close`: снять listener, закрыть канал, игнорировать late events.

### Обработка ошибок

- Malformed JSON в storage event — ignore.
- Ошибка конструктора BC → `channel = null` → fallback.
- `publish` fail → `false` (локальный commit уже мог пройти).

### Тесты

`cartSync.test.js`: фильтр account/store, storage fallback без ретрансляции в BC, `close` игнорирует late messages.

### Опасные места

- Ретранслировать storage→BC нельзя — петля.
- Не ослаблять фильтр storeId: иначе чужой магазин затрёт корзину.
- Не применять envelope со старым `revision` поверх нового.

### Пример сообщения

```js
{
  accountId: 'account-a',
  storeId: 'store-a',
  envelope: { version: 3, revision: 5, updatedAt: 1_700_000_000_000, items: [...] }
}
```

---

## Account → store migrate

До store-namespace v3 мог лежать под `cart.staff.v3.{accountId}`.

`migrateAccountCartToStore` (вызывается из `readCartEnvelope`):

1. Если store-ключ валиден — вернуть его; legacy account-ключ best-effort удалить.
2. Иначе если account-ключ валиден — скопировать на store-ключ, удалить legacy, вернуть.
3. Иначе `null`.

Это **не** то же самое, что миграция v1/v2: формат уже envelope v3, меняется только ключ.

---

## 8. Legacy migration

### Зачем явный UI

Повреждённый или старый формат нельзя молча слить в v3: риск потерять данные или занести мусор. Corrupt v3 при обычном чтении даёт пустую корзину **без** автоимпорта legacy.

### `detectLegacyCart(storage, accountId, storeId)`

| | |
| --- | --- |
| **Назначение** | Найти legacy-ключи и понять, можно ли их разобрать |
| **Выход** | `null` или объект detection |
| **Алгоритм** | 1) собрать присутствующие `LEGACY_CART_KEYS`; 2) если есть marker для этой пары account+keys → `null`; 3) разобрать **первый** source: массив или `{ version: 1\|2, items }` через `validateCartItems`; 4) `status: 'valid' \| 'corrupted'` |

### `migrateLegacyCart`

1. Прочитать текущий v3 (если есть).
2. Merge: существующие v3 items + legacy items без дубликатов `key`.
3. Записать envelope, **verify readback**.
4. Удалить legacy keys, записать marker `migrated`.
5. При ошибке — rollback v3 и/или restore legacy (fail-safe).

### `discardLegacyCart`

Marker `discarded` + удаление legacy keys. Идемпотентно при повторном вызове.

### `LegacyCartMigrationModal`

| | |
| --- | --- |
| **Назначение** | Ant Design Modal: «Перенести» / «Удалить» |
| **Состояние** | detection при mount; `closable={false}` |
| **Поведение** | corrupted → OK (перенос) disabled; только discard |
| **Side effects** | migrate/discard storage; `onMigrated(envelope)` → `handleMigrated` в Context (replaceRuntime + publish) |
| **Гварды** | `isCurrent()` после async — не применять к чужому generation |
| **Кто монтирует** | `CartProviderCore`, когда `isLoaded` и есть active workspace |
| **Тесты** | `LegacyCartMigrationModal.test.jsx`, `legacyCartMigration.test.js` |

### Sequence: миграция

```mermaid
sequenceDiagram
  participant Cart as CartProviderCore
  participant Modal as LegacyCartMigrationModal
  participant Detect as detectLegacyCart
  participant Mig as migrateLegacyCart
  participant LS as localStorage
  participant Sync as createCartSync

  Cart->>Modal: mount (isLoaded)
  Modal->>Detect: detect(storage, account, store)
  alt marker уже есть / нет legacy
    Detect-->>Modal: null
    Note over Modal: не показывать
  else valid
    Detect-->>Modal: status valid + items
    Modal->>Modal: показать диалог
    User->>Modal: Перенести
    Modal->>Mig: migrateLegacyCart
    Mig->>LS: write v3 + verify + remove legacy + marker
    Mig-->>Modal: envelope
    Modal->>Cart: onMigrated(envelope)
    Cart->>Cart: replaceRuntime
    Cart->>Sync: publish
  else corrupted
    Detect-->>Modal: status corrupted
    Note over Modal: только «Удалить»
  end
```

### Опасные места

- Менять семантику marker → модалка снова появится или наоборот никогда не появится.
- Миграция без verify readback — риск «думали, записали».
- Автоимпорт без UI нарушит контракт «corrupt v3 ≠ silent legacy».

---

## 9. Login и logout

### Login

Сам `signIn` / `restore` корзину не трогает.

Когда workspace готов:

1. `CartProvider` читает store-scoped v3 (или empty).
2. Подключает sync.
3. Монтирует `CartReconciliationHost` (через `WorkspaceHosts`).
4. При необходимости показывает legacy-модалку.

Смена `accountId` или `storeId` → новый generation, другой ключ storage, прежняя корзина другого магазина не смешивается.

### Sequence: logout

```mermaid
sequenceDiagram
  participant User
  participant Header as SiteHeader
  participant UL as useLogout
  participant Cart as CartContext
  participant IDB as indexedDBService
  participant Auth as AuthProvider
  participant LS as localStorage
  participant Nav as navigate

  User->>Header: Выйти
  Header->>UL: executeLogout()
  UL->>Cart: flush()
  Cart->>LS: write cart.staff.v3.{account}.{store}
  UL->>Cart: detach()
  Note over Cart: sync closed, runtime empty,<br/>persisted v3 остаётся
  UL->>IDB: invalidateActiveStore(storeId)
  UL->>Auth: logout()
  Note over Auth: generation++, keys cleared, workspace=null
  UL->>Nav: replace /
```

Порядок **жёсткий** (тесты `useLogout.test.jsx`):

1. `flush()`
2. `detach()`
3. `invalidateActiveStore`
4. `logout()`
5. `navigate(PATHS.home, { replace: true })`

**Никогда `clear()`.** Интеграция: `useLogout.cartPolicy.test.jsx` — после выхода ключ v3 на месте, runtime пуст.

Подробнее про generation auth и порядок очистки — [Гонки и выход](/04-auth/races-and-logout).

---

## Инварианты этой главы

1. Sync применяет только envelope того же account+store и только если newer.
2. Fallback storage-event не должен ретранслироваться в BroadcastChannel.
3. Legacy решение идемпотентно через marker.
4. Logout сохраняет v3; clear — только явное действие UI.
5. Account-only v3 ключ мигрирует в store-ключ один раз, store побеждает.

## Связанные страницы

- [Домен корзины и хранение](/09-cart/cart-domain-and-storage)
- [Сверка с каталогом](/09-cart/catalog-reconciliation)
- [Гонки и выход](/04-auth/races-and-logout)
- [Блокировки и каналы каталога](/06-catalog-sync/locks-and-channels) — другой канал, не путать с cart sync
