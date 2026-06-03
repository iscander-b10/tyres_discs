## Yandex Cloud Function: `supplier-proxy`

### Что делает
- Публичный CORS-прокси для загрузки прайсов/выгрузок поставщиков из браузера (GitHub Pages).
- Принимает `GET /?url=https%3A%2F%2Fhost%2Fpath`.
- Защита от “открытого прокси/SSRF”: разрешены только домены из allowlist и только `http/https`, редиректы ограничены и проверяются на каждом шаге.

### Переменные окружения
- `ALLOWED_HOSTS`: CSV (`z34.ru,b2b.4tochki.ru`) или JSON-массив (`["z34.ru","b2b.4tochki.ru"]`). Если пусто — используются дефолты из проекта.
- `UPSTREAM_TIMEOUT_MS`: таймаут апстрима (по умолчанию `120000`).
- `MAX_REDIRECTS`: максимум редиректов (по умолчанию `5`).

### API Gateway
Ожидаемый внешний URL для фронта: `https://<ваш-api-gateway>.apigw.yandexcloud.net/?url=...`

