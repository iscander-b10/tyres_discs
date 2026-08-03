import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import {
  applyAppearance,
  getAntdTheme,
  getInitialAppearance,
} from './theme/appearance';
import './index.css';

function Root() {
  const [appearance, setAppearance] = useState(() => {
    const initial = getInitialAppearance();
    applyAppearance(initial);
    return initial;
  });

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  return (
    <ConfigProvider
      locale={ruRU}
      theme={getAntdTheme(appearance)}
      tooltip={{
        classNames: {
          root: 'app-tooltip',
        },
      }}
    >
      <App appearance={appearance} onAppearanceChange={setAppearance} />
    </ConfigProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
