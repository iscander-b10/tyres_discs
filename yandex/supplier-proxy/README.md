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
- Маршруты `/v2/b2b/{path+}`, `/v2/z34/{path+}`, `/v2/vershina/{path+}` — прямой HTTP-прокси (большие файлы, без лимита CF).

Ожидаемый внешний URL для фронта: `https://<ваш-api-gateway>.apigw.yandexcloud.net` (без `/v2` — фронт добавляет его сам).

Порядок выкладки, чтобы сразу отрезать старые вкладки:

1. Сначала этот шлюз: `.\yandex\supplier-proxy\deploy.ps1`
2. Сразу после него фронт: `npm run deploy`

Пока шлюз уже новый, а фронт ещё старый, кнопка загрузки не работает ни у кого — это ожидаемо. После `npm run deploy` и обновления страницы загрузка снова работает у вас после входа.

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

