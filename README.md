# SpassoConti

App per le finanze personali: conti, movimenti, categorie, ricorrenze, investimenti,
debiti, statistiche e Open Banking.

```
backend/              FastAPI + SQLAlchemy + Alembic (PostgreSQL)
frontend/             React + TypeScript + Vite, servito da nginx
docker-compose.yml    deploy su Coolify (frontend pubblico, backend interno)
```

## Produzione

Coolify pubblica `docker-compose.yml` come un'unica applicazione:

- **frontend** — dominio `https://conti.spassocasa.it`. nginx serve la SPA e gira al
  backend tutto ciò che inizia per `/api`.
- **backend** — nessun dominio pubblico. Healthcheck su `/api/health`, che verifica
  anche il database.
- **database** — risorsa Postgres separata su Coolify (`SpassoConto-DB`). Nelle
  Environment Variables `DB_HOST` è il nome interno del container del DB e
  `DB_PORT=5432`: la porta pubblica del DB è chiusa.

Le variabili da impostare su Coolify sono elencate nel servizio `backend` di
`docker-compose.yml` e spiegate in `backend/.env.example`. Le variabili
`ENABLE_BANKING_*` / `BANK_CONNECTOR_*` (connessione automatica dei conti) non
servono: la funzione non è in uso.

## Sviluppo in locale

```bash
# backend/
venv/Scripts/python.exe -m uvicorn main:app --reload   # :8000, docs su /api/docs
venv/Scripts/python.exe -m pytest -q

# frontend/
npm install
npm run dev    # :5173, /api va al backend locale (o a VITE_API_PROXY in frontend/.env)
```

Dettagli e convenzioni: `CLAUDE.md`, `backend/CLAUDE.md`, `frontend/CLAUDE.md`.
