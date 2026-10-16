// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";

// Base PrimeReact, importata PRIMA di App: il CSS finisce nel bundle
// nell'ordine in cui i moduli vengono visitati, e i nostri override su token
// (App.scss + styles/_primereact.scss) devono venire dopo, non prima.
// Il tema lara ha i colori hard-coded e non segue le custom properties: da qui
// arriva solo la struttura, la palette la mettiamo noi.
import "primereact/resources/themes/lara-light-cyan/theme.css";
import "primereact/resources/primereact.min.css";
// PrimeIcons resta solo per l'interno dei componenti PrimeReact (frecce dei
// dropdown, calendario): le icone dell'app sono Phosphor, peso bold.
import "primeicons/primeicons.css";
import "@phosphor-icons/web/bold";

import PrimeReact from "primereact/api";

// Dove PrimeReact appoggia i suoi overlay nella pila.
//
// Pannelli dei dropdown, calendari e Dialog non stanno nel DOM del componente:
// finiscono in un portale su <body> con uno z-index che PrimeReact calcola da
// solo, partendo da queste basi. Le sue di serie (overlay 1000, modal 1100)
// stavano *sotto* ai livelli nostri, e tutto quello che PrimeReact apriva da
// dentro un bottom sheet finiva disegnato dietro al foglio: nel rimborso non si
// apriva un solo dropdown, e i chip "Dividi" e "Rendi ricorrente" sembravano
// non fare niente.
//
// La scala, dal basso: tab bar 900, toast 1100, sheet 1200, PrimeReact 1400,
// alert 1500 (la conferma sta sopra a tutto). I numeri nostri stanno nei
// rispettivi .scss; questi sono solo le *basi* da cui PrimeReact parte —
// l'annidamento se lo gestisce lui, un overlay aperto dentro una Dialog
// riparte dall'ultimo z-index assegnato, non dalla base.
PrimeReact.zIndex = {
  overlay: 1400,
  menu: 1400,
  modal: 1400,
  tooltip: 1400,
  // La nostra di toast è un'altra (components/toast, 1100): questa resta solo
  // per non lasciare un buco nella configurazione.
  toast: 1400,
};

import App from "./App";

import { Provider } from "react-redux";
import { store } from "./store/store.ts";
import ErrorBoundary from "./components/error_boundary/error_boundary";
import { installErrorLog } from "./services/error_log";
import {
  clearApiCache,
  registerServiceWorker,
} from "./services/service_worker";

// Prima di ogni altra cosa: da qui in poi console.error, gli errori non
// catturati e le promise rifiutate finiscono anche in un registro che la
// schermata di errore sa copiare negli appunti. Su un iPhone in standalone
// è l'unico modo di far uscire uno stack senza collegare il telefono.
installErrorLog();

// Offline: guscio dell'app e ultimi dati visti restano disponibili senza rete.
registerServiceWorker();

// Al logout i dati salvati per l'offline se ne vanno con la sessione.
let wasAuthenticated = store.getState().profile.isAuthenticated;
store.subscribe(() => {
  const isAuthenticated = store.getState().profile.isAuthenticated;
  if (wasAuthenticated && !isAuthenticated) clearApiCache();
  wasAuthenticated = isAuthenticated;
});

// L'ErrorBoundary sta il più in alto possibile, fuori da App: un errore in
// fase di render — tipicamente un chunk di pagina che non si scarica — senza
// nessuno che lo catturi fa smontare a React l'intera radice, e `#root` resta
// un div vuoto. Cioè la schermata bianca da cui, con l'app in home su iPhone,
// si esce solo chiudendo e riaprendo.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Provider>
  </React.StrictMode>,
);

// `createRoot` svuota già #root al primo render, e con lui la schermata
// d'avvio di index.html. Questa riga è la cintura di sicurezza: se quel
// comportamento cambiasse, #boot — che è `position: fixed; inset: 0` —
// resterebbe sopra a tutta l'app. Dopo il primo frame, quindi senza buchi.
requestAnimationFrame(() => document.getElementById("boot")?.remove());
