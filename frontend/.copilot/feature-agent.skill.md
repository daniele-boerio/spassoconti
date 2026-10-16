# Skill: aggiungere nuove funzionalità

Questa skill è pensata per aiutare lo sviluppatore a implementare nuove funzionalità nel progetto seguendo le best practice del codice esistente.

## Definizione delle attività
1. Leggere il requisito della nuova funzionalità.
2. Controllare il file `calcolatore_spese_swagger.json` per individuare le API esposte, i metodi e i payload.
3. Creare o aggiornare a mano i tipi in `src/features/<dominio>/interfaces.ts` (non c'è generazione dei tipi).
4. Aggiungere i thunk in `src/features/<dominio>/api_calls.ts` con `createAsyncThunk`.
5. Aggiornare il relativo slice in `src/features/<dominio>/*_slice.ts` e lo stato iniziale.
6. Creare o estendere i componenti in `src/components/` e le pagine in `src/pages/`.
7. Usare `useAppDispatch` e `useAppSelector` per collegare la UI allo store.
8. Aggiungere eventuali traduzioni in `src/i18n/en.json` e `src/i18n/it.json`.
9. Verificare la coerenza con gli stili SASS e i token del design system (`src/styles/_tokens.scss`).
10. Eseguire `npm run typecheck`, `npm run lint` e `npm run test`; la logica pura va testata con Vitest in un `*.test.ts` accanto al file.

## Best practice nel progetto
- Le chiamate API passano tutte da `src/services/api.js`.
- Lo stato globale usa Redux Toolkit con `configureStore` in `src/store/store.ts`.
- Gli errori vengono gestiti dal `errorMiddleware` e dallo slice `src/features/error/error_slice.ts`.
- Il layout delle feature è modulare: ogni dominio ha la propria cartella sotto `src/features/`.
- Il frontend mantiene le traduzioni in due file JSON: `en.json` e `it.json`.
- La UI usa il kit di componenti interno in `src/components/*`. PrimeReact resta solo dove porta logica vera (date picker, dropdown con filtro, overlay) e nei dialog legacy; MUI non c'è.

## Esempi di richieste gestite
- "Aggiungi un nuovo endpoint per visualizzare un report mensile delle spese".
- "Estendi la pagina transazioni con un filtro per tag e categoria".
- "Crea una pagina di impostazioni budget con salvataggio backend".
- "Implementa una vista grafica per l'andamento delle ricorrenze".

## Cosa evitare
- Non introdurre logica business nel componente di presentazione.
- Non usare chiamate Axios dirette nei componenti se esiste già un thunk.
- Non generare file isolati fuori dalla struttura `src/features` senza una buona ragione.
- Non duplicare route o i18n keys già esistenti.
