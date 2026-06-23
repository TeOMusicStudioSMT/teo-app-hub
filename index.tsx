
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'jotai';
import { KatedraRadioProvider } from './context/KatedraRadioContext';
import { I18nProvider } from './lib/i18n';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <KatedraRadioProvider>
      <Provider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </Provider>
    </KatedraRadioProvider>
  </React.StrictMode>
);