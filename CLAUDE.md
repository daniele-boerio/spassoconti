# SpassoConti — Monorepo (root)

Personal finance app ("SpassoConti"). One git repository, two sides:

- `frontend/` — React 19 + TypeScript + Vite SPA, served by nginx in production.
- `backend/` — FastAPI + SQLAlchemy + PostgreSQL API.

> Each side has detailed conventions in `frontend/CLAUDE.md` and `backend/CLAUDE.md` —
> Claude loads the matching one automatically when you work inside that folder.
> History of both former repos (`calcolatore-spese-FE`, `calcolatore-spese-BE`) is
> preserved here: `git log --follow` works across the move into the subfolders.

## How it runs in production (Coolify, Docker Compose)

Same shape as the other projects (dietAI, smart-armadio, movie-recommender):

- `docker-compose.yml` at the root, deployed by Coolify as **one** application.
- `frontend` is the only service with a public domain (`conti.spassocasa.it`).
  nginx serves the SPA and forwards every `/api/*` request, path unchanged, to the
  `backend` service on the internal Docker network.
- `backend` has no public domain. Every route lives under `/api` (`API_PREFIX` in
  `backend/main.py`); `GET /api/health` checks the database and is the container
  healthcheck — a BE that cannot reach Postgres is *unhealthy*, not "healthy with 500s".
- PostgreSQL is a **separate** Coolify resource (`SpassoConto-DB`), not in the compose.
  `DB_HOST` must be the DB container's internal name, never the host IP: the DB's
  public port is closed.
- The refresh-token cookie is scoped to `/api/auth` on the app's own host.

## What lives where

| Concern | Location |
| --- | --- |
| API contract (source of truth) | `frontend/calcolatore_spese_swagger.json` (OpenAPI), exported from the BE; FE types are hand-written in `interfaces.ts` |
| Frontend domains | `frontend/src/features/<dominio>/` (some folders in English: `transactions`, `recurrings`, `tags`, `profile`) |
| Backend endpoints | `backend/routers/<dominio>.py` (mounted under `/api` in `main.py`) |
| Backend business logic | `backend/services.py` (single module) |
| DB models / migrations | `backend/models.py`, `backend/alembic/versions/` |
| Deploy | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` |
| CI | `.github/workflows/backend.yml`, `.github/workflows/frontend.yml` |

Domains are named in Italian and must stay aligned across both sides:
`conti`, `categorie`, `sottocategorie`, `transazioni`, `tag`, `investimenti`,
`ricorrenze`, `debiti`, `statistics`, `charts`, `user`/`auth`.

## Running the stack locally

```bash
# Backend (from backend/) — python is not on PATH, go through the venv
# (always `python -m`: the venv's .exe launchers fail silently on paths with a space)
venv/Scripts/python.exe -m uvicorn main:app --reload   # http://127.0.0.1:8000 — docs at /api/docs
venv/Scripts/python.exe -m alembic upgrade head        # apply migrations
venv/Scripts/python.exe -m pytest -q                   # tests (in-memory SQLite)

# Frontend (from frontend/)
npm run dev        # http://localhost:5173 — Vite proxies /api to the local BE
                   # (or to VITE_API_PROXY from frontend/.env, e.g. https://conti.spassocasa.it)
npm run typecheck  # tsc
npm run lint       # eslint
npm run test       # vitest
```

## Global working principles

- **Stay inside existing patterns.** This codebase is consistent; match the
  neighbouring file rather than introducing a new style or library.
- **Money is `Decimal` end-to-end on the BE**, converted to `Number` only at the
  FE slice boundary (see `mapTransaction`). Never do float math on money in Python.
- **Every BE query is user-scoped** (`... .filter(Model.user_id == current_user_id)`).
  A query that forgets this is a security bug — flag it. Conti and transazioni are
  soft-deleted (`deleted_at`): reads must exclude them.
- **Quality gates:** FE has `npm run typecheck` (tsc), `npm run lint` (ESLint over
  JS+TS) and `npm run test` (Vitest); BE has `pytest` (in-memory SQLite). Run the
  relevant ones after a change. GitHub Actions runs them on every push/PR that
  touches that side (`frontend.yml` also builds; `backend.yml` also checks there is a
  single Alembic head). Still **not** configured: a formatter
  (`prettier`/`black`/`ruff`) and pre-commit — don't claim those exist.
- **Balances are verified.** Every account keeps a `saldo_base` (balance minus the
  effect of its active transactions); a nightly job and `GET /api/conti/verifica-saldi`
  flag accounts where it moved. Any code that moves a balance goes through
  `services.applica_effetto_saldo`; any code that sets one by hand calls
  `allinea_saldo_base`. See `backend/CLAUDE.md`.
- **Creating a transaction is idempotent and works offline.** The FE sends an
  `Idempotency-Key` per save; without network the save goes to a local queue
  (`frontend/src/features/transactions/offline_queue.ts`) sent when the app is open again.
- A change that touches an endpoint's shape is a **contract change**: the BE router,
  the swagger JSON, and the FE `interfaces.ts` + `api_calls.ts` must move together —
  now in a single commit.

## Specialised helpers available

Subagents in `.claude/agents/` (invoke with the Agent tool):
- `fe-feature-builder` — Redux Toolkit feature work in `frontend/src/` on the in-house component kit.
- `be-endpoint-builder` — FastAPI routers, schemas, services, Alembic migrations.
- `api-contract-sync` — keep swagger ⇄ BE ⇄ FE types in sync.
- `diff-reviewer` — stack-aware review of an uncommitted diff.

Skill in `.claude/skills/`:
- `full-stack-feature` — a guided BE→contract→FE vertical slice (the cross-cutting
  flow the single-side agents do not cover).

Copilot has its own, parallel instructions in `frontend/.copilot/` and
`backend/.copilot/`; keep them consistent with these files when conventions change.
