## Yandex Cloud Function: `supplier-proxy`

### Что делает
- Публичный CORS-прокси для загрузки прайсов/выгрузок поставщиков из браузера (GitHub Pages).
- Принимает `GET /v2?url=https%3A%2F%2Fhost%2Fpath`.
- Старые пути `/`, `/b2b`, `/z34`, `/vershina` отвечают 403 — чтобы открытые вкладки со старым JS не грузили прайсы.
- Защита от “открытого прокси/SSRF”: разрешены только домены из allowlist и только `http/https`, редиректы ограничены и проверяются на каждом шаге.

### Переменные окружения
- `ALLOWED_HOSTS`: CSV (`z34.ru,b2b.4tochki.ru,api-b2b.pwrs.ru,duplo-s0.shinservice.ru`) или JSON-массив. Если пусто — используются дефолты из проекта (включая CDN домены картинок 4tochki и shinservice).
- `UPSTREAM_TIMEOUT_MS`: таймаут апстрима (по умолчанию `120000`).
- `MAX_REDIRECTS`: максимум редиректов (по умолчанию `5`).

### API Gateway

Спецификация: [`apigw.yaml`](apigw.yaml).

- Маршрут `GET /v2?url=...` — облачная функция (мелкие файлы: shina.su, shinservice).
- Маршрут `GET /v2/metrics/load` — событие кнопки «Загрузить данные» (логи админа).
- Маршруты `/v2/b2b/{path+}`, `/v2/z34/{path+}`, `/v2/vershina/{path+}` — прямой HTTP-прокси (большие файлы, без лимита CF).

### Что смотреть в логах (не график Requests)

График **Requests** в мониторинге считает все вызовы функции, включая картинки карточек. Это не «кто пользуется кнопкой загрузки».

Нужные строки — в **Cloud Function → Логи**, по одной JSON-строке:

| `event` | Смысл |
| --- | --- |
| `load-start` | Нажали «Загрузить данные» |
| `load-finish` | Итог загрузки: `ok`, `suppliers`, `ip` |
| `proxy-error` / `blocked-host` | Сбой прокси |

Фильтр в логах: `load-finish`.

Пример успешной загрузки:

```json
{"event":"load-finish","loadId":"...","ip":"1.2.3.4","ok":true,"hadClientErrors":false,"hadSaveErrors":false,"suppliers":"shinservice:ok,semisotnov:ok,fourtochki:ok,shinasu:ok,vershina:ok"}
```

Уникальные пользователи за день: разные значения `ip` у строк `load-finish`.

Успешные картинки в логи **не пишутся**.

Ожидаемый внешний URL для фронта: `https://<ваш-api-gateway>.apigw.yandexcloud.net` (без `/v2` — фронт добавляет его сам).

Порядок выкладки этой правки логов:

1. Облачная функция: вставить новый `index.js` в консоль (Редактор → сохранить/выпустить версию).
2. Шлюз: `.\yandex\supplier-proxy\deploy.ps1` или вставить `apigw.yaml` в API Gateway.
3. Фронт: `npm run deploy`

Пока функция и шлюз не обновлены, кнопка загрузки работает как раньше, просто в логах ещё будет шум от картинок.

#### Деплой спецификации

```powershell
# один раз: yc init
.\yandex\supplier-proxy\deploy.ps1
```

Или через консоль Yandex Cloud: API Gateway → ваш gateway → Редактировать → вставить содержимое `apigw.yaml`.

#### Проверка после деплоя

```powershell
.\yandex\supplier-proxy\verify.ps1
```

Ожидается: b2b/z34/vershina — HTTP 200, размер > 1 МБ; z34 и vershina начинаются с `<?xml`.

