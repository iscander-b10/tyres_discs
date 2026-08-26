# Маршруты, layout и окно входа

::: tip Статус: проверено по коду
Маршруты, guards, redirect helpers, login modal, layout и тестовые контракты сверены с текущей реализацией.
:::

## Модель маршрутизации

Ivanor использует `BrowserRouter` из React Router 6. URL определяет логическую страницу, но `AppFrame` не отдаёт каталог через `<Outlet />`. Шины, диски и корзина монтируются внутри общей оболочки и переключаются через `hidden`/`inert`. Вложенные route elements выполняют guards и redirects; визуальный выбор делает `pageFromPathname(location.pathname)`.

Login реализован как query-modal `/?login=1`, а не как отдельный полноэкранный route. Legacy URL `/login` сразу нормализуется в этот query.

## Исходники

- [`src/App.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/App.js)
- [`src/app/paths.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/app/paths.js)
- [`src/app/appMode.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/app/appMode.js)
- [`src/components/LoginPage/LoginPage.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/components/LoginPage/LoginPage.jsx)
- [`src/components/SiteHeader/SiteHeader.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/components/SiteHeader/SiteHeader.jsx)
- [`src/components/SiteFooter/SiteFooter.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/components/SiteFooter/SiteFooter.jsx)
- [`src/components/ScrollToTop/ScrollToTop.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/components/ScrollToTop/ScrollToTop.jsx)

## Таблица маршрутов

| URL после `basename` | Route element | Guest | Авторизованный | Визуальный результат |
| --- | --- | --- | --- | --- |
| `/` | `HomeRoute` | остаётся на `/` | `replace` → `/tyres` | landing для guest |
| `/?login=1` | `HomeRoute` + query logic | остаётся; modal открыт | `replace` → `/tyres` | landing под login modal для guest |
| `/demo` | redirect | `replace` → `/demo/tyres` | то же | каталог шин (демо) |
| `/demo/tyres` | без auth guard | остаётся | остаётся (demo-workspace) | панель шин, frozen snapshot |
| `/demo/wheels` | без auth guard | остаётся | остаётся | панель дисков |
| `/demo/basket` | без auth guard | остаётся | остаётся | корзина namespace `demo` |
| `/tyres` | `RequireAuth` | `replace` → `/?login=1`, state.from=`/tyres` | остаётся | панель шин |
| `/wheels` | `RequireAuth` | `replace` → `/?login=1`, state.from=`/wheels` | остаётся | панель дисков |
| `/basket` | `BasketGuard` | `replace` → `/` | остаётся | корзина |
| `/login` | `LoginRouteRedirect` | `replace` → `/?login=1` | далее home redirect → `/tyres` | нормализация legacy route |
| `/demo/*` неизвестный | `UnmatchedDemoRoute` | `replace` → `/demo/tyres` | то же | не маркетинговый `/` |
| любой другой | `UnmatchedRoute` | `replace` → `/` | `replace` → `/`, затем → `/tyres` | безопасный fallback |

`ROUTER_BASENAME` вычисляется из `process.env.PUBLIC_URL` с удалением завершающего `/`. Для GitHub Pages `/tyres_discs/tyres` Router видит внутренний pathname `/tyres`.

## Как выбирается маршрут: пошагово

1. `BrowserRouter` нормализует URL относительно `basename`.
2. `AppReady` ждёт окончания auth restore.
3. `<Routes>` выбирает самый подходящий route.
4. Общий родитель без path монтирует `AppFrame`.
5. Вложенный route выполняет `HomeRoute`, guard либо login redirect.
6. `<Navigate replace>` при необходимости заменяет текущую history entry.
7. После стабилизации URL `AppFrame` повторно читает `location.pathname` и query.
8. `pageFromPathname` возвращает `home`, `tyres`, `wheels`, `basket` либо `login`.
9. `showLanding`/`showCatalog` выбирают большую ветку layout.
10. Нужная keep-alive панель становится видимой; остальные остаются mounted, но получают `hidden`, `inert` и `isActive=false`.
11. `Outlet` рендерит child element. Guards обычно возвращают `null`, потому что визуальную страницу уже выбрал `AppFrame`.

## Схема переходов

```mermaid
flowchart TD
  URL[Текущий URL] --> Ready{Auth restore завершён?}
  Ready -- нет --> Blank[AppReady возвращает null]
  Ready -- да --> Match{Совпавший route}

  Match -- "/" --> Home{canUseApp?}
  Home -- да --> Tyres[/tyres]
  Home -- нет --> Landing[LandingPage]

  Match -- "/tyres или /wheels" --> Auth{canUseApp?}
  Auth -- нет --> LoginQ["/?login=1 + state.from"]
  Auth -- да --> Catalog[Keep-alive catalog]

  Match -- "/basket" --> BasketAuth{canUseApp?}
  BasketAuth -- нет --> Root[/]
  BasketAuth -- да --> Basket[BasketPage]

  Match -- "/login" --> LoginQ
  Match -- неизвестный --> Root
  LoginQ --> Modal[Landing + LoginPage modal]
```

## `AppRoutes`

**Сигнатура:** `export function AppRoutes({ appearance = 'light', onAppearanceChange })`  
**Вход:** props темы для `AppFrame`; Router Context.  
**Возвращает:** декларацию `<Routes>`.  
**Состояние/side effects:** нет; child guards могут навигировать.

`AppRoutes` экспортируется отдельно от `App`, чтобы routing tests использовали `MemoryRouter`, не создавая второй `BrowserRouter`.

Пример тестового mount:

```jsx
<MemoryRouter initialEntries={['/wheels']}>
  <AppRoutes />
</MemoryRouter>
```

**Тест:** [`src/App.routing.test.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/App.routing.test.jsx).  
**Типичная ошибка:** добавить route, но не добавить path в `PATHS`, `pageFromPathname`, `isAppPath`, layout visibility и тесты. Тогда guard может сработать, но `AppFrame` покажет home/не ту панель.

## Guards и redirects

### `RequireAuth()`

**Вход:** `isAuthenticated` из `useAuth`; `canUseApp(isAuthenticated, pathname)` — auth или prefix `/demo`.  
**Выход:** `null`, если app разрешено; иначе `<LoginRedirect />`.  
**Кто вызывает:** child routes `/tyres` и `/wheels` (не `/demo/*`).

Механизм не оборачивает children: route element сам является guard, а каталог расположен в родительском `AppFrame`. Guest получает redirect к query-modal и deep-link в `location.state.from`.

Пример: `/wheels?pcd=114.3` → `/?login=1`, state.from сохраняет `/wheels?pcd=114.3`; после успешного входа helper вернёт исходный app URL.

### `BasketGuard()`

**Вход:** Auth Context.  
**Выход:** `null` либо `<Navigate to="/" replace />`.

В отличие от каталогов, guest basket не открывает login modal. Это явный текущий продуктовый контракт, подтверждённый тестом. Не следует «унифицировать» guards без согласованного изменения UX и тестов.

### `HomeRoute()`

Для auth user возвращает `<Navigate to={DEFAULT_APP_HOME} replace />`, для guest — `null`. Причина: `/` является маркетинговой поверхностью, а рабочий home после входа — `/tyres`.

### `LoginRedirect()`

**Вход:** текущий `location`.  
**Выход:** `<Navigate>` на `/?login=1`.  
**State:** `loginRedirectState(location)` сохраняет полный attempted `pathname + search`.

Его вызывает `RequireAuth`, поэтому deep-link не теряется.

### `LoginRouteRedirect()`

Нормализует `/login` в query-modal. Если у исходной location уже есть state, сохраняет его; иначе создаёт state через `loginRedirectState`.

### `UnmatchedRoute()`

Любой неизвестный route заменяет на `/`. Для auth user `HomeRoute` следующим шагом заменит `/` на `/tyres`. Это может дать два последовательных redirects, но итог остаётся безопасным.

## `AppFrame`

**Сигнатура:** `function AppFrame({ appearance = 'light', onAppearanceChange })`  
**Context:** Auth, AppShell, Router location/search params.  
**Возвращает:** общую Ant Design layout-оболочку и, при необходимости, login modal.

### Вычисляемые значения

- `appEnabled = canUseApp(isAuthenticated, pathname)`.
- `isLoginOpen` — query `login=1`, **но не на** `/demo*`.
- `isHome = pathname === '/'`.
- `showLanding = !appEnabled && (isHome || isLoginOpen)`.
- `showCatalog = appEnabled && !showLanding`.
- `backgroundPage = pageFromPathname(pathname)` — для `/demo/tyres` тоже `tyres`.

### Основные layout-компоненты

1. `Layout.app-layout` — вся background surface. Получает `inert`, пока открыт login.
2. `SiteHeader` — brand, тема, auth action, basket badge и category navigation.
3. `Layout.Content` + `Flex` — основная область.
4. `LandingPage` для guest marketing/login background.
5. Keep-alive panels шин, дисков и basket для доступного app.
6. `DemoCatalogBanner` на `/demo*` при `showCatalog` — немодальный Alert с датой frozen каталога.
7. `SiteFooter`.
8. `ModeToggle` только при `appEnabled`.
9. `ScrollToTop`.
10. `Outlet` для guard/redirect route elements.
11. `LoginPage` рендерится рядом с layout, когда query открыт и user ещё guest.

### Почему modal находится вне inert layout

При login query background layout получает `inert`, поэтому его controls исключаются из keyboard/focus и interaction. `LoginPage` находится соседним узлом, а не потомком inert layout, поэтому форма остаётся интерактивной.

### Key/reset semantics

- Шины: `tires-${workspaceResetKey}-${sessionResetKey}`.
- Диски: `discs-${workspaceResetKey}-${sessionResetKey}`.
- Корзина: `basket-${workspaceResetKey}`.

Смена workspace remount-ит все три поверхности. Клик по бренду увеличивает session key и сбрасывает только search panels; basket не remount-ится по brand click.

### Практический пример

Auth user находится на `/tyres`, выставил фильтры и переходит через `NavLink` на `/wheels`. `AppFrame` не удаляет `TiresSearchParameters`: ставит панели шин `hidden/inert`, передаёт `isActive=false`, а discs panel активирует. При возврате фильтры шин остаются.

**Тесты:** routing tests и [`src/App.catalogDualMount.test.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/App.catalogDualMount.test.jsx).

## Login modal

### `LoginPage()`

**Путь:** [`src/components/LoginPage/LoginPage.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/components/LoginPage/LoginPage.jsx)  
**Props:** нет.  
**Context:** `useAuth`, `useLocation`, `useNavigate`.  
**Локальное состояние:** Ant Design Form, `authError`, один раз вычисленный `reducedMotion`, ref email input.  
**Возвращает:** Ant Design `Modal` либо auth redirect.

### Алгоритм входа

1. `resolvePostLoginPath(location)` заранее вычисляет безопасную цель.
2. После mount `requestAnimationFrame` фокусирует email без прокрутки.
3. Ant Design Form валидирует required/email/password.
4. `handleFinish(values)` вызывает `signIn(email, password)`.
5. При `true` выполняется `navigate(redirectTo, { replace: true })`.
6. При `false` или исключении показывается единое сообщение «Неверный логин или пароль» и возвращается фокус.
7. Если Context уже стал auth до завершения render path, `<Navigate>` также ведёт на `redirectTo`.
8. Escape/mask вызывает `handleDismiss`, который выбирает guest-safe URL.

Side effects: auth/session operations, navigation, animation frame и focus. Cleanup отменяет frame mount-effect.

Пример: guest пришёл на `/tyres`; guard сохранил state.from. После успешного входа modal заменяет URL на `/tyres`, а не добавляет ещё одну history entry.

Типичные ошибки:

- доверять `state.from` без whitelist и создать open redirect;
- закрывать modal через `navigate(-1)` без проверки history;
- убрать `replace` и оставить redirect/login entries в Back history;
- рендерить modal внутри inert layout;
- показывать инфраструктурную ошибку/детали credentials пользователю.

Отдельного `LoginPage.test.jsx` нет. Redirect helpers покрыты unit-тестами, а открытие modal — routing integration test.

## Helpers `paths.js`

### Константы

- `PATHS`: единый словарь `/`, `/tyres`, `/wheels`, `/basket`, `/login`, `/demo`, `/demo/tyres`, `/demo/wheels`, `/demo/basket`.
- `DEFAULT_APP_HOME`: `/tyres`.
- `DEFAULT_DEMO_HOME`: `/demo/tyres`.
- `ROUTER_BASENAME`: нормализованный `PUBLIC_URL`.
- `LOGIN_QUERY_PARAM` / `LOGIN_QUERY_VALUE`: `login` / `1`.

### Query helpers

| Функция | Сигнатура и вход | Результат | Механизм |
| --- | --- | --- | --- |
| `isLoginQueryOpen` | `(searchParams)`; URLSearchParams или строка | boolean | нормализует input и сравнивает `login` с `'1'` |
| `stripLoginQuery` | `(pathname, search='')` | path с остальными query | удаляет только `login` |
| `buildHomeLoginPath` | `(fromHref?)` | Router target object | строит `/?login=1`, optional state.from |
| `pageFromPathname` | `(pathname)` | page id | staff exact match; `/demo*` снимает prefix; неизвестное demo → `tyres`, иначе `home` |

Пример: `stripLoginQuery('/', 'login=1&campaign=a')` возвращает `/?campaign=a`.

### Классификация path

- `isMarketingPath(pathname)` принимает только `/`.
- `isStaffAppPath(pathname)` — только `/tyres`, `/wheels`, `/basket` (post-login whitelist).
- `isAppPath(pathname)` — staff и `/demo*` каталог/корзина (`pageFromPathname` ∈ tyres/wheels/basket).
- `isDemoPath(pathname)` — `/demo` и `/demo/…`.
- `toAppPath(pathname, staffPath)` — тот же экран в текущем дереве.
- `isSafeRelativePath(pathname)` требует начало `/` и запрещает `//`.

Последняя функция блокирует protocol-relative и absolute open redirects. Она не является полной URL sanitizer; безопасность обеспечивается вторым whitelist `isAppPath`.

### `resolvePostLoginPath(location, { fallback = DEFAULT_APP_HOME } = {})`

**Вход:** Router location с optional `state.from`; optional fallback.  
**Выход:** безопасный app URL.  
**Чистота:** pure, синхронная.

Алгоритм:

1. Извлечь `from`.
2. Разделить его на pathname и search.
3. Проверить same-origin-relative форму.
4. Проверить, что pathname входит в whitelist app paths.
5. Если обе проверки успешны, вернуть pathname + исходный search.
6. Иначе нормализовать fallback: только app path, иначе `/tyres`.

Примеры:

- `/wheels?pcd=114.3` → тот же URL;
- `https://evil.example/phish` → `/tyres`;
- `//evil.example` → `/tyres`;
- `/unknown` → `/tyres`;
- fallback `/` → `/tyres`.

### `resolveLoginDismissPath(location)`

Возвращает только guest-safe marketing URL. Даже если `state.from='/basket'`, закрытие без входа ведёт на `/`, а не на protected surface. Для marketing `from` удаляет query `login`, сохраняя другие query params.

### Link helpers

- `loginLinkState(location)` сохраняет текущий deep-link только для app path; с marketing home намерением становится `/tyres`.
- `loginLinkTarget(location)` объединяет `/`, `?login=1` и state.
- `loginRedirectState(location)` всегда строит `{ from: pathname + search }` для guard.
- `canCloseLoginWithHistoryBack(location)` проверяет safe relative `from`, отличный от `/login`; сейчас production `LoginPage` его не вызывает.

### Deprecated exports

`loginReturnPath`, `loginRedirectFrom`, `loginDismissPath` оставлены как compatibility aliases. Новый код должен использовать `resolvePostLoginPath` и `resolveLoginDismissPath`; иначе API продолжит разрастаться и появятся разные redirect rules.

**Тест:** [`src/app/paths.test.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/app/paths.test.js) покрывает whitelist, open redirects, query helpers, fallback, deep-link и dismiss.

## Основные layout-компоненты

### `SiteHeader`

**Props:** `appearance='light'`, `onAppearanceChange`.  
**Context:** AppShell brand reset, Auth readiness, logout hook, Cart readiness/quantity, Router location.  
**Результат:** semantic header с Ant Design cart icon и Router links.

Механизм:

- guest brand ведёт на `/`, auth brand — `/tyres`, demo brand — `/demo/tyres`;
- на `/demo*` нет «Войти» и «Выйти»;
- вход строится через `loginLinkTarget(location)` только вне демо;
- basket показывается при `canUseApp`; ссылка — `toAppPath` (`/demo/basket` в демо);
- badge не показывает stale quantity до готовности workspace и cart namespace;
- значение выше 99 отображается как `99+`;
- navigation items берутся из `config/site`, в демо пути через `toAppPath`, disabled показываются с tooltip «Скоро»;
- category nav без видимого scrollbar: swipe на touch, wheel→горизонталь и edge-fade/стрелки на desktop при overflow (`useSiteHeaderNavScroll`).

**Тест:** [`src/components/SiteHeader/SiteHeader.test.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/components/SiteHeader/SiteHeader.test.jsx) проверяет readiness badge.

### `useLogout`

**Путь:** [`src/auth/useLogout.js`](https://github.com/iscander-b10/tyres_discs/blob/main/src/auth/useLogout.js)  
**Сигнатура:** `useLogout() → () => void`.  
**Вход:** Auth Context, Cart Context, Router navigate и текущий `workspace.storeId`.  
**Результат:** memoized callback.

Callback выполняет порядок `flush cart → detach cart/sync → invalidate active IndexedDB store → logout session/workspace → navigate('/', { replace: true })`. Последовательность важна: если сначала удалить workspace, cart provider может потерять namespace до сохранения и отключения sync. Корзина при logout не очищается — она остаётся в versioned storage своего account/store.

`SiteHeader` вызывает callback кнопкой «Выйти». Тесты [`src/auth/useLogout.test.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/auth/useLogout.test.jsx) и [`src/auth/useLogout.cartPolicy.test.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/auth/useLogout.cartPolicy.test.jsx) фиксируют порядок и политику сохранения корзины.

### `SiteFooter`

**Props:** нет.  
**Context:** AppShell, Auth, Router.  
**Результат:** brand, product/service navigation, контакты и account action.

Footer использует тот же `loginLinkTarget`, поэтому header и footer не расходятся в правилах deep-link. Отдельного unit-теста нет.

### `ModeToggle`

**Путь:** [`src/components/ModeToggle/ModeToggle.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/components/ModeToggle/ModeToggle.jsx)  
**Сигнатура:** `function ModeToggle()`; props отсутствуют.  
**Context:** `clientMode`, `setClientMode` из AppShell.  
**Результат:** portal в `document.body` с Ant Design `Switch`.

Компонент владеет только представлением плавающего переключателя: текущей позицией, drag/snap flags и DOM refs. Положение читается из `ivanor.mode-toggle.position`; legacy key мигрируется при следующем сохранении. Координаты ограничиваются viewport, сохраняются вместе с относительными ratios и пересчитываются при resize. Pointer move обновляет transform через `requestAnimationFrame`, а cleanup отменяет RAF и снимает window listeners.

`Switch.checked` получает `clientMode`, `onChange` вызывает `setClientMode`. Бизнес-правило «guest всегда client» находится не здесь, а в Provider. `AppFrame` вообще не монтирует toggle без `appEnabled`.

Пример: auth manager перетаскивает toggle к правому краю и включает client mode. Position сохраняется локально, AppShell сохраняет mode отдельно, а Context rerender меняет отображение цен у consumers.

Отдельного теста `ModeToggle` нет. Опасно переносить mode business rules в drag-компонент, не очищать global pointer listeners или сохранять только абсолютные координаты: после resize панель может оказаться вне viewport.

### `ScrollToTop`

**Props:** нет.  
**State:** `visible`; refs предыдущего path и login state.  
**Effects:** scroll listener и route-driven `window.scrollTo`.

При настоящей смене pathname прокручивает вверх. Открытие/закрытие query-modal не меняет scroll: если login открыт сейчас или был открыт до перехода, effect возвращается раньше. Кнопка появляется после 320 px и учитывает `prefers-reduced-motion`.

Отдельного unit-теста нет. При изменении важно не трактовать query-only login navigation как новую страницу.

## Что происходит при навигации

```mermaid
sequenceDiagram
  autonumber
  participant U as Пользователь
  participant Link as NavLink
  participant Router as BrowserRouter
  participant Guard as Route guard
  participant Frame as AppFrame
  participant Shell as AppShellProvider
  participant Panel as Catalog panel

  U->>Link: выбирает Диски
  Link->>Router: navigate("/wheels")
  Router->>Guard: выбирает RequireAuth
  Guard->>Guard: canUseApp(isAuthenticated)
  Guard-->>Router: null для auth user
  Router-->>Frame: новое location.pathname
  Frame->>Frame: pageFromPathname = wheels
  Frame->>Panel: tyres hidden/inert/isActive=false
  Frame->>Panel: wheels visible/isActive=true
  Router-->>Shell: pathname changed
  Shell->>Shell: lastCatalogPath=/wheels
```

History изменяется Router-ом без полной перезагрузки документа. React providers сохраняют state. Только изменение React `key`, logout/workspace смена или полный reload создают новый lifecycle соответствующих поддеревьев.

## Ошибки и крайние случаи

- Pending restore не запускает guards благодаря `AppReady`.
- Guest protected catalog получает login modal с deep-link.
- Guest basket не получает modal, а возвращается на home.
- Unknown path не показывает пустую страницу, а нормализуется.
- Login query со значением не `1` не открывает modal.
- Auth user с `/?login=1` уходит на `/tyres`; modal не рендерится.
- Malicious absolute/protocol-relative `from` заменяется на `/tyres`.
- Protected `from` при dismiss не открывается без авторизации.
- Query страницы сохраняется при post-login только для whitelist app path.
- `basename` должен совпадать с фактическим deployment prefix; иначе Router не сопоставит URL.
- `pageFromPathname` возвращает `home` для неизвестного path, но wildcard redirect быстро нормализует location.

## Тестовое покрытие маршрутов

[`src/App.routing.test.jsx`](https://github.com/iscander-b10/tyres_discs/blob/main/src/App.routing.test.jsx) использует реальный `AppRoutes` и `MemoryRouter`, но мокает Context и тяжёлые страницы. Проверяются:

1. guest `/tyres` → `/?login=1`, landing и modal;
2. guest `/basket` → `/`, корзина отсутствует;
3. auth `/` → `/tyres`;
4. `/login` → query-modal;
5. auth `/basket` показывает basket;
6. guest `/demo` и `/demo/tyres` открывают каталог без login;
7. `/demo/wheels`, `/demo/basket` доступны;
8. unmatched `/demo/x` → `/demo/tyres`.

## Checklist добавления маршрута

1. Добавить константу в `PATHS`.
2. Решить, входит ли route в `isAppPath`/marketing whitelist.
3. Добавить route и нужный guard в `AppRoutes`.
4. Добавить page id в `pageFromPathname`.
5. Добавить визуальную ветку/панель в `AppFrame`.
6. Определить keep-alive, `hidden`, `inert`, `isActive` и React key.
7. Решить post-login и dismiss semantics.
8. Обновить header/footer navigation.
9. Добавить unit tests helpers и routing integration tests.
10. Проверить direct URL на deployment basename.

## Связанные страницы

- [Запуск frontend и дерево Provider](/02-architecture/frontend-provider-tree)
- [Состояние AppShell](/03-routing-shell/app-shell-state)
- [Две смонтированные панели каталога](/03-routing-shell/dual-mount-catalog)
- [Клиентская модель авторизации](/04-auth/client-auth-model)
- [Гонки и logout](/04-auth/races-and-logout)
- [GitHub Pages приложения](/12-operations/github-pages)
- [ADR-009: публичное демо](/adr/009-demo-url-frozen-snapshot)
