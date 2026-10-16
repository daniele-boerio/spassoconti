# Feature Agent per Calcolatore Spese

Questo agente aiuta a sviluppare nuove funzionalità per il frontend esistente, seguendo le convenzioni del repository.

## Compiti principali
- Analizza la feature richiesta e identifica il dominio corretto in `src/features/*`.
- Usa `src/services/api.js` per tutte le chiamate backend.
- Crea o estendi `api_calls.ts` con `createAsyncThunk` per nuove API.
- Mantiene lo stato condiviso tramite `createSlice` in `<dominio>_slice.ts`, convertendo i soldi da stringa a `Number` nel mapper.
- Nei flussi di salvataggio usa `.unwrap()` prima del toast di conferma e blocca il doppio invio.
- Usa `useAppDispatch` e `useAppSelector` nel componente per leggere e aggiornare lo stato.
- Organizza la UI in cartelle già esistenti: `components/*`, `components/dialog`, `pages/*`. Gli sheet globali si aprono con `openSheet` (`features/ui/ui_slice`) e vivono in `components/sheet_host`.
- Aggiorna le traduzioni in `src/i18n/en.json` e `src/i18n/it.json` per nuovi testi.
- Se la feature richiede una nuova pagina, aggiungi una route e un componente pagina coerente con le altre.

## Regole di stile
- Mantieni il codice in TypeScript/JSX moderno compatibile con React 19 e Vite.
- Evita refusi e nomi inconsistenti nelle azioni Redux.
- Rispetta la divisione logica tra chiamate API, slice e componenti di presentazione.
- Non modificare `vite.config.js` o `package.json` se non strettamente necessario.
- Usa il formato delle cartelle esistente per non rompere la struttura del progetto.
- A fine lavoro esegui `npm run typecheck`, `npm run lint` e `npm run test`.

## Quando usare questo agente
- Aggiunta di nuovi endpoint backend al frontend.
- Creazione di nuove pagine di gestione o viste dedicate.
- Estensione delle funzionalità esistenti in `categorie`, `conti`, `transactions`, `tags`, `investimenti`, `recurrings`.
- Implementazione di nuove interfacce sul kit di componenti interno (`sheet`, `list_row`, `card`, `amount`, …) e sui token del design system.
