
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'jotai';
import { KatedraRadioProvider } from './context/KatedraRadioContext';
import { I18nProvider } from './lib/i18n';
import { hydrateTunnelFromLocation, zapewnijKluczLokalnie } from './lib/bridgeService';
import { hydratujStadoZMostu } from './lib/stadoSync';
import { zainstalujPrzekierowanie } from './lib/trybKatedry';
import './index.css';

// 📡 Dispatch: `?tunnel=...` w adresie (kod QR z Katedry) → zapis tunelu przed startem UI.
// Czyta też klucz Straży z fragmentu `#k=…` i sprząta go z paska adresu.
hydrateTunnelFromLocation();

// 🛡️ Na maszynie Suwerena klucz Straży pobieramy z Mostu (wydaje go tylko żądaniom
// lokalnym). Świadomie BEZ `await` — brak Mostu nie może blokować startu Katedry,
// a wywołania i tak dołożą klucz, gdy tylko się pojawi.
void zapewnijKluczLokalnie();

// ☁️/🏠 Tryb Katedry: wywołania Ollamy z przeglądarki idą w trybie CLOUD przez most (lib/trybKatedry.ts).
zainstalujPrzekierowanie();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 🥚 Stado z mostu PRZED pierwszym renderem: komponenty czytają XP z localStorage przy
// montowaniu, więc most musi zdążyć je tam wpisać. Sufit 2,5 s — bez mostu Katedra
// startuje z tym, co ma przeglądarka, a synchronizacja dogania przy pierwszym zapisie.
const root = ReactDOM.createRoot(rootElement);
hydratujStadoZMostu().then((w) => {
  if (w.mostZywy && (w.zMostu.length || w.doMostu.length)) console.info(`[Stado] z mostu: ${w.zMostu.join(', ') || '—'} · do mostu: ${w.doMostu.join(', ') || '—'}`);
}).catch(() => { /* nigdy nie blokuj startu */ }).finally(() => {
  // XP za pracę stada (wkłady, zlecenia, sentencje) nalicza most — co minutę dociągamy je do
  // przeglądarki (wyższe XP wygrywa), żeby Dom i panele widziały nagrody bez restartu Katedry.
  setInterval(() => { void hydratujStadoZMostu(); }, 60_000);
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
});