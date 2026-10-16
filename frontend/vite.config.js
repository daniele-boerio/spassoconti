import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    // NB: niente `manualChunks` manuale sui vendor. Splittare PrimeReact/React in
    // chunk separati creava una dipendenza circolare tra chunk → errore a runtime
    // "can't access lexical declaration before initialization" (TDZ). Lo splitting
    // automatico di Rollup garantisce l'ordine di init corretto; il code-splitting
    // per route (React.lazy in App.jsx) resta e separa comunque le pagine.
    server: {
      // Come in produzione (nginx): l'API è sullo stesso origin, sotto /api.
      // Di default il backend locale (uvicorn su :8000); con VITE_API_PROXY nel
      // .env si può puntare un altro backend, es. https://conti.spassocasa.it.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
