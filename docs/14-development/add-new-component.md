# Добавление нового компонента

::: tip Статус: проверено по коду
Практическое руководство по conventions проекта.
:::

## Когда нужен новый компонент

- Новый экран или самостоятельный UI-блок с состоянием
- Переиспользуемый элемент каталога → `src/components/shared/`
- Host без UI → рядом с доменом (`*Host.jsx`)

## Шаги

### 1. Выберите место

| Тип | Путь |
| --- | --- |
| Страница | `src/components/MyPage/MyPage.jsx` |
| Shared UI | `src/components/shared/MyWidget/` |
| SCSS | рядом с `.jsx` |

### 2. Следуйте conventions

- **Ant Design** для форм, modal, button, layout
- Context через hooks (`useAuth`, `useCart`, `useAppShell`) — не prop drilling через 5 уровней
- SCSS module или co-located `.scss`
- default export для page/shared components

### 3. Подключите маршрут (если страница)

В `src/App.js`:

- добавьте path в `src/app/paths.js` если новый URL
- оберните в `RequireAuth` если staff-only
- учтите `ROUTER_BASENAME`

### 4. Состояние

| Данные | Где хранить |
| --- | --- |
| Auth, workspace | `AuthContext` — не дублировать |
| Cart | `CartContext` |
| Catalog version | `AppShellContext` |
| Form/search UI | локальный state компонента |
| Каталог items | IndexedDB через services |

### 5. Async и races

Если компонент делает async search/load:

- `requestIdRef` или abort pattern
- проверка workspace key после await
- см. [Race guards](/08-search-showcase/async-race-guards)

### 6. Тесты

- RTL test для user-visible behavior
- race test если async + setState после await
- положите рядом: `MyComponent.test.jsx`

### 7. Документация

- добавьте в [Справочник компонентов](/13-code-reference/components)
- ссылка на учебную страницу UI если блок крупный

## Пример skeleton

```jsx
import { Button } from 'antd';
import { useCart } from '../../cart/CartContext';

export default function MyWidget({ item, category }) {
  const { addItem } = useCart();
  return (
    <Button onClick={() => addItem(item, category)}>Добавить</Button>
  );
}
```

## Связанные страницы

- [Frontend layers](/02-architecture/frontend-layers)
- [UI каталога](/10-ui/catalog-components)
- [Справочник: компоненты](/13-code-reference/components)
