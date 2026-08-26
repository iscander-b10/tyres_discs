# ADR-009: Публичное демо по URL и замороженный snapshot

## Статус

**Принято** — `src/app/appMode.js`, `src/app/demoWorkspace.js`, `src/services/demoCatalog/`, `public/demo/`.

## Контекст

Потенциальным магазинам нужна витрина каталога без пароля сотрудника. Staff-маршруты `/tyres`, `/wheels`, `/basket` остаются за client-only session.

## Проблема

Глобальный `isDemo = true` открыл бы `/tyres` всем. Live autosync на демо подтянул бы актуальный магазин и смешал IndexedDB/корзину со staff.

## Рассмотренные варианты

- **Глобальный build-time флаг `isDemo`** — отвергнут: ломает auth-границу staff URL.
- **Отдельный демо-формат каталога** — отвергнут: тот же wire snapshot schemaVersion 1.
- **Live meta/snapshot на `/demo`** — отвергнут: демо намеренно «на сегодня» и не автообновляется.

## Принятое решение

- Режим считается из pathname: prefix `/demo` (`isDemo(pathname)` / `isDemoPath`).
- Дерево `/demo`, `/demo/tyres`, `/demo/wheels`, `/demo/basket`. Неизвестный `/demo/foo` → `/demo/tyres`.
- `canUseApp(isAuthenticated, pathname)`: staff session **или** demo-path. Guest на `/tyres` по-прежнему получает `/?login=1`.
- Синтетический workspace `{ login, accountId, storeId } = 'demo'` без verifier. Отдельные IndexedDB и корзина.
- Каталог — один frozen JSON того же wire-format (`public/demo/snapshot.json` + `meta.json`, либо Object Storage URL вне `stores/{liveStoreId}/`).
- `CatalogSyncHost` / `checkAndSyncCatalog` на demo-path не запускаются. Cold start делает `DemoCatalogHost`.
- Шторка — существующий `CatalogBootstrapOverlay`. Пользователь видит только процент, не размер файла. `%` считается по `meta.bytes`.
- На `/demo*` нет «Войти»/«Выйти». Login modal с демо не открывается.

## Причины

- URL-дерево сохраняет staff auth.
- Frozen snapshot не требует облачного расписания для витрины.
- Тот же apply/validation, что у staff.

## Плюсы

- Изоляция store `demo` от live магазина
- Повторный визит читает IndexedDB без сети
- Staff autosync на `/tyres` не затронут

## Минусы

- Снимок устаревает; обновление — операционный шаг, не runtime
- Крупный JSON в `public/demo/` увеличивает clone/deploy, либо нужен внешний URL

## Последствия

- Не включать глобальный `isDemo = true`
- Не ходить из демо в `/v2/catalog/{liveStoreId}/meta|snapshot`
- How-to: [Обновить frozen demo snapshot](/14-development/update-demo-snapshot)

## Связанные файлы

- `src/app/appMode.js`, `src/app/paths.js`, `src/app/demoWorkspace.js`
- `src/services/demoCatalog/DemoCatalogHost.jsx`, `demoCatalogService.js`
- `src/services/catalogSync/CatalogSyncHost.jsx`
- `scripts/freeze-demo-snapshot.js`
- `public/demo/meta.json`, `public/demo/snapshot.json`

## Связанные страницы

- [Маршруты и вход](/03-routing-shell/routes-and-login-modal)
- [Frontend autosync](/06-catalog-sync/frontend-autosync)
- [Клиентская модель auth](/04-auth/client-auth-model)
