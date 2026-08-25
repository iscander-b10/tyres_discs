# Компоненты

::: tip Статус: проверено по коду
Группировка по пользовательским задачам. Подробные props, effects и Ant Design — на [компонентах каталога](/10-ui/catalog-components) и [корзине](/10-ui/basket-and-client-mode).
:::

## 1. Оболочка и навигация

| Компонент | Путь | Назначение | Context / hooks | Учебная страница |
| --- | --- | --- | --- | --- |
| `SiteHeader` | `src/components/SiteHeader/SiteHeader.jsx` | Шапка: nav, корзина, тема, вход | `useAuth`, `useCart`, props `appearance` | [Тема и shell](/10-ui/theme-and-shell-components) |
| `SiteFooter` | `src/components/SiteFooter/SiteFooter.jsx` | Подвал, телефон, вход | `useAuth` | [Тема и shell](/10-ui/theme-and-shell-components) |
| `LandingPage` | `src/components/LandingPage/LandingPage.jsx` | Маркетинговая главная | — | [Продукт](/00-overview/product-and-users) |
| `ScrollToTop` | `src/components/ScrollToTop/ScrollToTop.jsx` | Сброс scroll при route change | `useLocation` | [Маршруты](/03-routing-shell/routes-and-login-modal) |
| `ModeToggle` | `src/components/ModeToggle/ModeToggle.jsx` | Переключатель менеджер/клиент | `useAppShell` | [Режим клиента](/10-ui/basket-and-client-mode) |
| `ThemeSwitch` | `src/components/shared/ThemeSwitch/ThemeSwitch.jsx` | Светлая/тёмная тема | props `appearance`, `onAppearanceChange` | [Тема](/10-ui/theme-and-shell-components) |

### `SiteHeader`

- **Props:** `appearance: 'light' \| 'dark'`, `onAppearanceChange(next)`.
- **Side effects:** navigate, открытие login query, logout через `useLogout`.
- **Кто вызывает:** `AppFrame` в `App.js`.
- **Тесты:** `SiteHeader.test.jsx` — badge корзины, login link.
- **Страница:** [Тема и shell](/10-ui/theme-and-shell-components).

---

## 2. Авторизация и корзина (страницы)

| Компонент | Путь | Назначение | Учебная страница |
| --- | --- | --- | --- |
| `LoginPage` | `src/components/LoginPage/LoginPage.jsx` | Modal входа, redirect после auth | [Маршруты и вход](/03-routing-shell/routes-and-login-modal) |
| `BasketPage` | `src/components/Basket/BasketPage.jsx` | Список корзины, итоги, client mode | [Корзина UI](/10-ui/basket-and-client-mode) |
| `LegacyCartMigrationModal` | `src/cart/LegacyCartMigrationModal.jsx` | Миграция legacy localStorage | [Миграция](/09-cart/migration-and-multitab) |

### `LoginPage`

```jsx
// default export, props нет — читает query и AuthContext
export default function LoginPage()
```

| Аспект | Описание |
| --- | --- |
| **Назначение** | Ant Design Modal с Form; вызывает `signIn(email, password)`. |
| **Context** | `useAuth`, `useNavigate`, `useLocation`. |
| **Side effects** | navigate на `resolvePostLoginPath` после успеха. |
| **Ошибки** | Неверный пароль → message Ant Design; infra → `appLog`. |
| **Кто вызывает** | Route `/?login=1` в `App.js`. |
| **Тесты** | косвенно через `App.routing.test.jsx`. |
| **Страница** | [Client auth](/04-auth/client-auth-model), [маршруты](/03-routing-shell/routes-and-login-modal). |

---

## 3. Поиск каталога (dual-mount)

| Компонент | Путь | Props | Учебная страница |
| --- | --- | --- | --- |
| `TiresSearchParameters` | `src/components/TiresSearchParameters/TiresSearchParameters.jsx` | `isActive: boolean` | [Поиск шин](/08-search-showcase/tire-and-disc-search) |
| `DiscsSearchParameters` | `src/components/DiscsSearchParameters/DiscsSearchParameters.jsx` | `isActive: boolean` | [Поиск дисков](/08-search-showcase/tire-and-disc-search) |

Обе панели **всегда смонтированы**; неактивная получает `hidden` + `inert`. См. [Две панели](/03-routing-shell/dual-mount-catalog).

### Общий контракт поисковых панелей

| Поле состояния | Владелец | Сброс |
| --- | --- | --- |
| `form`, options, loading/error и `searchResults` | Form + локальный `useState` компонента | remount по `sessionResetKey`; effect reset при смене `workspaceResetKey`; inactive catch-up после catalog update |
| `catalogDataVersion` | `useAppShell` | bump после apply snapshot |
| Race guards | `searchRequestIdRef`, `foregroundRequestIdRef`, `loadRequestIdRef`, `workspaceKeyRef`, `mountedRef` | stale search/facets/workspace/unmount; setup `mountedRef=true` для StrictMode remount; spinner «Найти»; сброс фильтров через `invalidateCatalogSearchRequest` |

**Ключевые вызовы поиска:** `mapTireFormValuesToSearchFilters` /
`mapDiscFormValuesToSearchFilters` → facade
`indexedDBService.searchTires` / `searchDiscs` (реализация делегируется
singleton `catalogIdbSession`). При `searchResults === null` панель рендерит
`CatalogShowcase` (и во время foreground «Найти» — плюс `CatalogSearchStatus`).
Витрина читает тот же RAM-кэш, что поиск.

**Тесты:** `TiresSearchParameters.searchRace.test.jsx`, `DiscsSearchParameters.searchRace.test.jsx`.

**Страницы:** [Async race guards](/08-search-showcase/async-race-guards), [сквозной поток](/08-search-showcase/end-to-end-flow).

---

## 4. Shared UI каталога

| Компонент | Путь | Основные props | Страница |
| --- | --- | --- | --- |
| `CatalogShowcase` | `shared/CatalogShowcase/CatalogShowcase.jsx` | `kind`, `renderCard`, `onChipClick` | [Showcase](/08-search-showcase/showcase-selection) |
| `ShowcaseShelf` | `shared/CatalogShowcase/ShowcaseShelf.jsx` | `title`, `items`, `renderCard`, `skeleton` | [UI каталога](/10-ui/catalog-components) |
| `ShowcaseSizeChips` | `shared/CatalogShowcase/ShowcaseSizeChips.jsx` | `chips`, `onChipClick` | [Showcase](/08-search-showcase/showcase-selection) |
| `CatalogSearchStatus` | `shared/CatalogShowcase/CatalogSearchStatus.jsx` | `loading` | [Поиск](/08-search-showcase/tire-and-disc-search) |
| `CatalogSearchEmptyHint` | `shared/CatalogShowcase/CatalogSearchEmptyHint.jsx` | `kind`, `emptyText` | [UI каталога](/10-ui/catalog-components) |
| `CatalogItemCard` | `shared/CatalogItemCard/CatalogItemCard.jsx` | `item`, `category`, `isClientMode` | [UI каталога](/10-ui/catalog-components) |
| `CatalogItemModalWindow` | `shared/CatalogItemModalWindow/...` | `isOpen`, `item`, `category` | [UI каталога](/10-ui/catalog-components) |
| `CatalogPriceStrip` | `shared/CatalogPriceStrip/...` | `item`, `isClientMode` | [UI каталога](/10-ui/catalog-components) |
| `CatalogItemPromoBadges` | `shared/CatalogItemPromoBadges/...` | `item`, `variant` | [UI каталога](/10-ui/catalog-components) |
| `AddToCartControl` | `shared/AddToCartControl/...` | `item`, `category`, `onGoToCart` | [Корзина](/10-ui/basket-and-client-mode) |
| `CartQtyControls` | `shared/CartQtyControls/...` | `quantity`, `maxStock`, handlers | [Корзина](/10-ui/basket-and-client-mode) |
| `PaginatedCardsList` | `shared/PaginatedCardsList/...` | `items`, `renderCard`, pagination | [UI каталога](/10-ui/catalog-components) |
| `SupplierFilterSelect` | `shared/SupplierFilterSelect.jsx` | `options`, маскировка client mode | [Поиск](/08-search-showcase/tire-and-disc-search) |
| `HoverTooltip` | `shared/HoverTooltip.jsx` | children + Tooltip props | [UI каталога](/10-ui/catalog-components) |

### `AddToCartControl` — ключевой export

```jsx
export default function AddToCartControl({
  item, category, onGoToCart, className, block,
})
```

| Аспект | Описание |
| --- | --- |
| **Назначение** | Read-before-add: сверка с IDB, затем `addItem` / qty controls. |
| **Context** | `useAuth` для workspace и `useCart` для строки/операций. |
| **Async** | `readCartCatalogItems` перед добавлением. |
| **Side effects** | mutate cart localStorage через Context. |
| **Ошибки** | Нет workspace/stock → disabled; stale workspace/read failure → товар не добавляется, failure логируется как `cart.catalog_read_failed`. |
| **Кто вызывает** | `CatalogItemCard`, `CatalogItemModalWindow`. |
| **Страница** | [Reconciliation](/09-cart/catalog-reconciliation), [корзина](/09-cart/cart-domain-and-storage). |

---

## 5. Вспомогательные модули components/

Тривиальные pure-helpers — одна таблица:

| Модуль | Exports | Назначение |
| --- | --- | --- |
| `catalogCopy.js` | `formatPriceDisplay`, `resolveCatalogModel`, … | Форматирование для карточек |
| `catalogSearchSelectProps.js` | `catalogSearchSelectProps`, `useCatalogSelectCloseOnMouseLeave` | Общие props Select |
| `ikonPromoBadges.js` | `resolveIkonPromoBadges`, `IKON_PROMO_LABELS` | Бейджи Ikon |
| `showcaseChips.js` | `getShowcaseStaticChips` | Статические чипы размеров |

**Страница:** [UI каталога](/10-ui/catalog-components).

## Host-компоненты (не UI)

| Компонент | Путь | Назначение | Страница |
| --- | --- | --- | --- |
| `CatalogSyncHost` | `src/services/catalogSync/CatalogSyncHost.jsx` | Таймеры autosync | [Frontend autosync](/06-catalog-sync/frontend-autosync) |
| `CartReconciliationHost` | `src/cart/CartReconciliationHost.jsx` | Reconcile после snapshot | [Reconciliation](/09-cart/catalog-reconciliation) |

Внутри `CartReconciliationHost` две небольшие функции обеспечивают корректный
async retry:

- `createCatalogReferences(items)` отбрасывает строки без id и строит
  `{ requestKey, category, id }` для согласованного IDB-read;
- `getReferencesSignature(references)` сортирует request keys и позволяет после
  `await` обнаружить, что корзина изменилась. В этом случае host повторяет read,
  а не применяет результат к другому набору строк.

## Связанные страницы

- [Справочник: Context и hooks](/13-code-reference/context-and-hooks)
- [Справочник: сервисы](/13-code-reference/services)
- [Добавление компонента](/14-development/add-new-component)
