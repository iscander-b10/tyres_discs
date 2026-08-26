# Обновить frozen snapshot демо

::: tip Статус: проверено по коду
Рантайм `/demo` **не** скачивает live `/v2/catalog/{storeId}`. Файл обновляется только этой процедурой.
:::

## Зачем

Демо показывает заранее снятый каталог. Через неделю он устареет — так задумано. Чтобы освежить витрину, снимите текущий production snapshot ещё раз.

## Что получается

| Файл | Назначение |
| --- | --- |
| `public/demo/snapshot.json` | Wire snapshot schemaVersion 1 (шины, диски, поставщики) |
| `public/demo/meta.json` | `{ bytes, version, frozenAt }` — `bytes` только для прогресса шторки |

Поле `bytes` — uncompressed size JSON. GitHub Pages часто отдаёт gzip, и `Content-Length` тогда нельзя считать total. Клиент считает `% = receivedBytes / meta.bytes` и **не** показывает мегабайты.

## Команда

Нужны те же `REACT_APP_CATALOG_API_BASE` (или `REACT_APP_CORS_PROXY`) и `REACT_APP_STORE_ID`, что для staff autosync. Значения — в локальном env, не в git.

```bash
npm run demo:freeze
```

Эквивалент: `node scripts/freeze-demo-snapshot.js`.

Скрипт:

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
3. Refresh — без шторки и без повторного download.
4. `/tyres` без сессии по-прежнему ведёт на `/?login=1`.

## Связанные страницы

- [Frontend autosync](/06-catalog-sync/frontend-autosync)
- [Конфигурация](/01-getting-started/configuration)
- [ADR-009](/adr/009-demo-url-frozen-snapshot)
