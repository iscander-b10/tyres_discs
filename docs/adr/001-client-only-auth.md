# ADR-001: Client-only авторизация

## Статус

**Принято** — подтверждено кодом и [client-auth-model](/04-auth/client-auth-model).

## Контекст

Staff-приложение публикуется на GitHub Pages без dedicated auth backend. Нужно отделить guest landing от каталога/корзины и привязать local data к пользователю/магазину.

## Проблема

Как проверять «вход» без сервера сессий и без раскрытия пароля в bundle?

## Рассмотренные варианты

Исторические альтернативы в репозитории **не зафиксированы** (нет ADR, issues или комментариев о OAuth, Basic Auth на Gateway, или отдельном auth-сервисе).

## Принятое решение

Build-time HMAC verifier (`REACT_APP_AUTH_VERIFIER`) + runtime compare в `session.login`. Пароль хранится wrapped (AES-GCM) с ключом от device fingerprint. Workspace `{ accountId, storeId }` в React Context.

## Причины

- GitHub Pages — статический hosting
- Нет backend для cookie/session
- Достаточно для staff UI gate на доверенном устройстве

## Плюсы

- Простота deploy
- Offline restore сессии
- Привязка cart/IDB к account/store

## Минусы

- Verifier в bundle — offline brute-force по словарю
- DevTools обход client guards
- Нет серверной авторизации API Gateway / Object Storage

## Последствия

- Документировать как **ограничение**, не security boundary
- Облако защищается отдельно (IAM, closed bucket)
- Смена users → rebuild verifier

## Связанные файлы

- `scripts/generate-auth-verifier.js`
- `src/auth/session.js`, `crypto.js`, `AuthContext.jsx`
- `src/auth/useLogout.js`
- Tests: `session.test.js`, `crypto.test.js`, `AuthContext.test.jsx`

## Связанные страницы

- [Session crypto](/04-auth/session-crypto-workspace)
- [Ограничения](/00-overview/constraints-and-non-goals)
