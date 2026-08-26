# Структура директорий

::: tip Статус: проверено по коду
Карта репозитория сверена с фактическим деревом исходников. Сгенерированные каталоги отделены от source.
:::

## Назначение

Помочь новичку понять, **куда смотреть** при задаче: UI, auth, sync, cloud или документация. Страница объясняет смысл верхних директорий, а не перечисляет каждый файл.

## Простыми словами

Репозиторий — это одна «коробка» с тремя рабочими зонами:

1. **`src/`** — то, что видит пользователь в браузере;
2. **`yandex/`** — то, что крутится в облаке по расписанию;
3. **`docs/`** — учебник для разработчика.

Рядом лежат скрипты сборки, CI и шаблоны env. Каталоги вроде `build/` и `docs/.vitepress/dist/` появляются после команд и **не являются** исходниками.

## Верхний уровень

| Путь | Роль | Тип |
| --- | --- | --- |
| `src/` | Frontend SPA | Runtime source |
| `public/` | HTML-оболочка CRA | Runtime source |
| `yandex/catalog-sync/` | Cloud Function сборки snapshot | Runtime source |
| `yandex/supplier-proxy/` | Cloud Function CORS-прокси + `apigw.yaml` | Runtime source |
| `docs/` | VitePress учебник | Docs source |
| `scripts/` | Generate auth verifier, audit-утилиты | Build / tooling |
| `.github/workflows/` | CI тестов frontend | Test |
| `presentation/` | Оффлайн HTML-презентация | Static, вне npm build |
| `package.json` | Скрипты и зависимости SPA/docs | Build |
| `.env.example` | Шаблон переменных без секретов | Config template |

## Карта `src/`

```text
src/
├── index.js          Точка входа: Ant Design, тема
├── App.js            Router, providers, dual-mount, guards
├── setupProxy.js     Dev-only прокси /api/* → поставщики
├── setupTests.js     Полифиллы Jest
├── app/              Маршруты, AppShell, режим приложения
├── auth/             Вход, session, crypto, workspace
├── cart/             Корзина, sync вкладок, reconciliation
├── catalog/          Domain: search mapping, showcase, core
├── components/       UI страницы и shared-компоненты
├── config/           site.js — контакты и nav
├── icons/            SVG и статичные изображения
├── services/         IndexedDB, sync, demo catalog, supplier adapters
├── theme/            appearance (светлая/тёмная)
└── utils/            fetchSupplier, appLog
```

### Зачем такое разбиение

| Директория | Зачем выделена |
| --- | --- |
| `app/` | Оболочка приложения: куда ведут URL и какой режим UI |
| `auth/` | Всё, что связано с «кто вошёл» и `storeId` |
| `cart/` | Локальная корзина, независимая от IndexedDB каталога |
| `catalog/` | Чистая(относительно) доменная логика без JSX страниц |
| `components/` | То, что рисуется на экране |
| `services/` | Инфраструктура: сеть, IDB, sync, demo snapshot, adapters |

Facade `src/services/indexedDBService.js` — это **re-export**, а не основная реализация. Логика живёт в `src/services/catalogIdb/`.

## Карта `yandex/`

```text
yandex/
├── catalog-sync/
│   ├── src/handler.js      Вход Cloud Function
│   ├── src/runSync.js      Оркестрация sync
│   ├── src/storage.js      Object Storage
│   ├── src/snapshotCommands.js
│   ├── src/suppliers/      loadAll, fetch, transforms
│   ├── package.json        Отдельный Node-пакет + esbuild
│   └── deploy.ps1 / verify.ps1
└── supplier-proxy/
    ├── index.js            CORS-прокси
    ├── apigw.yaml          Спецификация API Gateway
    └── deploy.ps1 / verify.ps1
```

Cloud Function `catalog-sync` **намеренно** импортирует transformers из `src/services/suppliers/*/transformers.js`, чтобы server и frontend-код нормализации не расходились.

## Source vs generated

| Generated | Как появляется | Gitignore |
| --- | --- | --- |
| `build/` | `npm run build` | да |
| `coverage/` | Jest coverage | да |
| `docs/.vitepress/dist/` | `npm run docs:build` | да |
| `docs/.vitepress/cache/` | VitePress | да |
| `yandex/catalog-sync/dist/` | esbuild в subpackage | да |
| `.env.*.local` | `prestart` / `prebuild` | да |
| `node_modules/` | `npm ci` | да |

Редактировать нужно source-файлы. Generated-каталоги не являются источником истины для архитектуры.

## Документация `docs/`

| Путь | Смысл |
| --- | --- |
| `docs/00-overview/` | Обзор, сценарии, глоссарий |
| `docs/01-getting-started/` | Установка и конфигурация |
| `docs/02-architecture/` | Архитектурное ядро (эта страница здесь) |
| `docs/03`–`12` | Детальные модульные разделы |
| `docs/documentation-plan.md` | План покрытия |
| `docs/documentation-status.md` | Статусы этапов |
| `docs/.vitepress/config.mjs` | Sidebar, поиск, Mermaid |

## Тесты и CI

- Frontend-тесты лежат рядом с кодом: `src/**/*.test.js(x)`.
- Cloud-тест snapshot-команд: `yandex/catalog-sync/src/snapshotCommands.test.js`.
- GitHub Actions (`.github/workflows/test.yml`) запускает **только** корневой `npm run test:ci`. Тесты `catalog-sync` в CI пока не подключены.

## Фактическое поведение

- Проект на JavaScript/JSX; `tsconfig` / `jsconfig` отсутствуют.
- Два package manifests: корневой SPA/docs и `yandex/catalog-sync/package.json` (не npm workspaces).
- `presentation/` не входит в `npm run build` приложения.

## Планируется

- Наполнение модульных страниц `03`–`12` и ADR — по плану документации.
- Demo-режим и дополнительные разделы сайта — stubs в коде, не отдельные директории.

## Неизвестно

- Полный состав production Object Storage вне ключей `stores/{storeId}/...`, описанных в коде.
- Локальные неотслеживаемые артефакты разработчика вне `.gitignore` не считаются частью архитектуры.

## Связанные страницы

- Назад: [Архитектурные границы](/02-architecture/architectural-boundaries)
- Далее: [Frontend-слои](/02-architecture/frontend-layers)
- [Обзор проекта](/00-overview/project-overview)
- [Установка и команды](/01-getting-started/install-and-scripts)
- [Карта зависимостей](/02-architecture/dependency-map)
