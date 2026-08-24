# ADR-004: Create React App и GitHub Pages

## Статус

**Принято** — `react-scripts`, `homepage`, `gh-pages` deploy.

## Контекст

Нужен SPA для staff без серверного рендеринга; хостинг — бесплатный static GitHub Pages.

## Проблема

Как собирать и публиковать React-приложение с client routing под subpath?

## Рассмотренные варианты

Исторические альтернативы (Vite, Next.js static export, Netlify) **не зафиксированы** в документации репозитория.

## Принятое решение

Create React App 5 + `homepage` URL + `BrowserRouter basename` + deploy через `gh-pages` с `404.html` SPA fallback и `.nojekyll`.

## Причины

- Стандартный CRA toolchain
- Простой gh-pages pipeline
- Совместимость с существующим Jest setup

## Плюсы

- Zero server maintenance
- Familiar React ecosystem
- Prebuild auth verifier hook

## Минусы

- CRA maintenance mode
- Build-time env only
- Subpath basename complexity

## Последствия

- `PUBLIC_URL` / basename обязателен в links
- Документация — отдельно VitePress (не gh-pages app)
- `predeploy` копирует index → 404

## Связанные файлы

- `package.json` — scripts, homepage
- `src/app/paths.js` — `ROUTER_BASENAME`
- `src/App.js` — BrowserRouter

## Связанные страницы

- [GitHub Pages](/12-operations/github-pages)
- [Установка](/01-getting-started/install-and-scripts)
