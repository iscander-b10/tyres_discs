import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import {
  applyAppearance,
  getAntdTheme,
  getInitialAppearance,
  runAppearanceTransition,
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

  const handleAppearanceChange = (nextAppearance) => {
    if (nextAppearance === appearance) return;

    runAppearanceTransition(() => {
      applyAppearance(nextAppearance);
      flushSync(() => {
        setAppearance(nextAppearance);
      });
    });
  };

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
      <App appearance={appearance} onAppearanceChange={handleAppearanceChange} />
    </ConfigProvider>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
