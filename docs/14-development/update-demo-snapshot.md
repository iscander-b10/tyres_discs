# Обновить frozen snapshot демо

::: tip Статус: проверено по коду
Рантайм `/demo` **не** скачивает live `/v2/catalog/{storeId}`. Файл обновляется только этой процедурой.
:::

## Зачем

Демо показывает заранее снятый каталог. Через неделю он устареет — так задумано. Чтобы освежить витрину, соберите snapshot локально или снимите live production snapshot (см. ниже — для демо с маскировкой имён live-путь не подходит).

## Что получается

| Файл | Назначение |
| --- | --- |
| `public/demo/snapshot.json` | Wire snapshot schemaVersion 1 (шины, диски, поставщики) |
| `public/demo/meta.json` | `{ bytes, version, frozenAt }` — `bytes` только для прогресса шторки |

Поле `bytes` — uncompressed size JSON. GitHub Pages часто отдаёт gzip, и `Content-Length` тогда нельзя считать total. Клиент считает `% = receivedBytes / meta.bytes` и **не** показывает мегабайты.

## Команды

### Локальная сборка с анонимизацией имён (рекомендуется для `/demo`)

Публичное демо не должно светить реальные названия поставщиков. Snapshot собирается через те же transform, что и catalog-sync, но с временно подменёнными `label` / `supplier` и записью только в `public/demo/` (`storeId: demo`).

1. Временно замените отображаемые имена в:
   - `yandex/catalog-sync/src/suppliers/loadAll.js` — поля `label`;
   - `src/services/suppliers/*/transformers.js` — поле `supplier` у товаров.
   Маппинг и технические ключи (`shinservice`, …) — в задаче / ADR по demo.
2. Убедитесь, что в `.env*` заданы URL поставщиков (`SHINSERVICE_*`, `SEMISOTNOV_*`, …).
3. Соберите snapshot:

```bash
npm run demo:build-local
```

Эквивалент: `node scripts/build-demo-snapshot-local.js`.

Скрипт:

1. Загружает upstream через `loadAllSuppliersData()` (без `runCatalogSync`, без Object Storage).
2. Собирает command-snapshot через `buildSnapshotSuppliers`.
3. Проверяет отсутствие реальных имён в `supplier` / `label`.
4. Пишет `public/demo/snapshot.json` и `meta.json`.

4. **Откатите** временные правки в `loadAll.js` и `transformers.js` — production-код должен снова содержать реальные имена.

Витрина `/demo` читает `showcaseSupplierDemo` (`ТайрСервис`) из `showcaseConfig.js`; live store — `showcaseSupplier` (`Шинсервис`).

### Скачать live snapshot (без маскировки)

```bash
npm run demo:freeze
```

Эквивалент: `node scripts/freeze-demo-snapshot.js`.

**Не используйте для публичного demo с анонимизацией:** команда тянет текущий production snapshot с API — в нём останутся реальные имена поставщиков (`Шинсервис`, …). Подходит только если маскировка не нужна.

Нужны `REACT_APP_CATALOG_API_BASE` (или `REACT_APP_CORS_PROXY`) и `REACT_APP_STORE_ID`. Скрипт:

1. `GET {api}/v2/catalog/{storeId}/snapshot`
2. Если в ответе нет `schemaVersion`, записывает `1`
3. Пишет JSON и `meta.json` с точным числом байт

Не кладите секреты в репозиторий. Не кладите snapshot в `docs/.vitepress`.

## Куда класть файл

- **До ~20–25 МБ** — `public/demo/snapshot.json` в git (CRA отдаёт его как static file через `PUBLIC_URL`).
- **Крупнее** — не коммить JSON. Выложите ключ Object Storage **вне** `stores/{liveStoreId}/`, чтобы catalog-sync не перезаписал демо. Задайте `REACT_APP_DEMO_SNAPSHOT_URL` и `REACT_APP_DEMO_META_URL` на сборке GitHub Pages.

Текущий артефакт в репозитории — frozen JSON в `public/demo/` (~15 МБ uncompressed).

## Проверка

1. Очистить IndexedDB origin (или только БД `CatalogDatabase.demo`).
2. Открыть `{basename}/demo` — шторка с процентом, без текста про МБ.
3. В баннере дата «Каталог на ДД.ММ.ГГГГ» (`frozenAt` из `meta.json`).
4. В фильтре поставщиков — анонимизированные имена (ТайрСервис, РегионШина, …), полки витрины не пустые.
5. Refresh — без шторки и без повторного download.
6. `/tyres` без сессии по-прежнему ведёт на `/?login=1`.

## Связанные страницы

- [Frontend autosync](/06-catalog-sync/frontend-autosync)
- [Конфигурация](/01-getting-started/configuration)
- [ADR-009](/adr/009-demo-url-frozen-snapshot)
