# Skill: integra API backend da Swagger

Questa skill supporta lo sviluppo delle integrazioni backend basate sul file OpenAPI/Swagger presente nel repository.

## Attività principali
1. Leggi l'endpoint richiesto in `calcolatore_spese_swagger.json`.
2. Traduce le definizioni Swagger in tipi TypeScript e payload.
3. Crea o aggiorna i thunk in `src/features/<dominio>/api_calls.ts`.
4. Mappa le risposte alle entità usate dal frontend.
5. Applica i nuovi endpoint allo stato Redux in `*.slice.ts`.
6. Verifica eventuali headers o autenticazione Bearer richiesti.

## Best practice
- Preferisci un approccio DRY: non duplicare i tipi già definiti in `interfaces.ts`.
- I campi `Decimal` sono stringhe nel JSON: convertili in `Number` nel mapper dello slice.
- Se il backend fornisce nuovi oggetti, estendi i tipi e i dati solo dove serve.
- Mantieni l'accesso alle API centralizzato in `src/services/api.js`.
- Non esporre chiamate fetch native nei componenti quando esiste già un thunk.
- Fai corrispondere i nomi delle azioni Redux ai nomi delle operazioni backend in modo chiaro.

## Quando usare questa skill
- Nuove funzionalità che richiedono aggiunta di endpoint backend.
- Aggiornamenti al contratto API basati su nuove specifiche Swagger.
- Correzioni di endpoint non mappati o di parametri backend errati.
