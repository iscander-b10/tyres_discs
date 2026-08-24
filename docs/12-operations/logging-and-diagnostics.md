# Логи и диагностика

::: tip Статус: проверено по коду
Frontend logging сверено с `appLog.js`, callers и `appLog.test.js`. Cloud
catalog-sync использует свой JSON logger и рассматривается отдельно.
:::

## Назначение

`appLog` создаёт небольшую стабильную запись для DevTools Console. Это не
аналитика, remote telemetry или пользовательское notification API: logger не
меняет UI и не отправляет данные по сети.

```text
ошибка подсистемы
  → caller выбирает code/domain/message
  → sanitizeLogContext
  → console.error или console.warn
```

## Публичный контракт

```js
appLog.error({ code, domain, message, error, context, expected })
appLog.warn({ code, domain, message, error, context, expected })
```

Оба метода возвращают сформированный entry. Обязательность полей технически не
проверяется: отсутствующие `code`, `domain`, `message` становятся пустыми
строками. Поэтому caller отвечает за стабильный код.

Entry содержит:

- `code`, `domain`, `level`, `expected`, `message`;
- `errorName` и `errorMessage`, если передана ошибка;
- `stack` только в development;
- безопасный `context`, если после sanitization остались поля.

`error` пишет `console.error('[app]', entry)`, `warn` —
`console.warn('[app]', entry)`.

## Защита контекста

`sanitizeLogContext` принимает только plain object. Безусловно удаляются
`password`, `secret`, `authSecret`, `wrappedSecret`, `fingerprint`, `snapshot`,
`commands`, `items`, `envelope`, `raw`, `token`, `authorization`; regex также
блокирует ключи, содержащие password/secret/fingerprint/token/authorization/
cookie/wrapped без учёта регистра.

Разрешаются только:

- primitive (`null`, string, number, boolean);
- массив до 20 primitive;
- ключи, не признанные чувствительными.

Вложенные объекты и массивы товаров не сериализуются. Это уменьшает риск
случайно записать credential или полный snapshot, но не исправляет небезопасный
`error.message`: caller не должен помещать секреты в текст Error.

## Классификация ошибок

| Helper | Семантика |
| --- | --- |
| `isExpectedOperationalError(error)` | `AbortError` и `StaleCatalogStoreError` — ожидаемые отмена/гонка |
| `isQuotaExceededError(error)` | name, browser codes 22/1014 или quota-текст |

Ожидаемую отмену не следует логировать как defect. Например,
`CatalogShowcase` пропускает expected operational error. При quota корзина
использует код `storage.quota_exceeded`; остальные persist failures —
`cart.persist_failed`.

## Основные frontend-коды

| Code | Источник | Что означает |
| --- | --- | --- |
| `auth.infra_failed` | AuthContext/session | Ошибка restore/sign-in/persist, не неверный пароль |
| `idb.unavailable` | catalogIdbSession | БД не удалось открыть/мигрировать |
| `catalog.snapshot_invalid` | catalogSyncService | Fatal validation до commit |
| `catalog.sync_failed` | catalogSyncService | Network, JSON или IDB failure |
| `search.options_failed` | SearchParameters | Facets/options не загрузились (`warn`) |
| `search.failed` | SearchParameters | Поиск завершился ошибкой |
| `showcase.load_failed` | CatalogShowcase | Нет usable current/stale showcase |
| `cart.catalog_read_failed` | AddToCartControl | Fresh read провалился, строка не добавлена |
| `storage.quota_exceeded` | CartContext | Storage quota |
| `cart.persist_failed` | CartContext | Другая ошибка записи корзины |

Это диагностические коды текущего кода, а не публичный versioned protocol.

## Frontend и cloud — разные журналы

`yandex/catalog-sync` пишет JSON-события `catalog-sync-start` и
`catalog-sync-finish` своим server logger. Они содержат store/slot/version,
counts и статусы поставщиков. `appLog` туда не импортируется: cloud function не
имеет браузерной console/storage границы.

Конкретный retention, destination и alerting cloud-логов задаются
инфраструктурой Yandex Cloud и **неизвестны из этого репозитория**.

## Тесты и ограничения

`src/utils/appLog.test.js` проверяет структуру entry, удаление секретов/тяжёлых
полей, expected errors, quota detection и выбор console method.

Ограничения:

- нет remote collector, correlation id и persistent history;
- `expected` — переданное поле entry, а не автоматический вызов
  `isExpectedOperationalError`;
- logger не показывает сообщение пользователю;
- sanitization защищает context keys, но не произвольный текст message/error.

## Связанные страницы

- [Ошибки catalog sync](/06-catalog-sync/error-recovery)
- [Troubleshooting](/14-development/troubleshooting)
- [Client auth](/04-auth/client-auth-model)
- [Домен корзины](/09-cart/cart-domain-and-storage)
