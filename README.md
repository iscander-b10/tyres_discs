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

Деплой и проверка прокси — см. [`yandex/supplier-proxy/README.md`](yandex/supplier-proxy/README.md).

## Структура

- `src/components/` — UI (поиск шин/дисков, карточки, загрузка каталога)
- `src/services/suppliers/` — адаптеры поставщиков и оркестратор загрузки
- `src/services/indexedDBService.js` — локальный кэш каталога
- `src/setupProxy.js` — dev-прокси `/api/...` → хосты поставщиков
- `yandex/supplier-proxy/` — production CORS-прокси (Yandex Cloud)
- `yandex/saas-api/` — отдельный SaaS API (мультиарендность), опционально
