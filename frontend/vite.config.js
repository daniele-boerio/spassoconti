import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // NB: niente `manualChunks` manuale sui vendor. Splittare PrimeReact/React in
  // chunk separati creava una dipendenza circolare tra chunk → errore a runtime
  // "can't access lexical declaration before initialization" (TDZ). Lo splitting
  // automatico di Rollup garantisce l'ordine di init corretto; il code-splitting
  // per route (React.lazy in App.jsx) resta e separa comunque le pagine.
})
