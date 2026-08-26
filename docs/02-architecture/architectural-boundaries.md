# Архитектурные границы

::: tip Статус: проверено по коду
Страница фиксирует подсистемы и их ответственность по фактическому коду. Желаемая «чистая» слоёная модель не выдаётся за текущее состояние.
:::

## Назначение

Объяснить, **где заканчивается одна подсистема и начинается другая**, кто чем владеет и какие пересечения границ уже существуют в коде. Это карта ответственности, а не список файлов.

## Простыми словами

Архитектурная граница — это договорённость: «этот код решает одну задачу и не должен брать чужие». Например, поиск шин не должен сам ходить к API поставщиков, а Cloud Function не должна знать про React Context.

В Ivanor границы в целом соблюдаются, но есть несколько осознанных и несколько неудобных пересечений. Их важно видеть заранее, чтобы не усугублять при рефакторинге.

## Тринадцать подсистем

| # | Подсистема | Граница ответственности | Ключевые пути |
| --- | --- | --- | --- |
| 1 | Запуск и тема | Bootstrap CRA, Ant Design ConfigProvider, appearance | `src/index.js`, `src/theme/appearance.js` |
| 2 | Маршрутизация и AppShell | Guards, login-modal, dual-mount панелей, режим UI | `src/App.js`, `src/app/` |
| 3 | Авторизация | Client-only gate, session, crypto, workspace | `src/auth/` |
| 4 | Корзина | Envelope v3, localStorage, multi-tab sync | `src/cart/` |
| 5 | Reconciliation | Сверка строк корзины с актуальным каталогом | `src/cart/CartReconciliationHost.jsx`, `cartUtils.js` |
| 6 | Catalog Sync | Version gate, validation, lock, channel, host | `src/services/catalogSync/` |
| 7 | IndexedDB | Схема, транзакции, queries, facets, active store | `src/services/catalogIdb/` |
| 8 | Поиск шин и дисков | Формы, mapping фильтров, пагинация результатов | `src/components/*SearchParameters/`, `src/catalog/search/` |
| 9 | Showcase | Кандидаты, scoring, seeded shuffle | `src/catalog/showcase/`, UI в `CatalogShowcase` |
| 10 | Поставщики и transformers | Пять upstream-форматов → единая модель | `src/services/suppliers/`, cloud `transforms.js` |
| 11 | Yandex Functions | Snapshot pipeline и supplier proxy | `yandex/catalog-sync/`, `yandex/supplier-proxy/` |
| 12 | Общий UI | Карточки, модалки, цена, shell | `src/components/shared/`, Header/Footer |
| 13 | Тесты и эксплуатация | Jest, CI, deploy scripts, appLog | `src/**/*.test.*`, `.github/`, `scripts/` |

## Что внутри границы, а что снаружи

### Frontend SPA

**Внутри:** React UI, client auth, корзина, IndexedDB, autosync-клиент.  
**Снаружи:** сборка snapshot, Timer, Object Storage, upstream API поставщиков.

### Cloud catalog-sync

**Внутри:** fetch поставщиков, transformers, команды snapshot, запись в bucket.  
**Снаружи:** React Context, localStorage, UI-guards.

### Supplier proxy

**Внутри:** allowlist хостов, SSRF-защита, CORS, метрики load.  
**Снаружи:** нормализация каталога и бизнес-правила корзины.

## Ожидаемое направление зависимостей

```text
UI components
  → app / auth / cart / catalog domain
    → services (IndexedDB, sync)
      → utils / config

Cloud catalog-sync
  → transformers из src/services/suppliers
  → Object Storage
```

Подробная карта импортов: [Карта зависимостей](/02-architecture/dependency-map).

## Реальные пересечения границ

Эти факты подтверждены кодом; их не нужно «прятать» в документации.

| Пересечение | Почему возникает | Риск |
| --- | --- | --- |
| `CatalogSyncHost.jsx` лежит в `services/`, но является React-компонентом и читает `app/` + `auth/` | Host удобно держать рядом с sync-сервисом | Слой services перестаёт быть «без UI» |
| `catalog/showcase` → IndexedDB, а `catalogIdbQueries` → `catalog/core` | Domain читает persistence; persistence использует domain helpers | Цикл `catalog ↔ services` |
| `catalog/core/resolveCatalogModel.js` → `services/suppliers/shared/deriveModel.js` | Общая логика модели живёт рядом с supplier utils | Domain зависит от supplier-слоя |
| `auth/useLogout.js` ↔ `cart/CartContext` | Logout должен flush/detach корзину | Жёсткая связность двух контекстов |
| Cloud `transforms.js` реэкспортирует frontend transformers | DRY: одна нормализация для server и client code | Cloud зависит от путей `src/` |

## Active, legacy и unused

| Роль | Пример | Как относиться |
| --- | --- | --- |
| **Active** | `CatalogSyncHost`, `catalogIdbSession`, auth/cart contexts | Основной runtime |
| **Legacy, но живой** | Миграция старых ключей корзины/auth, закрытые Gateway-маршруты 403 | Нужны для совместимости |
| **Unused в runtime UI** | `supplierOrchestrator.js` | Не считать текущим путём каталога |
| **Active** | Demo `/demo*` + frozen snapshot | `DemoCatalogHost`, [ADR-009](/adr/009-demo-url-frozen-snapshot) |

## Client-only auth как граница

Авторизация защищает **маршруты и UI** в SPA (`RequireAuth`, `BasketGuard`, `canUseApp`). Она **не** является серверной границей безопасности для Object Storage и Gateway.

Следствие: знание публичного URL Gateway позволяет читать meta/snapshot независимо от логина в SPA. Это текущее ограничение, а не недосмотр документации.

## Исходные файлы для проверки границ

- `src/App.js` — сборка providers и hosts
- `src/app/AppShellContext.jsx` — shell state + подписка на catalog channel
- `src/auth/AuthContext.jsx`, `src/auth/useLogout.js`
- `src/cart/CartContext.jsx`, `src/cart/CartReconciliationHost.jsx`
- `src/services/catalogSync/CatalogSyncHost.jsx`
- `src/services/catalogIdb/catalogIdbSession.js`
- `src/catalog/showcase/getCatalogShowcase.js`
- `yandex/catalog-sync/src/suppliers/transforms.js`
- `src/services/suppliers/supplierOrchestrator.js`

## Фактическое поведение

- Тринадцать подсистем соответствуют реальному разбиению кода, а не желаемой целевой схеме.
- Основной browser runtime не опрашивает пять API поставщиков для каталога.
- Отсутствие прикладного backend — принятая модель, а не временный баг.

## Неизвестно

- Будут ли Host-компоненты когда-либо перенесены из `services/` в `app/` или отдельный слой.
- Планируется ли разрыв цикла `catalog ↔ services` отдельным рефакторингом.

Пока в коде нет такого изменения — это **не** документируется как существующая архитектура.

## Связанные страницы

- Назад: [Системный контекст](/02-architecture/system-context)
- Далее: [Структура директорий](/02-architecture/repository-layout)
- [Frontend-слои](/02-architecture/frontend-layers)
- [Карта зависимостей](/02-architecture/dependency-map)
- [Ограничения и не-цели](/00-overview/constraints-and-non-goals)
- [Дерево провайдеров](/02-architecture/frontend-provider-tree)
