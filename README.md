# Ivanor — каталог шин и дисков

Веб-приложение для поиска шин и дисков по прайсам поставщиков (Shinservice, 4tochki, Z34/Semisotnov, Shina.su, Vershina). Данные кэшируются в IndexedDB в браузере.

Стек: React (CRA) + Ant Design. Деплой фронта: GitHub Pages.

## Быстрый старт

```bash
npm install
npm start
```

Откроется [http://localhost:3000](http://localhost:3000).

Скопируйте `.env.example` → `.env` / правьте `.env.development` и `.env.production`. В dev URL вида `/api/...` проксируются через [`src/setupProxy.js`](src/setupProxy.js).

## Скрипты

| Команда | Назначение |
| --- | --- |
| `npm start` | Локальная разработка |
| `npm run build` | Production-сборка в `build/` |
| `npm run deploy` | Сборка и публикация на GitHub Pages |
| `npm test` | Тесты CRA |

## CORS в production

С GitHub Pages браузер не может ходить напрямую к API поставщиков. Для этого используется CORS-прокси в Yandex Cloud: [`yandex/supplier-proxy/`](yandex/supplier-proxy/).

В `.env.production` задайте публичный URL API Gateway:

```env
REACT_APP_CORS_PROXY=https://<ваш-api-gateway>.apigw.yandexcloud.net
```

Фронт сам добавляет префикс `/v2`. Старые пути шлюза закрыты (403) — после деплоя `apigw.yaml` клиенты со старым бандлом получают 403 на устаревшие маршруты.

Деплой и проверка прокси — см. [`yandex/supplier-proxy/README.md`](yandex/supplier-proxy/README.md).

## Автосинхронизация каталога (Yandex Object Storage)

По расписанию Cloud Function [`yandex/catalog-sync/`](yandex/catalog-sync/) пишет снимок прайсов в Object Storage. Фронт при старте и около `*:10` МСК (слот Timer + 10 мин) сверяет `meta` и при новой `version` подтягивает `snapshot` в IndexedDB.

В `.env` / `.env.production`:

```env
# Обычно тот же origin, что и CORS_PROXY (можно оставить пустым — возьмётся CORS_PROXY)
REACT_APP_CATALOG_API_BASE=https://<ваш-api-gateway>.apigw.yandexcloud.net
REACT_APP_STORE_ID=ElistaIvanor
```

Каталог на сайте подтягивается автоматически из Object Storage (без ручной кнопки). Локальный `setupProxy` и `supplier-proxy` не меняются по смыслу — только добавляются маршруты `/v2/catalog/...` в `apigw.yaml`.

Полный деплой функции, Timer, bucket и Telegram (опционально) — [`yandex/catalog-sync/README.md`](yandex/catalog-sync/README.md).

## Структура

- `src/components/` — UI (поиск шин/дисков, карточки, переключатель режима)
- `src/services/suppliers/` — адаптеры поставщиков и оркестратор загрузки
- `src/services/catalogSync/` — автосинхронизация снимка из Yandex
- `src/services/indexedDBService.js` — локальный кэш каталога
- `src/setupProxy.js` — dev-прокси `/api/...` → хосты поставщиков
- `yandex/supplier-proxy/` — production CORS-прокси (Yandex Cloud)
- `yandex/catalog-sync/` — Timer-синхронизация каталога → Object Storage
- `yandex/saas-api/` — отдельный SaaS API (мультиарендность), опционально
