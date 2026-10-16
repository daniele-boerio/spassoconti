---
name: full-stack-feature
description: Guided vertical slice for a feature that spans backend and frontend — a new/changed endpoint plus its API contract and the React wiring. Use when a request touches both backend/ and frontend/ (e.g. "add a monthly budget endpoint and a settings page", "let transactions be filtered by tag end-to-end"). Coordinates the BE → contract → FE flow that the single-side agents don't.
---

# Full-stack feature (BE → contract → FE)

Most real requests cross the seam between `backend/` and `frontend/`. This skill drives the slice
end to end and keeps the contract honest at the join. Detailed rules live in
`backend/CLAUDE.md` and `frontend/CLAUDE.md`; the agents `be-endpoint-builder`,
`api-contract-sync`, `fe-feature-builder` hold the per-side checklists. This is the
sequence.

## Phase 0 — Frame it

State the domain, the endpoint(s), and the request/response shapes in one or two
sentences. Say whether the DB schema changes. Note the FE folder for the domain —
not always the Italian name (`transazioni` → `features/transactions`, `ricorrenze` →
`features/recurrings`, `tag` → `features/tags`, `user` → `features/profile`).

## Phase 1 — Backend

1. `backend/schemas/<dominio>.py` — Create / Update / Out (money `Decimal`, quantized).
2. `backend/models.py` + Alembic migration **if** the DB changes; read the generated script.
3. Logic in `backend/services.py`; thin endpoint in `backend/routers/<dominio>.py`, registered in
   `main.py` if new. Every query user-scoped; `deleted_at.is_(None)` on conti/transazioni.
4. Test in `backend/tests/` and run `venv/Scripts/python.exe -m pytest -q` from `backend/`.

## Phase 2 — Contract

5. Re-export the spec from `backend/` without a server:
   `venv/Scripts/python.exe -c "import json, main; json.dump(main.app.openapi(), open('../frontend/calcolatore_spese_swagger.json','w',encoding='utf-8'), indent=2, ensure_ascii=False)"`
   — keep the committed `servers` block, then check `git diff` in `frontend/` shows only the
   intended change. FE types are hand-written (no generation): they move in Phase 3.

## Phase 3 — Frontend

6. `features/<dominio>/interfaces.ts` — params, entity (money as string on the wire),
   state.
7. `api_calls.ts` — thunk through the shared `api`; `URLSearchParams`; `rejectWithValue`.
8. Slice — reducers/selectors; money string→`Number` in the mapper.
9. UI on `src/components/*` and token variables; global sheets via `openSheet` +
   `SheetHost`; write flows `.unwrap()` before toast/close and block double submit;
   i18n keys in **both** `en.json` and `it.json`.
10. Pure derivations get a co-located Vitest test. From `frontend/`: `npm run typecheck`,
    `npm run lint`, `npm run test`.

## Phase 4 — Verify the seam

Trace one concrete value (e.g. an `importo`) from DB `Decimal` → JSON string → FE
`Number` → rendered `<Amount>`, and confirm user-scoping and soft-delete hold on the
new route. Hand the diffs to `diff-reviewer`. Report the real results of both test
suites; one commit at the repo root covers both sides of the slice.
