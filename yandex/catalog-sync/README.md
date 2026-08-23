# Yandex Cloud Function: catalog-sync

Автосинхронизация каталога поставщиков → Yandex Object Storage → фронт читает meta/snapshot.

## Что делает

По Timer (Europe/Moscow): **08:00, 09:30, 12:00, 15:00**

1. Тянет тех же 5 поставщиков, что фронт (`src/services/suppliers/*`), с **прямыми** upstream URL (без CORS-прокси).
2. Нормализует теми же `transform*` (бандлятся из репозитория).
3. **Частичный успех:** успешных обновляет в снимке; у упавших оставляет предыдущую удачную версию поставщика.
4. Пишет в Object Storage:
   - `stores/{storeId}/meta.json`
   - `stores/{storeId}/snapshot.json`
5. Логирует JSON: `catalog-sync-start` / `catalog-sync-finish`.

`storeId` по умолчанию: **ElistaIvanor**.

## Формат meta

```json
{
  "storeId": "ElistaIvanor",
  "version": "2026-08-20T08:00:00+03:00",
  "slot": "08:00",
  "suppliers": [
    { "key": "shinservice", "label": "Шинсервис", "ok": true },
    { "key": "semisotnov", "label": "Семисотнов", "ok": false, "error": "HTTP 500", "keptPrevious": true }
  ],
  "okCount": 4,
  "failCount": 1
}
```

`version` — ISO слота МСК (лексикографически сравнима).

## Формат snapshot

```json
{
  "schemaVersion": 1,
  "storeId": "ElistaIvanor",
  "version": "2026-08-20T08:00:00+03:00",
  "slot": "08:00",
  "suppliers": {
    "shinservice": {
      "key": "shinservice",
      "label": "Шинсервис",
      "supplier": "Шинсервис",
      "ok": true,
      "tyres": {
        "action": "replace",
        "status": "ok",
        "items": [ /* записи как в IndexedDB */ ]
      },
      "discs": {
        "action": "replace",
        "status": "ok",
        "items": [ /* записи как в IndexedDB */ ]
      }
    }
  }
}
```

Команды категорий:

- `replace` — заменить категорию поставщика переданными `items`;
- `keepPrevious` — оставить локальные данные, если предыдущего payload в snapshot нет;
- `purge` — подтверждённое очищение категории.

Пустой результат upstream не считается подтверждённым очищением. Функция сохраняет
предыдущий materialized payload и помечает поставщика как неуспешного. Благодаря этому
одиночный пустой ответ не удаляет каталог, а последний snapshot остаётся пригодным для
загрузки в чистую IndexedDB.

## 1. Bucket Object Storage

В консоли Yandex Cloud → Object Storage → создать бакет, например:

- имя: `tyres-discs-catalog-elista` (должно быть глобально уникальным)
- доступ: **закрытый** (чтение через API Gateway + SA)

Ключи появятся после первого sync.

CLI (пример):

```powershell
yc storage bucket create --name tyres-discs-catalog-elista --default-storage-class standard --max-size 0
```

## 2. Сервисный аккаунт

Нужны права:

| Роль | Зачем |
| --- | --- |
| `storage.editor` на бакет (или folder) | запись/чтение meta+snapshot функцией |
| `storage.viewer` на бакет для SA API Gateway | отдача meta/snapshot через Gateway |
| `serverless.functions.invoker` | Timer → функция |

Создайте **статический ключ доступа** к Object Storage для SA функции и сохраните Access Key / Secret Key.

## 3. Cloud Function

1. Создайте функцию `catalog-sync` (runtime Node.js 20, память ≥ 1024 МБ, timeout ≥ 300 с).
2. Привяжите сервисный аккаунт.
3. Env (обязательные):

| Переменная | Пример |
| --- | --- |
| `STORE_ID` | `ElistaIvanor` |
| `CATALOG_BUCKET` | `tyres-discs-catalog-elista` |
| `AWS_ACCESS_KEY_ID` | ключ SA |
| `AWS_SECRET_ACCESS_KEY` | секрет SA |
| `AWS_REGION` | `ru-central1` |
| `S3_ENDPOINT` | `https://storage.yandexcloud.net` |

URL поставщиков — **полные https://…** (не `/api/...`):

| Переменная | Альтернатива (как во фронте) |
| --- | --- |
| `SHINSERVICE_TYRES_URL` | `REACT_APP_SHINSERVICE_TYRES_URL` |
| `SHINSERVICE_DISCS_URL` | `REACT_APP_SHINSERVICE_DISCS_URL` |
| `SEMISOTNOV_TYRES_URL` | `REACT_APP_SEMISOTNOV_TYRES_URL` |
| `SEMISOTNOV_DISCS_URL` | `REACT_APP_SEMISOTNOV_DISCS_URL` |
| `FOURTOCHKI_TYRES_URL` | `REACT_APP_4TOCHKI_TYRES_URL` |
| `SHINASU_URL` | `REACT_APP_SHINASU_URL` |
| `VERSHINA_TYRES_URL` | `REACT_APP_VERSHINA_TYRES_URL` |
| `VERSHINA_DISCS_URL` | `REACT_APP_VERSHINA_DISCS_URL` |

Опционально:

| Переменная | Назначение |
| --- | --- |
| `UPSTREAM_TIMEOUT_MS` | таймаут fetch (по умолчанию 120000) |

### Сборка и деплой кода

```powershell
cd yandex\catalog-sync
npm install
.\deploy.ps1 -FunctionId <FUNCTION_ID>
```

Или вручную: `npm run pack` → `yc serverless function version create ... --entrypoint index.handler --source-path catalog-sync.zip`

## 4. Timer triggers (Europe/Moscow)

Создайте **4** триггера (cron в МСК) на одну функцию, payload = слот:

| Cron (MSK) | Payload |
| --- | --- |
| `0 8 * * *` | `08:00` |
| `30 9 * * *` | `09:30` |
| `0 12 * * *` | `12:00` |
| `0 15 * * *` | `15:00` |

В консоли: Trigger → Timer → timezone `Europe/Moscow` → invoke function → payload строка слота.

CLI (пример одного слота):

```powershell
yc serverless trigger create timer `
  --name catalog-sync-0800 `
  --cron-expression "0 8 * * *" `
  --timezone Europe/Moscow `
  --invoke-function-id <FUNCTION_ID> `
  --invoke-function-service-account-id <SA_ID> `
  --invoke-function-payload "08:00"
```

## 5. API Gateway

Маршруты добавлены в [`../supplier-proxy/apigw.yaml`](../supplier-proxy/apigw.yaml) (существующий proxy **не ломается**):

- `GET /v2/catalog/{storeId}/meta` → Object Storage `stores/{storeId}/meta.json`
- `GET /v2/catalog/{storeId}/snapshot` → Object Storage `stores/{storeId}/snapshot.json`

Перед деплоем шлюза подставьте:

- `CATALOG_BUCKET` (default в variables)
- `service_account_id` gateway с правом читать бакет

```powershell
.\yandex\supplier-proxy\deploy.ps1
.\yandex\catalog-sync\verify.ps1
```

Эквивалент для фронта:

- meta: `{GATEWAY}/v2/catalog/ElistaIvanor/meta`
- snapshot: `{GATEWAY}/v2/catalog/ElistaIvanor/snapshot`

## 6. Ручной invoke

```powershell
yc serverless function invoke --id <FUNCTION_ID> --data "{\"slot\":\"08:00\"}"
```

Смотрите логи функции: фильтр `catalog-sync-finish`.

## Локальная сборка без деплоя

```powershell
cd yandex\catalog-sync
npm install
npm run build
# dist/index.js — бандл для Cloud Function
```

Не ломает `yandex/supplier-proxy` и локальный `src/setupProxy.js`.
