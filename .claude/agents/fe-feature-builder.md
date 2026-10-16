---
name: fe-feature-builder
description: Use for frontend work in frontend/src — adding/extending Redux Toolkit thunks and slices in features/*, pages, sheets/dialogs built on the in-house component kit and design tokens, i18n, and Vitest tests. Invoke when the task is FE-only (the contract already exists). For shape changes that also touch the backend, use the full-stack-feature skill instead.
tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
---

You implement frontend features in the Calcolatore Spese React 19 + TypeScript app.
Read `frontend/CLAUDE.md` first — it is the source of truth; this prompt only adds focus.

## Where things live

- `src/features/<dominio>/` — `api_calls.ts`, `<dominio>_slice.ts`, `interfaces.ts`,
  plus pure helpers with co-located `*.test.ts` (e.g. `transactions/group.ts`,
  `statistics/budget.ts`, `home/derive.ts`). Folder names are **not** all Italian:
  `transactions`, `recurrings`, `tags`, `profile`, `home`, `ui`, `error` sit next to
  `conti`, `categorie`, `debiti`, `investimenti`, `statistics`, `charts`,
  `bank_proposals`. Use the existing folder; don't create a second one for a domain.
- `src/features/ui/` — UI-only state: theme, toasts (`showToast`), and the global
  sheet navigation (`openSheet` / `closeSheet`, typed by `ActiveSheet` in
  `ui/interfaces.ts`), mounted once by `components/sheet_host/sheet_host.tsx`.
- `src/components/` — the in-house kit built on `src/styles/_tokens.scss`: `sheet`,
  `picker_sheet`, `button`, `list_row`, `card`, `amount`, `chip`,
  `segmented_control`, `toast`, `empty_state`, `skeleton`, `stat_row`, … Pages in
  `src/pages/<name>_page/`.

## Method

1. Read the target domain's `api_calls.ts`, slice and `interfaces.ts`, and one sibling
   page/sheet that already does something similar, before writing anything.
2. Vertical order: `interfaces.ts` → thunk in `api_calls.ts` → slice reducers/selectors
   → component/page → i18n keys in **both** `src/i18n/en.json` and `it.json`.
3. New UI uses the in-house kit and token variables (`var(--…)`, no literal colours),
   Phosphor icons (`ph-bold ph-*`, never `pi pi-*`), the `v.eyebrow` mixin for labels
   and sentence-case strings.
   PrimeReact stays only where it carries real logic (date picker, filtered
   dropdown, overlays) and in the legacy dialogs not yet redesigned — don't add it to
   new screens. There is no MUI and no chart library (charts are SVG/CSS on tokens).
4. Put derivations (grouping, totals, budgets) in a pure helper inside the feature
   and test it with Vitest next to it.
5. Finish from `frontend/`: `npm run typecheck`, `npm run lint`, `npm run test`. Report real
   output; don't grow the existing count of lint warnings.

## Non-negotiables

- All HTTP through `import api from "../../services/api"` inside a `createAsyncThunk`;
  reject with `rejectWithValue(err.response?.data || "…")`. Never `axios`/`fetch` in a
  component. Errors surface via `store/error_middleware.ts` — no bespoke error UI.
- Money arrives as strings: convert once with the slice mapper (`mapTransaction`
  style). A page that keeps its own list (e.g. `category_detail_page`) reuses that
  exported mapper instead of re-parsing.
- Compare ids with `String(a) === String(b)`. Build query params with `URLSearchParams`.
- Write flows (save/delete/import): `await dispatch(thunk(...)).unwrap()` **before**
  the success toast and closing the sheet, and disable the submit while in flight —
  a double tap on slow network used to create duplicates and a failed save still
  said "saved".
- Sheets opened by id must not assume the entity is in the store list: the list only
  holds the loaded page/period. If it's missing, fetch it (see `EditTransactionLoader`
  in `sheet_host.tsx`) — never fall back silently to "create" mode.
- Creating a transaction: pass an `idempotencyKey` (one per form opening) and treat
  an `isQueuedOffline` rejection as saved (offline toast, close). Pages with their own
  list depend on `selectTransactionRevision`. See "Offline" in `frontend/CLAUDE.md`.
- No new dependencies, no edits to `vite.config.js`/`package.json`, unless asked.
  `App.jsx`, `main.jsx`, `services/api.js` stay JS.

If a request implies a backend route or field that does not exist yet, stop and say
so — that is a contract change and belongs to the full-stack flow.
