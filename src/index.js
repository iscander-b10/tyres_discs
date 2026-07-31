import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif",
          colorPrimary: '#595d60',
          colorLink: '#273036',
          colorText: '#273036',
          colorTextSecondary: '#595d60',
          colorBorder: '#e6e8ea',
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f4f5f6',
          borderRadius: 8,
          controlHeight: 40,
          fontSize: 14,
        },
        components: {
          Button: {
            primaryShadow: 'none',
            defaultShadow: 'none',
            fontWeight: 600,
          },
          Card: {
            borderRadiusLG: 12,
          },
          Tabs: {
            inkBarColor: '#e43141',
            itemSelectedColor: '#273036',
            itemHoverColor: '#273036',
            itemActiveColor: '#273036',
          },
          Switch: {
            colorPrimary: '#595d60',
            colorPrimaryHover: '#45494c',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
