# Добавление нового поставщика

::: tip Статус: проверено по коду
Production path: **cloud sync** + shared transformers. Browser orchestrator — legacy.
:::

## Обзор pipeline

```mermaid
flowchart LR
  Up[Upstream API] --> Req[request.js]
  Req --> Tr[transformers.js]
  Tr --> Cloud[runCatalogSync]
  Cloud --> Snap[snapshot.json]
  Snap --> IDB[applyCatalogSnapshot]
```

## Checklist

### 1. Frontend adapter (shared transforms)

```
src/services/suppliers/myvendor/
  index.js       # { key, label, loadTyres, loadDiscs }
  request.js     # HTTP fetch
  transformers.js # transformTyres, transformDiscs
```

Контракт adapter: см. [Адаптеры](/07-suppliers/supplier-adapters).

Unified item fields должны совпадать с [catalogItemValidation](/05-catalog-storage/indexeddb-schema).

### 2. Cloud load order

`yandex/catalog-sync/src/suppliers/loadAll.js`:

- добавьте key в `SUPPLIER_LOAD_ORDER`
- implement load в `loadSupplierData`

### 3. Cloud transforms re-export

`yandex/catalog-sync/src/suppliers/transforms.js` — re-export новых `transform*`.

Bundler включает frontend transformers в CF bundle.

### 4. Env variables

Frontend `.env.example`:

```
REACT_APP_MYVENDOR_TYRES_URL=
REACT_APP_MYVENDOR_DISCS_URL=
```

Cloud `.env.example`:

```
MYVENDOR_TYRES_URL=
MYVENDOR_DISCS_URL=
```

### 5. Dev proxy (optional)

`src/setupProxy.js` — если upstream блокирует CORS в dev.

### 6. Gateway (optional)

Если нужен direct large-file route — `apigw.yaml` (как b2b/z34).

### 7. Тесты

- unit tests для transformers (рекомендуется добавить fixtures)
- `snapshotCommands.test.js` pattern для partial fail
- manual invoke CF после deploy

### 8. Документация

- [Адаптеры](/07-suppliers/supplier-adapters)
- [Transformers](/07-suppliers/transformers)
- [Справочник Yandex](/13-code-reference/yandex-functions)

## Важно

- Пустой upstream → **keepPrevious**, не purge ([ADR-003](/adr/003-snapshot-sync)).
- Browser **не** должен опрашивать нового поставщика в production — только snapshot.
- `supplierOrchestrator` обновляйте только если нужен legacy manual path.

## Связанные страницы

- [Yandex catalog-sync](/06-catalog-sync/yandex-catalog-sync)
- [Изменение catalog sync](/14-development/change-catalog-sync)
