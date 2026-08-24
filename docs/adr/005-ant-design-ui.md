# ADR-005: Ant Design как UI-библиотека

## Статус

**Принято** — `antd` ^5.27, ConfigProvider в `index.js`.

## Контекст

Нужны формы поиска, modal login, layout, table-like lists, pagination, messages — быстро и единообразно.

## Проблема

Выбор component library для internal staff tool.

## Рассмотренные варианты

Исторические альтернативы (MUI, custom CSS only, Tailwind) **не зафиксированы**.

## Принятое решение

Ant Design 5 с `ConfigProvider`, русская locale, theme tokens через `getAntdTheme(appearance)` для light/dark.

## Причины

- Rich Form/Select/Modal для search parameters
- Consistent spacing and accessibility baseline
- Theme customization API

## Плюсы

- Быстрая разработка forms/filters
- Built-in validation messages
- Dark mode via algorithm/tokens

## Минусы

- Bundle size
- Visual «Ant look» без custom design system
- SCSS coexists for catalog cards

## Последствия

- Новые UI — предпочитать Ant primitives
- Custom catalog cards — SCSS + Ant where fits
- Theme switch persists in localStorage

## Связанные файлы

- `src/index.js` — ConfigProvider, App
- `src/theme/appearance.js` — `getAntdTheme`
- `src/components/**` — Form, Modal, Button, Select, …

## Связанные страницы

- [UI каталога](/10-ui/catalog-components)
- [Тема и shell](/10-ui/theme-and-shell-components)
