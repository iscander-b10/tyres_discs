## Yandex Cloud Function: `supplier-proxy`

### Что делает
- Публичный CORS-прокси для загрузки прайсов/выгрузок поставщиков из браузера (GitHub Pages).
- Принимает `GET /?url=https%3A%2F%2Fhost%2Fpath`.
- Защита от “открытого прокси/SSRF”: разрешены только домены из allowlist и только `http/https`, редиректы ограничены и проверяются на каждом шаге.

### Переменные окружения
- `ALLOWED_HOSTS`: CSV (`z34.ru,b2b.4tochki.ru,api-b2b.pwrs.ru,duplo-s0.shinservice.ru`) или JSON-массив. Если пусто — используются дефолты из проекта (включая CDN домены картинок 4tochki и shinservice).
- `UPSTREAM_TIMEOUT_MS`: таймаут апстрима (по умолчанию `120000`).
- `MAX_REDIRECTS`: максимум редиректов (по умолчанию `5`).

### API Gateway

Спецификация: [`apigw.yaml`](apigw.yaml).

- Маршрут `GET /?url=...` — облачная функция (мелкие файлы: shina.su, shinservice).
- Маршруты `/b2b/{path+}`, `/z34/{path+}`, `/vershina/{path+}` — прямой HTTP-прокси (большие файлы, без лимита CF).

Ожидаемый внешний URL для фронта: `https://<ваш-api-gateway>.apigw.yandexcloud.net`

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

