# Статус документации

Последняя проверка: **25 августа 2026 года**.

Статусы: **Не начато**, **В работе**, **Черновик**, **Требует проверки**, **Проверено по коду**, **Завершено**.

| Этап | Страница или группа | Статус | Замечания |
| --- | --- | --- | --- |
| 1. Исследование | План | Проверено по коду | `documentation-plan.md` |
| 2. Инфраструктура | VitePress, nav, Mermaid | Завершено | sidebar: справочник, dev, ADR 001–009, how-to demo snapshot |
| 3. Основы | `00-overview/**` | Проверено по коду | Product, constraints, glossary и 28 сценариев; публичное демо active |
| 4. Начало работы | `01-getting-started/**` | Проверено по коду | install (`demo:freeze`), config (`REACT_APP_DEMO_*_URL`), deploy |
| 5. Архитектура | `02-architecture/**` | Проверено по коду | Demo URL + frozen snapshot, не stub |
| 6–12 | Модульные разделы `03`–`10` | Проверено по коду | `/demo*` в маршрутах, AppShell, autosync, auth, shell UI |
| 13. Справочник кода | `13-code-reference/**` | Проверено по коду | `isDemo(pathname)`, DemoCatalogHost, 60 root test-файлов |
| 14. Dev guides | `14-development/**` | Проверено по коду | Включая `update-demo-snapshot.md` |
| 11–12 | testing + operations | Проверено по коду | Deep link `/demo` на GitHub Pages |
| 16. ADR | `adr/001`–`009` | Проверено по коду | ADR-009: demo URL + frozen snapshot |

## Проверки инфраструктуры

- [x] `npm run docs:check` — после публичного демо `/demo`
- [x] sidebar: справочник, разработка, ADR 001–009, how-to snapshot
- [x] nav: Справочник, Разработка, ADR
- [x] Mermaid на новых страницах
- [x] production-код и docs сверены по режиму A

## Новые разделы (этап завершения)

1. **Справочник кода** — индекс exports с связями на учебные страницы.
2. **Разработка и эксплуатация** — install, env, testing, how-to, troubleshooting, glossary.
3. **ADR** — 9 подтверждённых решений, включая публичное демо.

## Связанные страницы

- [План документации](/documentation-plan)
- [Справочник кода](/13-code-reference/)
- [ADR-009](/adr/009-demo-url-frozen-snapshot)
