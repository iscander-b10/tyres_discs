# Утилиты, тема и конфигурация

::: tip Статус: проверено по коду
Вспомогательные модули без бизнес-оркестрации. Не импортируют React и Context.
:::

## utils/

### appLog — `src/utils/appLog.js`

### `appLog.error({ code, domain, message, error, context })`

| | |
| --- | --- |
| **Сигнатура** | `function appLog.error(payload)` |
| **Назначение** | Структурированный console.error с sanitization |
| **Side effects** | `console.error` (dev/prod) |
| **Pure helpers** | `sanitizeLogContext`, `isExpectedOperationalError`, `isQuotaExceededError` |
| **Кто вызывает** | auth, sync, IDB, search, showcase |
| **Тесты** | `appLog.test.js` |
| **Страница** | [Логи и диагностика](/12-operations/logging-and-diagnostics) |

Коды ошибок — стабильный контракт для troubleshooting (например `auth.infra_failed`, `catalog.sync_failed`).

---

### scrollWindowToTop — `src/utils/scrollWindowToTop.js`

| Export | Назначение | Async |
| --- | --- | --- |
| `scrollWindowToTop({ behavior }?)` | `window.scrollTo(top: 0)`; без `behavior` — `smooth`, при `prefers-reduced-motion: reduce` — `auto` | sync |

**Кто вызывает:** `TiresSearchParameters` / `DiscsSearchParameters` (`handleShowcaseChipClick`).

---

### fetchSupplier — `src/utils/fetchSupplier.js`

::: warning Legacy / dev
Используется supplier adapters и dev proxy path, не production autosync.
:::

| Export | Назначение | Async |
| --- | --- | --- |
| `fetchSupplier(url, options)` | HTTP с retry и proxy URL | async |
| `resolveSupplierFetchUrl(path)` | Dev `/api` vs prod gateway | sync |
| `resolvePhotoUrl(url)` | Absolute photo URL | sync |
| `usesCorsProxy()` | Env flag | sync |
| `createCatalogLoadId()` | Metric correlation id | sync |
| `reportCatalogLoadMetric(...)` | Console metric | sync |

**Страницы:** [Supplier proxy](/07-suppliers/supplier-proxy), [Dev deploy](/01-getting-started/dev-production-deploy).

---

## theme/ — `src/theme/appearance.js`

| Export | Назначение | Side effects |
| --- | --- | --- |
| `getInitialAppearance()` | read localStorage / prefers-color-scheme | read storage |
| `applyAppearance(mode)` | CSS class / data attribute на `document` | DOM |
| `runAppearanceTransition(fn)` | Theme switch animation | DOM |
| `getAntdTheme(mode)` | Ant Design theme token object | none |

**Кто вызывает:** `src/index.js`, `SiteHeader`, `ThemeSwitch`. **Страница:** [Тема и shell](/10-ui/theme-and-shell-components).

---

## config/ — `src/config/site.js`

| Export | Назначение |
| --- | --- |
| `SITE_PHONE` | Телефон в footer |
| `SITE_DEVELOPER_TELEGRAM` | Credit link |
| `SITE_PRODUCT_NAV`, `SITE_SERVICE_NAV` | Nav items |
| `SITE_NAV_ITEMS` | Combined nav |

Static constants; без side effects. **Страница:** [Продукт и пользователи](/00-overview/product-and-users).

---

## scripts/ (build-time)

| Скрипт | Назначение |
| --- | --- |
| `scripts/generate-auth-verifier.js` | HMAC verifiers → `.env.*.local` |

Вызывается `prestart` / `prebuild`. **Side effects:** запись env file. **Страница:** [Установка](/01-getting-started/install-and-scripts).

## Связанные страницы

- [Переменные окружения](/01-getting-started/configuration)
- [Troubleshooting](/14-development/troubleshooting)
