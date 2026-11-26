# Frontend-автосинхронизация каталога

Эта страница разбирает активный браузерный путь `meta → snapshot → IndexedDB → обновление UI`. Его задача — незаметно поддерживать локальный каталог выбранного магазина в актуальном состоянии. Пользователь не нажимает кнопку синхронизации и не получает toast: штатный результат отражается обновлением витрин и корзины, а сбои записываются в диагностический лог.

## Карта ответственности

| Участник | Ответственность | Не делает |
| --- | --- | --- |
| `CatalogSyncHost` | Выбирает момент запуска, привязывает работу к workspace, отменяет старый запуск, догоняет UI до версии в IDB, выставляет cold-start `catalogBootstrap` | Не скачивает и не валидирует snapshot |
| `checkAndSyncCatalog` | Выполняет сетевой сценарий под writer lock, сравнивает версии, классифицирует результат | Не владеет React-состоянием |
| `applyCatalogSnapshot` | Валидирует весь snapshot, вызывает единственный атомарный IDB commit, затем публикует версию | Не решает, когда запускать sync |
| `CatalogIdbSession.applyCatalogSnapshot` | В одной `readwrite`-транзакции меняет товары и metadata version | Не принимает wire-format без предварительной нормализации |
| `AppShellProvider` | Превращает подтверждённую версию в `catalogDataVersion` и `catalogSnapshotVersion` для потребителей UI | Не является источником истины для persisted version |

Источником истины для решения `up-to-date` служит metadata внутри IndexedDB, а не localStorage. Ключ `ivanor.catalog.cloudVersion.<encoded-storeId>` — совместимый межвкладочный сигнал после commit, но не commit marker.

## Где путь подключён

`CatalogSyncHost` монтируется в `App.js` внутри дерева приложения **только вне demo-path**. Из `AuthContext` он получает готовность workspace и `workspace.storeId`; из `AppShellContext` — `notifyCatalogApplied`, `setCatalogBootstrap` и `registerCatalogBootstrapRetry`. Шторку рисует `AppShellProvider` (`CatalogBootstrapOverlay`), а не сам host.

На `/demo*` монтируется `DemoCatalogHost`: тот же overlay и apply в IDB, без `checkAndSyncCatalog`, слотов, visibility и `/v2/catalog/{liveStoreId}/meta|snapshot`. Источник — `public/demo/snapshot.json` (или `REACT_APP_DEMO_SNAPSHOT_URL`) и `meta.json` с полем `bytes` для расчёта процента. Пользователь видит только %, не мегабайты. How-to снимка: [Обновить frozen demo snapshot](/14-development/update-demo-snapshot).

Эффект staff-host не запускается, пока:

- pathname — `/demo*`;
- `isWorkspaceReady !== true`;
- отсутствует `workspace.storeId`;
- не настроен API base (`REACT_APP_CATALOG_API_BASE`, либо fallback `REACT_APP_CORS_PROXY`).

При смене workspace React очищает старый эффект, вызывает `AbortController.abort()`, удаляет listeners и timer. Одновременно generation-механизм `indexedDBService` делает запоздавший результат старого магазина недействительным.

## Триггеры

После активации workspace host:

1. немедленно вызывает `run('start')`;
2. планирует ближайший московский слот;
3. слушает `visibilitychange` и запускается при переходе во `visible`;
4. слушает браузерное событие `online`;
5. слушает `pageshow` (в том числе `event.persisted` после bfcache) и `resume` Page Lifecycle, если браузер его шлёт;
6. слушает `focus`, но не на каждый клик по полю.

Слоты заданы в МСК: `08:10`, `09:40`, `12:10`, `15:10`. `msUntilNextSyncCheck(now)` возвращает число миллисекунд до ближайшего строго будущего слота; если все слоты прошли — до `08:10` следующего дня. Внутренний timer ограничен снизу одной секундой. Скрытая вкладка слот пропускает: пока машина спит, timer не живёт, а вкладка из bfcache часто не проходит `start` заново и не получает `visibilitychange`, если и так считается видимой. `pageshow` и `resume` закрывают этот пропуск.

`start`, `slot` и явный `retry` холодной шторки не ограничиваются паузой. Остальные причины, включая `focus`, `pageshow`, `resume`, `visibility` и `online`, не запрашивают meta чаще одного раза в 30 секунд. Meta по-прежнему с `cache: 'no-store'`.

Только причина `slot` подавляется в скрытой вкладке. `start` и `online` технически могут работать при `document.visibilityState === 'hidden'`. Флаг `syncing` не допускает второй конкурентный `run` внутри одного host; координацию между вкладками выполняет lock. Триггер во время `syncing` не ставится в очередь.

При показе вкладки (`start`, переход в `visible`, `pageshow`, `resume`) host один раз за этот показ сравнивает скрипты страницы с `asset-manifest.json`. Если манифеста нет или в нём нет `static/js`, сравнивает список `<script src>` в `index.html`. Оба запроса идут с `cache: 'no-store'`. Если имя скрипта другое, вкладка делает один `location.reload()`. Повторный reload в той же `sessionStorage`-сессии не выполняется, даже если после reload HTML всё ещё старый. Service worker не используется. `focus` манифест не запрашивает.

## Основная sequence diagram

```mermaid
sequenceDiagram
    autonumber
    participant Host as CatalogSyncHost
    participant Lock as catalogSyncLock
    participant API as Catalog API
    participant Service as catalogSyncService
    participant IDB as CatalogIdbSession
    participant Bus as sync channel
    participant Shell as AppShellContext

    Host->>Service: checkAndSyncCatalog({storeId, signal})
    Service->>Lock: withCatalogSyncLock(storeId, callback)
    Lock-->>Service: exclusive section
    Service->>IDB: setActiveStore(storeId) → generation
    Service->>API: GET /v2/catalog/{storeId}/meta
    API-->>Service: { version }
    Service->>IDB: getPersistedCatalogVersion()
    IDB-->>Service: localVersion
    Service->>IDB: isCatalogEmpty()
    IDB-->>Service: boolean
    alt локальный каталог не пуст и meta.version <= localVersion
        Service-->>Host: {status: "up-to-date", version}
    else нужен snapshot
        Service->>API: GET /v2/catalog/{storeId}/snapshot
        API-->>Service: snapshot
        Service->>Service: validateAndNormalizeCatalogSnapshot(snapshot)
        Service->>IDB: applyCatalogSnapshot(commands, version)
        Note over IDB: Одна readwrite-транзакция:<br/>tyres + discs + metadata
        IDB-->>Service: {applied, writes, skipped}
        opt applied === true
            Service->>Bus: postCatalogApplied(version, storeId)
        end
        Service-->>Host: {status: "applied", version}
    end
    Host->>IDB: getPersistedCatalogVersion()
    Host->>Shell: notifyCatalogApplied(persistedVersion, storeId)
```

Обратите внимание: публичный статус `applied` возвращается после `await applyCatalogSnapshot(...)` даже если нижний IDB version gate ответил `{ applied: false, skipped: true }`. В этом случае localStorage/broadcast не обновляются, но host всё равно перечитает persisted version и синхронизирует UI с ней. Это ограничение текущего формата результата, а не новый commit.

## Важные функции

### `checkAndSyncCatalog(options?)`

**Роль.** Полный сетевой orchestration под эксклюзивной блокировкой.

**Параметры.**

- `force = false` — обходит оба предварительных сравнения версий, но не нижний атомарный version gate в IDB;
- `storeId` — магазин; пустое значение разрешается через env/default namespace;
- `signal` — опциональный `AbortSignal` для `fetch`;
- `onProgress` — опциональный callback `{ phase: 'meta' \| 'download' \| 'parse' \| 'apply', receivedBytes, totalBytes, progress }`. React в сервис не импортируется. Host подписывается только на cold start и кладёт `progress`/`label` в уже существующий `catalogBootstrap`; исключение в callback глотается и не превращает sync в `error`. `progress` монотонен и не достигает 100 до commit. Фаза `warmup` («Готовим витрину») не из сервиса: её ставит host после IDB;
- `onLockWaiting` — опциональный callback сервиса, когда writer lock занят другой вкладкой. Host его не подписывает и не меняет подпись шторки: пустая база остаётся на обычной загрузке («Проверяем каталог» / «Загружаем каталог шин и дисков»). Текст «Каталог загружается в другой вкладке» на экран не выводится.

**Результат.** `Promise` с одним из объектов:

```js
{ status: 'disabled' }
{ status: 'offline' }
{ status: 'skipped', error: 'aborted' | 'meta empty' | 'snapshot empty' | 'stale store' }
{ status: 'up-to-date', version: '2026-08-24T12:00:00+03:00' }
{ status: 'applied', version: '2026-08-24T12:00:00+03:00' }
{ status: 'error', error: 'HTTP 503' }
```

Функция `async`: rejection callback внутри lock обычно преобразуется в `{status: 'error'}`, кроме ошибки самого механизма lock до входа в callback.

**Алгоритм.**

1. Нормализовать `storeId` и занять writer lock `origin + storeId`.
2. Активировать namespace магазина и запомнить generation.
3. Вернуть `disabled`, `offline` или pre-fetch `aborted`, если проверка невозможна.
4. Получить `/meta` с `cache: 'no-store'`.
5. После каждого `await` проверить, что store/generation всё ещё активны.
6. Прочитать persisted IDB version и проверить, пуст ли каталог.
7. Если каталог не пуст и `meta.version <= local`, вернуть `up-to-date`.
8. Скачать `/snapshot` через `ReadableStream`: копить `Uint8Array` чанки, затем `onParseStart` (шторка «Читаем каталог»), yield кадра UI, один `TextDecoder` + `JSON.parse`. Чанки сбрасываются после concat, чтобы не держать bytes+string+object одновременно дольше parse. AbortSignal сохраняется. `Content-Length` не считается истиной, если его нет, стоит `Content-Encoding` кроме `identity`, или принятые байты превысили заявленный total.
9. Повторить version gate уже по версии snapshot.
10. Валидировать и применить snapshot; `onProgress` переходит `parse` → `apply`.
11. Вернуть классифицированный результат; залогировать ошибку.

**Side effects.** Сеть, переключение IDB namespace, IDB commit через callee, `console.info` после успешного пути, `appLog.warn` на секцию с повтором id, `appLog.error` при ошибке.

**Callers/callees.** Caller — `CatalogSyncHost`; в тестах функция вызывается напрямую. Callees — `withCatalogSyncLock`, `fetch`, IDB service, `applyCatalogSnapshot`. `warmupCatalogReadCache` вызывает host после возврата из sync, не сам `checkAndSyncCatalog`.

**Гарантии.**

- один writer для одного `storeId` на origin;
- пустой локальный каталог заставляет скачать snapshot даже при равной version;
- stale store и abort не публикуются как общая ошибка;
- HTTP `404` преобразуется в `null`, затем в `meta empty`/`snapshot empty`;
- HTTP non-2xx (кроме `404`), JSON parsing, blocking validation и IDB failures дают `status: 'error'`. Секционный `DUPLICATE_ID` даёт `applied`.

**Ограничения.**

- version сравнивается лексикографически (`meta.version <= local` и тот же gate у snapshot). Равная строка snapshot не качает, если каталог не пуст. Пустая база качает файл даже при равной version. Cloud producer пишет московское время окончания успешного прогона, `YYYY-MM-DDTHH:mm:ss+03:00`, точность до секунды. Старая строка слота того же формата остаётся меньше более поздней публикации. Смешивать формат с `Z`-строками нельзя. IndexedDB из этого пути не удаляется;
- автоматического retry/backoff внутри одного запуска нет;
- `navigator.onLine` — лишь ранняя эвристика, а не доказательство доступности API;
- timeout сети не задаётся: отмена приходит только через переданный signal;
- результат не содержит validation report, только строку первой ошибки; подробности идут в `appLog`.

**Пример.**

Вход:

```js
await checkAndSyncCatalog({
  storeId: 'ElistaIvanor',
  force: false,
  signal: abortController.signal,
});
```

При meta `v2`, persisted `v1` и валидном snapshot `v2` результат:

```js
{ status: 'applied', version: 'v2' }
```

**Риск изменения.** Перенос version gate за snapshot увеличит трафик; удаление проверок generation может записать данные другого workspace; превращение обработанных ошибок в rejection нарушит host и тестовый контракт.

### `applyCatalogSnapshot(snapshot, options?)`

**Роль.** Commit boundary между недоверенным wire snapshot и локальным каталогом.

**Параметры.**

- `snapshot` — объект с `version`, `schemaVersion`, `suppliers`;
- `options` — `{storeId, generation}`; для обратной совместимости строка трактуется как `storeId`.

**Результат.** `Promise<{applied, writes, skipped, validationReport}>`. `writes` — число команд `replace`/`purge`, а не число товарных строк.

**Алгоритм и граница транзакции.**

1. Разрешить store и generation, проверить активность.
2. Отдать кадр UI (`yieldToBrowserPaint`), затем синхронно провалидировать и нормализовать весь snapshot без `structuredClone` на каждый SKU.
3. Если `blockingErrorCount > 0` или команд нет — бросить `Error` с `validationReport`; IDB ещё не вызван. Если fatal только секционные `DUPLICATE_ID`, не бросать: битая пара supplier+category уже `keepPrevious`/`failed` без items, остальные команды идут в ту же транзакцию. Перед записью одна `appLog.warn` `catalog.section_duplicate_id` на секцию: supplier, category (`tyres` или `discs`), повторившиеся id. URL, env и секреты в эту запись не входят.
4. Передать все команды и version в один `CatalogIdbSession.applyCatalogSnapshot`.
5. Нижний слой открывает одну `readwrite`-транзакцию сразу на `tires`, `discs`, `metadata`.
6. `keepPrevious` не создаёт write; `purge` становится заменой на `[]`; `replace` полностью заменяет строки данного supplier/category.
7. Metadata version записывается в той же транзакции после товарных операций.
8. Только после завершённого commit обновить localStorage и отправить межвкладочное событие.

**Side effects.** IDB, localStorage и channel; при blocking validation failure side effects отсутствуют. Секционный `DUPLICATE_ID` пишет version вместе с остальными командами. Если IDB transaction abort, localStorage и channel сохраняют прежнее состояние.

**Ошибки.** Validation error содержит структурированный отчёт. IDB/stale-store ошибки пробрасываются caller. Предупреждения нормализации не блокируют commit и возвращаются в `validationReport`.

**Гарантии.** Нет частичного применённого supplier/category набора: транзакция либо фиксирует товары вместе с metadata version, либо откатывается. Snapshot старее/равный текущей IDB version пропускается уже внутри транзакции — защита от TOCTOU между предварительной проверкой и commit.

**Риск изменения.** Запись localStorage до `transaction.oncomplete` создаст ложный сигнал; разбиение на несколько транзакций позволит UI увидеть смешанные версии; ослабление blocking validation может превратить чужую ошибку в частичную порчу каталога. Секционный `DUPLICATE_ID` — единственное исключение, и оно не пишет частичные строки битой секции.

### `CatalogSyncHost`

**Роль и результат.** React-компонент без собственной разметки, возвращает `null`. Управляет жизненным циклом синхронизации и cold-start bootstrap в AppShell.

**Cold start vs warm start.** Host сначала ждёт `isCatalogEmpty()` и **не** открывает шторку заранее: иначе refresh с уже заполненным IDB мелькает overlay на один кадр. Пока проверка идёт, `catalogBootstrap` остаётся `idle` (overlay скрыт).

- `true` — только тогда `phase: 'blocking'` с `waitForShowcase: true`, скачивается один snapshot шин и дисков. `onProgress` обновляет `catalogBootstrap.progress` и `label`: meta ≈ 0–3%, download — основная доля, затем parse и apply. После успешного apply (или `up-to-date`, если снимок уже положила другая вкладка) host вызывает `warmupCatalogReadCache({ tires: true, discs: true })` — фаза «Готовим витрину», два шага. Только потом `notifyCatalogApplied` и `phase: 'ready'` с `waitForShowcase: true`. Overlay UI при этом ещё не снимается: ждёт settled витрину (полки, не skeleton), затем opacity 50ms. Если writer lock занят, шторка остаётся на обычной загрузке, без упоминания другой вкладки. Когда lock отпущен, tab догоняет persisted version/channel; ожидание lock не является error;
- `false` (warm start / обычный refresh) — phase сразу `ready` без `waitForShowcase`, overlay не открывался ни на кадр, warmup не вызывается, дальше тихий autosync без обязательного UI-прогресса (слот, visibility, online, pageshow, resume). Если проверка, скачивание или запись закончились `error` или `offline`, витрина не закрывается. Над каталогом остаётся одна строка «Каталог не обновился» — без даты, без «вчера», без «неактуальный», без кнопки очистки базы и без шторки. Строка висит, пока успешный apply не запишет version строго новее той, что была в IDB на момент сбоя. `up-to-date` её не снимает. Следующий показ вкладки пробует снова сам. Чужой commit той же базы приходит через `postCatalogApplied` и снимает строку, если version новее;
- ошибка чтения IDB трактуется как пустой каталог (нельзя доказать, что он не пуст).

`offline`, HTTP, blocking validation и `disabled` на пустом каталоге ставят `phase: 'error'` с текстом в шторке и кнопкой «Повторить». Секционный `DUPLICATE_ID` возвращает `applied` и шторку ошибки не открывает. Progress не маскирует ошибку. `{status:'skipped', error:'aborted'|'stale store'}` общую ошибку не показывают. Фоновый sync после `ready` шторку и toast не открывает; сбой на уже заполненном каталоге оставляет строку «Каталог не обновился».

**Async и side effects.** Его effect создаёт timer, listeners и `AbortController`. `run` ждёт sync, затем независимо от статуса читает persisted version через `bumpIfIdbAhead`.

`lastNotifiedVersion` локален конкретному effect. Он подавляет повторный bump для версии, которая не новее уже сообщённой. `notifyRef` позволяет использовать свежий callback без перезапуска эффекта.

**Гарантии.** Старый workspace не уведомляет новый; cleanup отменяет fetch и расписание; два события в одном host не запускают две работы одновременно; на cold start blocking выставляется после подтверждения пустого IDB и держится до commit витрины с данными; warm start не открывает overlay.

**Ограничения.** `syncing` не ставит событие в очередь: триггер во время работы теряется. Следующий slot, показ вкладки или `online` восстановит проверку, но кроме `start`, `slot` и `retry` meta не спрашивается чаще раза в 30 секунд. `Content-Length` используется для процента download только если заголовок виден JS и согласован со stream; иначе бар идёт коридором ≈ 5–80%, а крупно показываются мегабайты, не «N% от файла». На cold start между mount и ответом `isCatalogEmpty()` короткое окно `idle` без шторки — это сознательный обмен против вспышки шторки на warm refresh. GitHub Pages не даёт выставить Cache-Control из репозитория: свежий бандл для уже открытой вкладки зависит от сравнения `asset-manifest.json` при показе и одного reload за сессию.

**Риск изменения.** Добавление `notifyCatalogApplied` в dependency array без ref может лишний раз перезапускать effect; удаление `isCurrent()` создаст race при logout/store switch; уведомление по network result вместо persisted version обойдёт реальный commit marker; снова ставить `blocking` до `isCatalogEmpty()` вернёт вспышку шторки на refresh; ставить `ready` до `isCatalogEmpty()` на пустом IDB даст вспышку рабочего сайта на cold start.

### `AppShellContext.notifyCatalogApplied(version, storeId)`

Функция принимает строковую version и storeId, возвращает boolean. Она отвергает пустую version, отсутствие активного workspace и чужой store. Для принятого события:

- обновляет `lastAppliedVersionRef`;
- монотонно обновляет `catalogSnapshotVersion`;
- всегда увеличивает `catalogDataVersion`.

`catalogDataVersion` инвалидирует кэши поиска/витрин. `catalogSnapshotVersion` запускает reconciliation корзины и участвует в стабильном seed витрины. Межвкладочная подписка в `AppShellProvider` делает ту же работу, но подавляет точный дубль `lastAppliedVersionRef`.

## Сценарии

### Первая загрузка

IDB version пустая, каталог пуст. Даже если localStorage содержит старую cloudVersion, она не участвует в решении. Пользователь видит полноэкранную шторку (`phase: 'blocking'`), а не рабочий сайт. Host получает meta, скачивает snapshot, валидирует его и коммитит. Затем прогревает RAM шин и дисков, UI получает persisted version, bootstrap становится `ready`. Шторка UI держится, пока активная витрина не соберёт полки (не skeleton), затем гаснет вместе с fade-in зоны результатов. Empty «Каталог ещё загружается» в витрине нет. Snapshot, у которого fatal исчерпываются повтором id в отдельных секциях, тоже коммитится: шторка доходит до витрины, а не до «Каталог не удалось прочитать.». Битая секция на пустой базе остаётся пустой.

### Повторный запуск

Если IDB не пуст и `meta.version <= persistedVersion`, snapshot не скачивается. Результат — `up-to-date`. Bootstrap сразу `ready`, шторки нет. Host всё равно вызывает `bumpIfIdbAhead`, поэтому только что открытая вкладка узнаёт уже применённую другой вкладкой версию.

### Stale snapshot

Meta могла измениться между двумя GET или API мог вернуть более старый snapshot. Второй service-level gate возвращает `up-to-date`, если snapshot.version не новее локальной. Даже при `force: true` нижний IDB gate не разрешит переписать более новую версию старой.

### Stale store

Пользователь переключил магазин во время fetch/IDB operation. Generation перестаёт совпадать; service возвращает `{status:'skipped', error:'stale store'}` и не отправляет событие. Host старого workspace также не делает UI bump.

### Offline или network error

При `navigator.onLine === false` запросов нет, результат `offline`. Реальная сетевая ошибка, HTTP 5xx или invalid JSON дают `error` и `catalog.sync_failed`. Если каталог уже не пуст, старые товары остаются, blocking-шторки нет, пользователь видит «Каталог не обновился». Если это cold start, AppShell ставит `phase: 'error'` в шторке с кнопкой «Повторить» и текстами «Загружаем каталог шин и дисков» / «Не удалось загрузить каталог.». Событие `online` создаёт новую попытку, но отдельного backoff нет. Очистка IndexedDB из этого пути не выполняется.

### Invalid snapshot

Blocking fatal (envelope, команда, `MISSING_ID`, `SUPPLIER_MISMATCH` и остальные коды кроме секционного `DUPLICATE_ID`) блокирует вызов IDB. Service пишет `catalog.snapshot_invalid` с storeId, путём первой blocking-проблемы и числом ошибок; localStorage и channel не меняются. На холодном старте шторка получает «Каталог не удалось прочитать.».

`DUPLICATE_ID` только в шинах или только в дисках одной секции так не работает. `checkAndSyncCatalog` возвращает `applied`. `resolveCatalogBootstrapError` не вызывается. Пустая IndexedDB после этого открывает каталог: битая секция пустая, вторая категория того же поставщика и остальные поставщики на экране. Если секция уже лежала в базе, её строки остаются, соседние секции обновляются. Version публикации записывается. Та же строка version повторно не скачивается. Следующий прогон того же слота получает новую секундную version и скачивается, если она лексикографически больше.

Подробнее о wire-командах — в [протоколе и проверке snapshot](/06-catalog-sync/snapshot-protocol-validation).

### IDB failure

Ошибка открытия базы, `put`, delete/replace или abort транзакции превращается в `status: 'error'`. Атомарность сохраняет предыдущие товары и metadata version. Поэтому localStorage и broadcast также остаются прежними. Практическое восстановление разобрано в [обработке ошибок и восстановлении](/06-catalog-sync/error-recovery).

## Active, legacy и helpers

### Active path

- `CatalogSyncHost`;
- `checkAndSyncCatalog`;
- `applyCatalogSnapshot`;
- `validateAndNormalizeCatalogSnapshot`;
- `CatalogIdbSession.applyCatalogSnapshot`;
- `postCatalogApplied` / `subscribeCatalogApplied`;
- `AppShellContext.notifyCatalogApplied`.

### Legacy/compatibility

- Snapshot без `schemaVersion` принимается как legacy с warning.
- `entry.label` может заменить отсутствующий `entry.supplier`.
- Непустой legacy-массив category трактуется как `replace`; пустой массив отвергается как неоднозначный.
- Строковый второй аргумент `applyCatalogSnapshot(snapshot, storeId)` поддерживается адаптером options.
- `getLocalCatalogVersion` и `setLocalCatalogVersion` сохраняют совместимый localStorage marker, но `getLocalCatalogVersion` не используется version gate активного sync.

### Helpers

- `catalogApiBase`, `metaUrl`, `snapshotUrl`, `fetchJson` (meta) и stream-чтение snapshot — конфигурация и HTTP;
- `getMoscowParts`, `msUntilNextSyncCheck` — расписание;
- `isAbortError` — нормализация abort;
- `isLocalCatalogEmpty`, `getPersistedCatalogVersion` — fail-safe wrappers: при ошибке считают каталог пустым/version неизвестной, после чего основной путь попробует snapshot;
- `resolveCatalogStoreId` и `getCatalogVersionKey` — store-scoped namespace.

## Что подтверждают тесты

- `catalogSyncService.test.js`: validation до IDB, нормализация, localStorage/broadcast только после commit, persisted version как gate, пустой каталог, store isolation, stale store, stream progress с/без Content-Length, abort посреди stream, gzip/total mismatch и onProgress на up-to-date.
- `catalogSyncService.commitBoundary.test.js`: реальные транзакции через `fake-indexeddb`, rollback при abort, отсутствие side effects при invalid snapshot, supplier-scoped purge.
- `CatalogSyncHost.test.jsx`: ожидание готового workspace, abort/изоляция старого магазина, UI bump по persisted version, подавление slot в hidden-вкладке, empty → blocking затем ready с `waitForShowcase`, non-empty → ready без единого вызова `blocking`/`error` и без `waitForShowcase`, onProgress → progress/label, warmup до notify, ожидание lock без текста про другую вкладку, offline на пустом каталоге → error, stale/abort без общей ошибки, `pageshow`/`resume` после 30 секунд, `focus` внутри 30 секунд без повторного meta, слот внутри 30 секунд, ошибка на непустом каталоге без blocking-шторки.
- `catalogSyncLock.integration.test.js`: два параллельных запуска скачивают snapshot один раз.

Тесты не доказывают доступность реального API, поведение браузера при длительном suspend вкладки или восстановление после исчерпания quota.

## Связанные страницы

- [Хранение и выдача snapshot](/06-catalog-sync/snapshot-storage-serving)
- [Блокировки и каналы](/06-catalog-sync/locks-and-channels)
- [Обработка ошибок и восстановление](/06-catalog-sync/error-recovery)
- [Схема IndexedDB](/05-catalog-storage/indexeddb-schema)
- [Жизненный цикл и миграция storage](/05-catalog-storage/lifecycle-and-migration)
- [Запросы, фильтры и фасеты](/05-catalog-storage/queries-filters-facets)
- [Состояние App Shell](/03-routing-shell/app-shell-state)
- [Обновить frozen demo snapshot](/14-development/update-demo-snapshot)
- [ADR-009: demo URL](/adr/009-demo-url-frozen-snapshot)
