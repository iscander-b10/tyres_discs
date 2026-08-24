# ADR-006: Dual-mount панелей поиска

## Статус

**Принято** — `App.js` монтирует обе панели; tests `App.catalogDualMount.test.jsx`.

## Контекст

Два маршрута `/tyres` и `/wheels` с тяжёлыми формами и локальным state; пользователь переключается между ними часто.

## Проблема

Unmount при route change теряет form state, facets cache, showcase load.

## Рассмотренные варианты

- **Conditional mount** (только active route) — проще, но теряет state.
- Другие варианты (global URL state, single combined form) **не зафиксированы**.

## Принятое решение

Обе панели (`TiresSearchParameters`, `DiscsSearchParameters`) всегда в DOM. Неактивная: `hidden`, `inert`, `aria-hidden`. `isActive` prop управляет catch-up effects (refresh options, race guards).

## Причины

- Сохранение UX при переключении вкладок каталога
- Избежание повторного cold load showcase

## Плюсы

- Мгновенное переключение
- Меньше duplicate fetch при return

## Минусы

- Двойной memory footprint
- Два набора timers/effects (нужен `isActive` guard)
- Accessibility care (`inert`)

## Последствия

- Любой effect в SearchParameters должен respect `isActive`
- `sessionResetKey` сбрасывает обе панели при logout
- Tests на hidden/inert обязательны при изменении App shell

## Связанные файлы

- `src/App.js`
- `src/components/TiresSearchParameters/TiresSearchParameters.jsx`
- `src/components/DiscsSearchParameters/DiscsSearchParameters.jsx`
- `src/App.catalogDualMount.test.jsx`

## Связанные страницы

- [Dual-mount](/03-routing-shell/dual-mount-catalog)
