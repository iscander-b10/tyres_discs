import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-mermaid-plugin';

const sidebar = [
  {
    text: 'О проекте',
    items: [
      { text: 'Главная', link: '/' },
      { text: 'Обзор проекта', link: '/00-overview/project-overview' },
      { text: 'Продукт и пользователи', link: '/00-overview/product-and-users' },
      { text: 'Карта сценариев', link: '/00-overview/user-scenarios' },
      { text: 'Ограничения и не-цели', link: '/00-overview/constraints-and-non-goals' },
      { text: 'Глоссарий', link: '/00-overview/glossary' },
    ],
  },
  {
    text: 'Начало работы',
    items: [
      { text: 'Установка и команды', link: '/01-getting-started/install-and-scripts' },
      { text: 'Конфигурация', link: '/01-getting-started/configuration' },
      { text: 'Разработка и публикация', link: '/01-getting-started/dev-production-deploy' },
    ],
  },
  {
    text: 'Архитектура',
    items: [
      { text: 'Контекст системы', link: '/02-architecture/system-context' },
      { text: 'Архитектурные границы', link: '/02-architecture/architectural-boundaries' },
      { text: 'Структура директорий', link: '/02-architecture/repository-layout' },
      { text: 'Frontend-слои', link: '/02-architecture/frontend-layers' },
      { text: 'Дерево провайдеров', link: '/02-architecture/frontend-provider-tree' },
      { text: 'Карта зависимостей', link: '/02-architecture/dependency-map' },
      { text: 'Владение состоянием', link: '/02-architecture/state-ownership' },
      { text: 'Сквозной поток данных', link: '/02-architecture/end-to-end-data-flow' },
      { text: 'Граница браузера и Yandex Cloud', link: '/02-architecture/browser-yandex-boundary' },
    ],
  },
  {
    text: 'Маршрутизация и оболочка',
    collapsed: true,
    items: [
      { text: 'Маршруты и вход', link: '/03-routing-shell/routes-and-login-modal' },
      { text: 'Состояние AppShell', link: '/03-routing-shell/app-shell-state' },
      { text: 'Две панели каталога', link: '/03-routing-shell/dual-mount-catalog' },
    ],
  },
  {
    text: 'Авторизация',
    collapsed: true,
    items: [
      { text: 'Клиентская модель', link: '/04-auth/client-auth-model' },
      { text: 'Сессия, crypto и workspace', link: '/04-auth/session-crypto-workspace' },
      { text: 'Гонки и выход', link: '/04-auth/races-and-logout' },
    ],
  },
  {
    text: 'Учебник: авторизация',
    items: [
      { text: '1. Клиентская модель и границы', link: '/04-auth/client-auth-model' },
      { text: '2. Сессия, crypto и workspace', link: '/04-auth/session-crypto-workspace' },
      { text: '3. Гонки, logout и корзина', link: '/04-auth/races-and-logout' },
      { text: '4. Маршруты и окно входа', link: '/03-routing-shell/routes-and-login-modal' },
    ],
  },
  {
    text: 'Каталог и IndexedDB',
    collapsed: true,
    items: [
      { text: 'Схема IndexedDB', link: '/05-catalog-storage/indexeddb-schema' },
      { text: 'Запросы, фильтры и facets', link: '/05-catalog-storage/queries-filters-facets' },
      { text: 'Жизненный цикл и миграция', link: '/05-catalog-storage/lifecycle-and-migration' },
    ],
  },
  {
    text: 'Синхронизация каталога',
    collapsed: true,
    items: [
      { text: 'Полный жизненный цикл', link: '/06-catalog-sync/catalog-lifecycle' },
      { text: 'Автосинхронизация frontend', link: '/06-catalog-sync/frontend-autosync' },
      { text: 'Протокол snapshot', link: '/06-catalog-sync/snapshot-protocol-validation' },
      { text: 'Блокировки и каналы', link: '/06-catalog-sync/locks-and-channels' },
      { text: 'Yandex catalog-sync', link: '/06-catalog-sync/yandex-catalog-sync' },
      { text: 'Хранение и выдача snapshot', link: '/06-catalog-sync/snapshot-storage-serving' },
      { text: 'Ошибки и восстановление', link: '/06-catalog-sync/error-recovery' },
    ],
  },
  {
    text: 'Поставщики',
    collapsed: true,
    items: [
      { text: 'Адаптеры', link: '/07-suppliers/supplier-adapters' },
      { text: 'Transformers', link: '/07-suppliers/transformers' },
      { text: 'Supplier proxy', link: '/07-suppliers/supplier-proxy' },
    ],
  },
  {
    text: 'Поиск и витрина',
    collapsed: true,
    items: [
      { text: 'Сквозной поток', link: '/08-search-showcase/end-to-end-flow' },
      { text: 'Поиск шин и дисков', link: '/08-search-showcase/tire-and-disc-search' },
      { text: 'Алгоритм showcase', link: '/08-search-showcase/showcase-selection' },
      { text: 'Защита от async-гонок', link: '/08-search-showcase/async-race-guards' },
    ],
  },
  {
    text: 'Учебник: поиск и витрина',
    items: [
      { text: '1. Сквозной поток (10 шагов)', link: '/08-search-showcase/end-to-end-flow' },
      { text: '2. Формы и фильтры IDB', link: '/08-search-showcase/tire-and-disc-search' },
      { text: '3. Алгоритм showcase', link: '/08-search-showcase/showcase-selection' },
      { text: '4. Защита от async-гонок', link: '/08-search-showcase/async-race-guards' },
      { text: '5. UI-компоненты каталога', link: '/10-ui/catalog-components' },
      { text: '6. Запросы и facets IDB', link: '/05-catalog-storage/queries-filters-facets' },
    ],
  },
  {
    text: 'Корзина',
    collapsed: true,
    items: [
      { text: 'Домен и хранение', link: '/09-cart/cart-domain-and-storage' },
      { text: 'Миграция и вкладки', link: '/09-cart/migration-and-multitab' },
      { text: 'Сверка с каталогом', link: '/09-cart/catalog-reconciliation' },
    ],
  },
  {
    text: 'Учебник: корзина',
    items: [
      { text: '1. Домен и хранение', link: '/09-cart/cart-domain-and-storage' },
      { text: '2. Миграция и вкладки', link: '/09-cart/migration-and-multitab' },
      { text: '3. Сверка с каталогом', link: '/09-cart/catalog-reconciliation' },
      { text: '4. UI и режим клиента', link: '/10-ui/basket-and-client-mode' },
      { text: '5. Logout и корзина', link: '/04-auth/races-and-logout' },
    ],
  },
  {
    text: 'Интерфейс',
    collapsed: true,
    items: [
      { text: 'Компоненты каталога', link: '/10-ui/catalog-components' },
      { text: 'Корзина и режим клиента', link: '/10-ui/basket-and-client-mode' },
      { text: 'Тема и оболочка', link: '/10-ui/theme-and-shell-components' },
    ],
  },
  {
    text: 'Учебник: жизненный цикл каталога',
    items: [
      { text: '1. Общий поток каталога', link: '/06-catalog-sync/catalog-lifecycle' },
      { text: '2. Получение данных поставщиков', link: '/07-suppliers/supplier-adapters' },
      { text: '3. Нормализация и transformers', link: '/07-suppliers/transformers' },
      { text: '4. Создание snapshot', link: '/06-catalog-sync/yandex-catalog-sync' },
      { text: '5. Хранение и выдача snapshot', link: '/06-catalog-sync/snapshot-storage-serving' },
      { text: '6. Клиентская синхронизация', link: '/06-catalog-sync/frontend-autosync' },
      { text: '7. Блокировки и вкладки', link: '/06-catalog-sync/locks-and-channels' },
      { text: '8. Устройство IndexedDB', link: '/05-catalog-storage/indexeddb-schema' },
      { text: '9. Запись каталога', link: '/05-catalog-storage/lifecycle-and-migration' },
      { text: '10. Чтение и поиск', link: '/05-catalog-storage/queries-filters-facets' },
      { text: '11. Валидация данных', link: '/06-catalog-sync/snapshot-protocol-validation' },
      { text: '12. Ошибки и восстановление', link: '/06-catalog-sync/error-recovery' },
    ],
  },
  {
    text: 'Справочник кода',
    collapsed: true,
    items: [
      { text: 'Обзор справочника', link: '/13-code-reference/' },
      { text: 'Компоненты', link: '/13-code-reference/components' },
      { text: 'Context и hooks', link: '/13-code-reference/context-and-hooks' },
      { text: 'Сервисы', link: '/13-code-reference/services' },
      { text: 'Доменные модули', link: '/13-code-reference/domain-modules' },
      { text: 'Утилиты и конфиг', link: '/13-code-reference/utilities' },
      { text: 'Yandex Cloud Functions', link: '/13-code-reference/yandex-functions' },
      { text: 'Тестовые наборы', link: '/13-code-reference/test-suites' },
    ],
  },
  {
    text: 'Разработка и эксплуатация',
    items: [
      { text: 'Установка и команды', link: '/01-getting-started/install-and-scripts' },
      { text: 'Переменные окружения', link: '/01-getting-started/configuration' },
      { text: 'Сборка и deploy', link: '/01-getting-started/dev-production-deploy' },
      { text: 'Тестирование', link: '/11-testing/test-strategy' },
      { text: 'Добавить компонент', link: '/14-development/add-new-component' },
      { text: 'Добавить поставщика', link: '/14-development/add-new-supplier' },
      { text: 'Изменить IndexedDB', link: '/14-development/change-indexeddb' },
      { text: 'Изменить catalog sync', link: '/14-development/change-catalog-sync' },
      { text: 'Обновить demo snapshot', link: '/14-development/update-demo-snapshot' },
      { text: 'GitHub Pages', link: '/12-operations/github-pages' },
      { text: 'Yandex Cloud', link: '/12-operations/yandex-runbook' },
      { text: 'Troubleshooting', link: '/14-development/troubleshooting' },
      { text: 'Глоссарий', link: '/00-overview/glossary' },
    ],
  },
  {
    text: 'Качество и эксплуатация',
    collapsed: true,
    items: [
      { text: 'Стратегия тестирования', link: '/11-testing/test-strategy' },
      { text: 'Каталог контрактов', link: '/11-testing/contract-catalog' },
      { text: 'GitHub Pages приложения', link: '/12-operations/github-pages' },
      { text: 'Yandex runbook', link: '/12-operations/yandex-runbook' },
      { text: 'Логи и диагностика', link: '/12-operations/logging-and-diagnostics' },
    ],
  },
  {
    text: 'План и решения',
    items: [
      { text: 'План документации', link: '/documentation-plan' },
      { text: 'Статус документации', link: '/documentation-status' },
      { text: 'Шаблон учебной страницы', link: '/page-template' },
      { text: 'ADR', link: '/adr/' },
      { text: '001 Client-only auth', link: '/adr/001-client-only-auth' },
      { text: '002 IndexedDB', link: '/adr/002-indexeddb-catalog' },
      { text: '003 Snapshot sync', link: '/adr/003-snapshot-sync' },
      { text: '004 GitHub Pages', link: '/adr/004-github-pages-spa' },
      { text: '005 Ant Design', link: '/adr/005-ant-design-ui' },
      { text: '006 Dual-mount catalog', link: '/adr/006-dual-mount-catalog' },
      { text: '007 Cart envelope v3', link: '/adr/007-cart-envelope-v3' },
      { text: '008 Web Locks и вкладки', link: '/adr/008-web-locks-multitab' },
      { text: '009 Demo URL и frozen snapshot', link: '/adr/009-demo-url-frozen-snapshot' },
    ],
  },
];

export default withMermaid(defineConfig({
  lang: 'ru-RU',
  title: 'Ivanor: учебник по проекту',
  description: 'Локальная техническая документация и учебник по архитектуре Ivanor',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,
  markdown: {
    lineNumbers: true,
  },
  mermaid: {
    theme: 'default',
  },
  themeConfig: {
    nav: [
      { text: 'Главная', link: '/' },
      { text: 'Обзор', link: '/00-overview/project-overview' },
      { text: 'Архитектура', link: '/02-architecture/system-context' },
      { text: 'Авторизация', link: '/04-auth/client-auth-model' },
      { text: 'Каталог', link: '/06-catalog-sync/catalog-lifecycle' },
      { text: 'Корзина', link: '/09-cart/cart-domain-and-storage' },
      { text: 'Сценарии', link: '/00-overview/user-scenarios' },
      { text: 'Поиск', link: '/08-search-showcase/end-to-end-flow' },
      { text: 'Справочник', link: '/13-code-reference/' },
      { text: 'Разработка', link: '/01-getting-started/install-and-scripts' },
      { text: 'ADR', link: '/adr/' },
      { text: 'Статус', link: '/documentation-status' },
    ],
    sidebar,
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
              modal: {
                displayDetails: 'Показать подробный список',
                backButtonTitle: 'Закрыть поиск',
                noResultsText: 'Ничего не найдено',
                resetButtonTitle: 'Сбросить поиск',
                footer: {
                  selectText: 'выбрать',
                  selectKeyAriaLabel: 'Enter',
                  navigateText: 'перейти',
                  navigateUpKeyAriaLabel: 'стрелка вверх',
                  navigateDownKeyAriaLabel: 'стрелка вниз',
                  closeText: 'закрыть',
                  closeKeyAriaLabel: 'Escape',
                },
              },
            },
          },
        },
      },
    },
    outline: {
      level: [2, 3],
      label: 'На странице',
    },
    docFooter: {
      prev: 'Предыдущая страница',
      next: 'Следующая страница',
    },
    darkModeSwitchLabel: 'Тема',
    lightModeSwitchTitle: 'Светлая тема',
    darkModeSwitchTitle: 'Тёмная тема',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Наверх',
    lastUpdated: {
      text: 'Проверено',
      formatOptions: {
        dateStyle: 'long',
      },
    },
  },
}));
