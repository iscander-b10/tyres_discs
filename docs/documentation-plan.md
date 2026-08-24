# Проверенный план документации Ivanor

> Источник: итог этапа 1 «Ivanor — этап 1 — план документации», затем выборочная перепроверка по текущему рабочему дереву 24 августа 2026 года. Этот файл — источник истины для следующих этапов. Он описывает план учебника, а не выдаёт все запланированные страницы за завершённые.

## 1. Цель

Создать подробный локальный русскоязычный учебник по фактическому коду Ivanor. Учебник должен проводить читателя от границ системы и пользовательских сценариев к конкретным React-компонентам, Context, hooks, сервисам, функциям, данным, тестам и архитектурным решениям.

Документация не заменяет код и тесты. Она объясняет:

- кто владеет состоянием;
- как данные движутся между Yandex Cloud, snapshot, IndexedDB, Context и UI;
- какие контракты считаются устойчивыми;
- где выполняются side effects;
- как обрабатываются ошибки и асинхронные гонки;
- какие части активны, являются legacy-путями или не используются текущим runtime.

## 2. Целевая аудитория

- начинающий frontend-разработчик, знакомый с базовыми React и JavaScript;
- автор проекта, которому нужно восстановить причинно-следственные связи между файлами;
- разработчик, изменяющий поиск, каталог, авторизацию или корзину;
- ревьюер, которому нужна карта контрактов и тестового покрытия.

Читатель не обязан заранее понимать IndexedDB, Web Crypto, BroadcastChannel, Web Locks, serverless-функции или snapshot-протокол.

## 3. Принципы учебного изложения и точности

1. Начинать с пользовательской задачи и простого объяснения, затем переходить к реализации.
2. Показывать границы модуля, владельца состояния и направление зависимостей.
3. Каждое существенное утверждение проверять по текущему коду.
4. Использовать тесты для подтверждения контрактов, но не считать тест с локальной копией алгоритма доказательством production-поведения.
5. Не считать README единственным источником истины.
6. Предположения помечать словом **«Предположение»**.
7. Будущие изменения помечать словом **«Планируется»**.
8. Явно различать active, legacy и неиспользуемый код.
9. Client-only auth считать осознанным текущим ограничением, а не полноценной серверной границей безопасности.
10. Отсутствие прикладного backend не считать ошибкой архитектуры.
11. Не документировать секреты и реальные значения env.
12. Названия сущностей и пути должны совпадать с кодом.
13. Одна концепция имеет одно основное место описания; повторения заменяются ссылками.
14. Номера строк можно приводить как подсказку, но не использовать как единственную ссылку.
15. Mermaid добавлять только там, где связи, последовательность или состояния понятнее изображения.

Запрещено ограничиваться фразой «`searchTires` выполняет поиск шин». Нужно объяснить фильтры, нормализацию, выбор индекса, постфильтрацию, результат, крайние случаи и вызывающие стороны.

## 4. Фактическая карта и подсистемы

### 4.1 Сквозной путь каталога

```text
Yandex Timer
→ yandex/catalog-sync
→ API поставщиков
→ transformers
→ snapshot.json и meta.json в Object Storage
→ API Gateway
→ CatalogSyncHost
→ validation и version gate
→ атомарная транзакция IndexedDB
→ AppShellContext
→ поиск, showcase и reconciliation корзины
```

### 4.2 React-дерево

```text
src/index.js
└─ Ant Design ConfigProvider + App
   └─ BrowserRouter
      └─ AuthProvider
         └─ AppShellProvider
            └─ CartProvider
               ├─ CatalogSyncHost
               ├─ CartReconciliationHost
               └─ маршруты и AppFrame
```

### 4.3 Владельцы состояния

- внешний вид — корневой компонент в `src/index.js` и localStorage;
- авторизация и workspace — `src/auth/AuthContext.jsx`;
- режим интерфейса и версии каталога — `src/app/AppShellContext.jsx`;
- корзина — `src/cart/CartContext.jsx` и localStorage;
- каталог — IndexedDB, изолированная по `storeId`;
- формы, options, loading, error и результаты поиска — поисковые компоненты;
- облачная версия каталога — snapshot и meta в Object Storage.

### 4.4 Подсистемы и границы

1. **Запуск и тема** — CRA bootstrap, Ant Design, локаль и appearance.
2. **Маршрутизация и AppShell** — guards, login-modal, layout и две keep-alive панели каталога.
3. **Авторизация** — client-only gate, session, Web Crypto, fingerprint, workspace, restore и logout.
4. **Корзина** — local-first envelope v3, namespace account/store, синхронизация вкладок и миграция.
5. **Reconciliation** — сверка строк корзины с новым каталогом.
6. **Catalog Sync** — version gate, snapshot validation, расписание проверок, lock и channel.
7. **IndexedDB** — схема, транзакционное применение snapshot, чтение, фильтры, facets и сессия.
8. **Поиск шин и дисков** — Ant Design Form, mapping, facets, запрос и пагинация.
9. **Showcase** — кандидаты, сезонность, Ikon, scoring, seeded shuffle и cache.
10. **Поставщики и transformers** — пять upstream-форматов и общая модель товара.
11. **Yandex Functions** — создание snapshot и supplier proxy.
12. **Общий UI** — карточки, модальные окна, цена, количество, пагинация, shell и тема.
13. **Тесты и эксплуатация** — Jest, Testing Library, fake-indexeddb, cloud tests и диагностика.

Обычный браузерный runtime не опрашивает пять API поставщиков: он читает готовый snapshot. `src/services/suppliers/supplierOrchestrator.js` — сохранённый frontend/manual путь, который не входит в текущую основную цепочку.

## 5. Планируемое дерево страниц

```text
docs/
├── index.md
├── documentation-plan.md
├── documentation-status.md
├── page-template.md
├── 00-overview/
│   ├── product-and-users.md
│   ├── constraints-and-non-goals.md
│   └── glossary.md
├── 01-getting-started/
│   ├── install-and-scripts.md
│   ├── configuration.md
│   └── dev-production-deploy.md
├── 02-architecture/
│   ├── system-context.md
│   ├── frontend-provider-tree.md
│   └── end-to-end-data-flow.md
├── 03-routing-shell/
│   ├── routes-and-login-modal.md
│   ├── app-shell-state.md
│   └── dual-mount-catalog.md
├── 04-auth/
│   ├── client-auth-model.md
│   ├── session-crypto-workspace.md
│   └── races-and-logout.md
├── 05-catalog-storage/
│   ├── indexeddb-schema.md
│   ├── queries-filters-facets.md
│   └── lifecycle-and-migration.md
├── 06-catalog-sync/
│   ├── frontend-autosync.md
│   ├── snapshot-protocol-validation.md
│   ├── locks-and-channels.md
│   └── yandex-catalog-sync.md
├── 07-suppliers/
│   ├── supplier-adapters.md
│   ├── transformers.md
│   └── supplier-proxy.md
├── 08-search-showcase/
│   ├── tire-and-disc-search.md
│   ├── async-race-guards.md
│   └── showcase-selection.md
├── 09-cart/
│   ├── cart-domain-and-storage.md
│   ├── migration-and-multitab.md
│   └── catalog-reconciliation.md
├── 10-ui/
│   ├── catalog-components.md
│   ├── basket-and-client-mode.md
│   └── theme-and-shell-components.md
├── 11-testing/
│   ├── test-strategy.md
│   └── contract-catalog.md
├── 12-operations/
│   ├── github-pages.md
│   ├── yandex-runbook.md
│   └── logging-and-diagnostics.md
└── adr/
    └── index.md
```

## 6. Назначение групп страниц и связанные исходники

### Обзор

- `product-and-users` — продукт, роли и пользовательский путь; `LandingPage`, `config/site.js`, README.
- `constraints-and-non-goals` — client-only auth, локальная корзина, serverless-граница и отсутствующие возможности; `appMode.js`, auth, cart.
- `glossary` — единые определения domain-терминов; все основные подсистемы.

### Начало работы

- `install-and-scripts` — install/start/build/test/deploy/docs и pre-hooks; `package.json`, auth generator.
- `configuration` — группы env без значений, приоритеты и область действия; `.env.example`, workspace, sync и proxy.
- `dev-production-deploy` — dev proxy, API Gateway, Object Storage и GitHub Pages; `setupProxy.js`, `fetchSupplier.js`, scripts.

### Архитектура и shell

- `system-context` — Browser, GitHub Pages, Yandex и поставщики; Yandex configs и root app.
- `frontend-provider-tree` — порядок providers и причины зависимостей; `index.js`, `App.js`, Context.
- `end-to-end-data-flow` — поставщик → snapshot → IDB → UI → cart.
- `routes-and-login-modal` — матрица маршрутов, guards и безопасный redirect; `App.js`, `paths.js`, routing tests.
- `app-shell-state` — каждое поле Context и владелец состояния; `AppShellContext.jsx`.
- `dual-mount-catalog` — `hidden`, `inert`, reset и catch-up; `App.js`, оба SearchParameters и dual-mount tests.

### Авторизация

- `client-auth-model` — фактическая граница client-only gate; generator, LoginPage, session.
- `session-crypto-workspace` — HMAC, AES-GCM, fingerprint, accountId и store mapping.
- `races-and-logout` — generation guards, restore race и flush/detach/invalidate/logout.

### IndexedDB и синхронизация

- `indexeddb-schema` — имя базы, stores, indexes и metadata.
- `queries-filters-facets` — equality index hint, cursor, JS post-filter и каскадные facets.
- `lifecycle-and-migration` — active store, generation, close и legacy database migration.
- `frontend-autosync` — start/visible/online/scheduled triggers, статусы и version gate.
- `snapshot-protocol-validation` — wire schema, команды, fatal/warning и normalization.
- `locks-and-channels` — Web Locks, lease, BroadcastChannel и storage fallback.
- `yandex-catalog-sync` — Timer, upstream, partial success, storage keys и handler.

### Поставщики, поиск и showcase

- `supplier-adapters` — контракт и различия пяти поставщиков.
- `transformers` — raw JSON/XML/XLSX → unified tyres/discs.
- `supplier-proxy` — `/v2` routes, direct integration, proxy, redirects и SSRF-защита.
- `tire-and-disc-search` — поля форм, mapping, facets, IDB и семантика результатов.
- `async-race-guards` — request id, workspace key, mounted ref и stale-while-revalidate.
- `showcase-selection` — cache, candidates, scoring, сезон, Ikon и seeded order.

### Корзина, UI, тесты и эксплуатация

- `cart-domain-and-storage` — cart line, sellability, envelope v3, namespace и mutations.
- `migration-and-multitab` — legacy migration, revision conflicts и вкладки.
- `catalog-reconciliation` — read-before-add и обновление после snapshot.
- `catalog-components` — Card, Modal, AddToCart, PriceStrip, PromoBadges и pagination.
- `basket-and-client-mode` — BasketPage, totals и B2B/client visibility.
- `theme-and-shell-components` — appearance, ConfigProvider, Header, Footer и Tooltip.
- `test-strategy` — инструменты, mocks, fake-indexeddb и CI.
- `contract-catalog` — трассировка инвариантов к тестам.
- `github-pages` — homepage, basename, `404.html` и `.nojekyll` основного приложения.
- `yandex-runbook` — безопасная эксплуатация Function, Timer, bucket и Gateway.
- `logging-and-diagnostics` — appLog codes, sanitization и cloud logs.
- `adr/index` — индекс решений, альтернатив и последствий.

## 7. Необходимые Mermaid-диаграммы

1. Путь обучения: контекст → поток → подсистема → модуль → функция.
2. C4-подобный контекст Browser/GitHub Pages/Yandex/Suppliers.
3. Дерево React providers.
4. Сквозной data-flow от поставщика к корзине.
5. Автомат маршрутов и login-modal.
6. Карта владения состоянием.
7. Lifecycle двух смонтированных каталогов.
8. Login, restore race и logout sequence.
9. Схема IndexedDB и транзакция применения snapshot.
10. Query pipeline: форма → index hint → cursor → post-filter.
11. Frontend autosync sequence и расписание.
12. Автомат команд `replace` / `keepPrevious` / `purge`.
13. Координация нескольких вкладок lock/channel.
14. Cloud pipeline создания snapshot.
15. Mapping-потоки поставщиков.
16. Дерево маршрутизации supplier-proxy.
17. Async race timelines поиска и reconciliation.
18. Воронки выбора showcase для шин и дисков.
19. Автомат корзины, миграция и multi-tab sequence.
20. Reconciliation sequence.
21. Композиция shared UI.
22. Traceability graph «подсистема → контракт → тест».
23. Deployment topology и error propagation.

## 8. Матрица покрытия

| Подсистема | Основные страницы |
| --- | --- |
| Bootstrap и тема | `install-and-scripts`, `frontend-provider-tree`, `theme-and-shell-components`, `github-pages` |
| Routing и AppShell | `routes-and-login-modal`, `app-shell-state`, `dual-mount-catalog` |
| Auth/session/crypto/workspace/logout | `client-auth-model`, `session-crypto-workspace`, `races-and-logout` |
| IndexedDB | `indexeddb-schema`, `queries-filters-facets`, `lifecycle-and-migration` |
| Catalog Sync и snapshot | `frontend-autosync`, `snapshot-protocol-validation`, `locks-and-channels`, `yandex-catalog-sync` |
| Search | `tire-and-disc-search`, `async-race-guards`, `queries-filters-facets` |
| Showcase/scoring | `showcase-selection`, `catalog-components`, `contract-catalog` |
| Cart/migration/reconciliation | `cart-domain-and-storage`, `migration-and-multitab`, `catalog-reconciliation` |
| Suppliers/transformers | `supplier-adapters`, `transformers`, `yandex-catalog-sync` |
| Proxy/API Gateway | `supplier-proxy`, `dev-production-deploy`, `yandex-runbook` |
| Shared UI | `catalog-components`, `basket-and-client-mode`, `theme-and-shell-components` |
| Tests и diagnostics | `test-strategy`, `contract-catalog`, `logging-and-diagnostics` |
| Архитектурные решения | `constraints-and-non-goals`, `adr/index` |

## 9. Важные компоненты

Приоритет P0:

- `App`, `AppRoutes`, `AppFrame`, `WorkspaceHosts`;
- `AuthProvider`, `AppShellProvider`, `CartProvider`;
- `CatalogSyncHost`, `CartReconciliationHost`;
- `TiresSearchParameters`, `DiscsSearchParameters`;
- `CatalogShowcase`;
- `AddToCartControl`;
- `BasketPage`.

Приоритет P1:

- `LoginPage`, `LegacyCartMigrationModal`;
- `CatalogItemCard`, `CatalogItemModalWindow`;
- `CartQtyControls`, `CatalogPriceStrip`, `CatalogItemPromoBadges`;
- `PaginatedCardsList`, `ShowcaseShelf`, `ShowcaseSizeChips`;
- `SupplierFilterSelect`, `HoverTooltip`;
- `SiteHeader`, `SiteFooter`, `ModeToggle`, `ThemeSwitch`.

Для React-компонента обязательны props, Context, hooks, локальное состояние, эффекты, handlers, условия рендеринга, loading/empty/error states и используемые компоненты Ant Design.

## 10. Важные сервисы

- auth: session, crypto, fingerprint, workspace и logout coordination;
- cart: storage, sync, migration, reconciliation и domain utils;
- catalog sync: service, validation, lock, channel и host;
- catalog IDB: schema, session, queries, filters, facets и validation;
- showcase: facade, builders, scoring, season selection и seed;
- supplier adapters и общие transformers;
- Yandex `catalog-sync` и `supplier-proxy`;
- structured logging через `appLog`.

## 11. Функции для подробного объяснения

P0:

- `signIn`, `login`, `restore`, `logout`;
- `createWorkspace`, `resolveStoreId`;
- операции `CartContext` и внутренний commit корзины;
- `reconcileCartItems`, `readCartCatalogItems`;
- `checkAndSyncCatalog`, frontend и IDB-варианты `applyCatalogSnapshot`;
- `validateAndNormalizeCatalogSnapshot`;
- `CatalogIdbSession` и его lifecycle;
- `searchTires`, `searchDiscs`;
- mapping-функции `searchFormFilters`;
- `getCatalogShowcase`, `buildTireShowcase`, `buildDiscShowcase`, `pickMixedSeasonHits`;
- обработчики `AddToCartControl`.

P1:

- `withCatalogSyncLock`;
- `postCatalogApplied`, `subscribeCatalogApplied`;
- выбор equality index и facet collectors;
- `createCartSync` и legacy migration API;
- supplier adapter contract;
- `buildSnapshotSuppliers`, `resolveCategoryCommand`;
- handlers обеих Yandex Cloud Functions.

Для функции обязательно указать сигнатуру, параметры, результат, async/sync, pure/side effect, подробный алгоритм, пример входа/выхода и вызывающие стороны.

## 12. Пользовательские сценарии

1. Первый запуск гостем и открытие landing.
2. Переход на защищённый URL, вход и безопасный возврат.
3. Восстановление локальной сессии.
4. Смена workspace/store и инвалидирование старых async-операций.
5. Выход с сохранением корзины.
6. Автоматическая проверка новой версии каталога при старте.
7. Проверка по расписанию, при возвращении вкладки и восстановлении сети.
8. Одновременная синхронизация каталога в нескольких вкладках.
9. Поиск шин с каскадными filters/facets.
10. Поиск дисков и различие route `/wheels` и domain `discs`.
11. Пустой результат, ошибка и сохранение stale result.
12. Просмотр showcase до первого поиска.
13. Добавление актуального товара в корзину.
14. Изменение количества и удаление строки.
15. Межвкладочное обновление корзины.
16. Миграция legacy-корзины.
17. Reconciliation после нового snapshot.
18. Частичный сбой поставщика с `keepPrevious`.
19. Переключение режима клиента/менеджера и темы.
20. Диагностика ошибки по безопасному коду `appLog`.

## 13. Планируемые ADR

1. CRA и GitHub Pages как платформа SPA.
2. Client-only auth с build-time HMAC verifier.
3. Wrapped password для восстановления сессии.
4. Workspace и `storeId` как единица изоляции.
5. Отдельная IndexedDB для каждого `storeId`.
6. Cloud snapshot вместо опроса поставщиков браузером.
7. Общие transformers между frontend-кодовой базой и Cloud Function.
8. Команды snapshot: `replace`, `keepPrevious`, `purge`.
9. Пустой upstream не означает purge.
10. Атомарное применение snapshot одной IDB-транзакцией.
11. Web Locks и fallback lease.
12. BroadcastChannel и storage fallback.
13. Dual-mount поисковых панелей.
14. Envelope v3 корзины по account/store.
15. Read-before-add и fail-safe reconciliation.
16. Сохранение корзины при logout.
17. Seeded showcase, связанный с snapshot version.
18. Разные алгоритмы showcase шин и дисков.
19. Login как query-modal.
20. Structured console logging без обязательного UI-toast.
21. Закрытие legacy gateway routes ответом 403.
22. Два proxy-пути для малых и больших upstream-ответов.

Отдельный ADR создаётся только после повторной проверки решения и альтернатив. Пока этот список означает **«Планируется»**.

## 14. Обнаруженные противоречия

1. README упоминает `yandex/saas-api/`, которого нет в рабочем дереве.
2. README почти не описывает auth, workspace, cart и reconciliation.
3. `src/services/indexedDBService.js` — facade/re-export, а не основная реализация хранилища.
4. Supplier-документация содержит следы прежнего ручного frontend-пути.
5. `supplierOrchestrator` существует, но не входит в основной runtime.
6. Метрики frontend supplier load остаются без текущих UI-потребителей.
7. Текст ошибки showcase может предлагать повторную ручную загрузку, хотя основной поток автоматический.
8. README может создать впечатление, что браузер загружает данные пяти поставщиков.
9. Примеры bucket в документации и gateway config требуют дополнительной проверки согласованности.
10. README не объясняет multi-store и store mapping.
11. Проверки frontend выполняются позже cloud slots; это почти не объяснено.
12. URL `/wheels` и domain-категория `discs` используют разные термины.
13. Локальная версия каталога и metadata IndexedDB имеют разные роли.
14. Legacy save API остаётся публичным, но не является основным production-путём.
15. `catalogRevalidation.test.js` проверяет локально объявленный алгоритм.
16. Нет прямых fixture/golden tests transformers.
17. У `supplier-proxy` нет unit tests.
18. Тесты `yandex/catalog-sync` не входят в корневой frontend workflow.
19. Сохраняются deprecated routing helpers.

Противоречие не означает автоматическую ошибку приложения. Его нужно объяснить и, при необходимости, вынести в отдельную задачу вне документационного этапа.

## 15. Неизвестные или неподтверждённые сведения

Без внешних данных нельзя утверждать:

- реальные production URL, account/store mapping и env-значения;
- фактические IAM-роли, WAF и rate limiting;
- полные upstream-схемы и гарантии полей поставщиков;
- SLA, latency и допустимый размер snapshot;
- реальные квоты IndexedDB на целевых устройствах;
- бизнес-причины коэффициентов маржи;
- правила формирования Ikon whitelist;
- желаемый UX при массовом удалении строк корзины;
- обязательность равенства `meta.version` и `snapshot.version`;
- использование legacy supplier loader в других ветках;
- назначение отсутствующего `saas-api`;
- соответствие локального рабочего дерева фактическому production deploy.

## 16. Порядок следующих этапов

1. Основы: продукт, ограничения, словарь.
2. Контекст системы, providers и сквозной поток данных.
3. Установка, конфигурация и различия окружений.
4. Routing и AppShell.
5. Auth, session, workspace, races и logout.
6. IndexedDB: schema, lifecycle, queries и facets.
7. Snapshot protocol, frontend sync, locks и channels.
8. Yandex catalog-sync, adapters, transformers и supplier-proxy.
9. Search, async race guards и dual-mount.
10. Showcase.
11. Cart, migration, multi-tab и reconciliation.
12. Общие UI-компоненты.
13. Test strategy и contract catalog.
14. Operations и diagnostics.
15. ADR после проверки альтернатив.
16. Финальная редактура главной, навигации, ссылок и словаря.

Сквозные истории для обучения: **«вход и workspace»**, **«поставщик → snapshot → IndexedDB»**, **«форма → запрос → showcase»**, **«каталог → корзина → reconciliation»**.

## 17. Критерий готовности страницы

Страница считается завершённой, когда:

- применён [единый шаблон](/page-template);
- ключевые утверждения повторно проверены по текущему коду;
- пути и exports актуальны;
- тесты связаны с конкретными контрактами;
- active, legacy и планы разделены;
- внутренняя навигация и Mermaid проверены сборкой;
- статус обновлён в [журнале документации](/documentation-status).
