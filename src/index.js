import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          fontFamily: "'Montserrat', sans-serif",
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
