/// <reference types="vite/client" />

// Variabili d'ambiente lette dal codice TS (le altre restano in services/api.js).
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
