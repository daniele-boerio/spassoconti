# FE — React 19 + TypeScript + Vite

SPA for the Calcolatore Spese app. Redux Toolkit state, an in-house component kit
on design tokens (`src/styles/_tokens.scss`, light/dark), Axios for I/O, SCSS for
styling, i18n (it/en). PrimeReact remains only where it carries real logic (date
picker, filtered dropdown, overlays) and in legacy dialogs not yet redesigned. There
is no MUI. Charts are hand-drawn SVG/CSS on the design tokens (see
`pages/charts_page`, `features/statistics/trend.ts`) — no chart library: inside a
canvas the theme custom properties do not resolve.

## Anatomy of a domain (`src/features/<dominio>/`)

Folder names are not all Italian: `transactions`, `recurrings`, `tags`, `profile`,
`home`, `ui`, `error` sit next to `conti`, `categorie`, `debiti`, `investimenti`,
`statistics`, `charts`, `bank_proposals`. Use the existing folder for a domain.

Each domain is a vertical slice with the same three files, plus pure helpers
(`group.ts`, `budget.ts`, `derive.ts`, …) with co-located Vitest `*.test.ts`:

- `api_calls.ts` — `createAsyncThunk` thunks. **All** HTTP goes through the shared
  Axios instance `import api from "../../services/api"` — never call `axios`/`fetch`
  directly. Catch as `AxiosError` and `rejectWithValue(err.response?.data || "msg")`.
- `<dominio>_slice.ts` — `createSlice`; mutate state in `extraReducers`. Cross-domain
  pending/rejected handling is done with `addMatcher` on the action-type prefix.
- `interfaces.ts` — request param types, entity types, and the `<Dominio>State` shape.

Store is in `src/store/store.ts`. **Always** use the typed hooks
`useAppDispatch` / `useAppSelector` (exported there), and read state through the
`select*` selectors exported by each slice — never reach into `state.x.y` ad hoc in a
component.

## Hard rules (learned from the existing code)

- **Money values arrive as strings** (BE `Decimal`) and are converted to `Number` in
  the slice via a `mapTransaction`-style mapper before they reach the UI. Keep that
  boundary: do not parse money in components.
- IDs may be string or number across the app; existing code compares with
  `String(a) === String(b)`. Follow that — don't assume numeric equality.
- Query params are built with `URLSearchParams`, appending array values one-by-one
  (see `getTransactionsPaginated`). Reuse that helper pattern for filtered lists.
- New user-facing text → add the key to **both** `src/i18n/en.json` and
  `src/i18n/it.json`. Never hardcode a visible string.
- Errors surface through `errorMiddleware` + the `error` slice; don't build ad-hoc
  error UI when a thunk rejection already flows there.
- UI: build on the in-house kit in `src/components/*` (`sheet`, `picker_sheet`,
  `button`, `list_row`, `card`, `amount`, `chip`, `segmented_control`, `toast`, …)
  and token variables (`var(--…)`, never literal colours). Don't add PrimeReact to
  redesigned screens.
- Icons are **Phosphor, bold weight**: `<i className="ph-bold ph-house" />` (CSS from
  `@phosphor-icons/web/bold`, loaded in `main.jsx`). PrimeIcons stays installed only for
  PrimeReact's own internals — don't use `pi pi-*` in app code. A spinning icon is
  `ph-bold ph-spinner icon-spin`.
- Labels above numbers/sections use the `v.eyebrow` mixin (sentence case, no
  uppercase tracking); page titles use `.page-title` (Instrument Serif); cards are
  separated by `v.$card-edge`, not shadows. UI strings are sentence case, no "!".
- Global sheets (new/edit transaction, detail, filters) open via
  `openSheet({ name, … })` from `features/ui/ui_slice` and mount once in
  `components/sheet_host`. A sheet opened by id must not assume the entity is in the
  store list (it only holds the loaded page/period): fetch it if missing.
- Write flows: `await dispatch(thunk(...)).unwrap()` before the success toast
  (`showToast`) and closing; disable the submit while in flight.

## Offline and repeated saves

- `createTransaction` sends an `Idempotency-Key` header (pass `idempotencyKey`, one
  per form opening, so a retry reuses it). Without network it rejects with
  `QUEUED_OFFLINE` and the slice stores the save in `pending` (localStorage):
  treat that rejection as "saved", show the `offline` toast and close the form.
- `useOfflineSync` (mounted in `App.jsx`) sends the queue on start, `online` and
  when the app returns to the foreground — iOS home-screen apps have no background
  sync. `PendingSyncBanner` shows what is still waiting.
- `public/sw.js` (registered only in production builds) caches the app shell,
  hashed assets and API GETs (network-first) so the app opens offline; the API cache
  is cleared on logout.
- Pages that keep their own list outside the store add
  `selectTransactionRevision` to their fetch effect so they refresh after writes.

## Types & the API contract

- TS types for the backend are **hand-written** in each `features/<dominio>/interfaces.ts`.
  There is no type generation.
- The authoritative contract is `calcolatore_spese_swagger.json` at the FE root. It's
  exported from the BE (see the `api-contract-sync` agent for the command); when an
  endpoint's shape changes, re-export it and update `interfaces.ts` + `api_calls.ts`.

## Don't

- Don't put business logic in presentational components — it belongs in the thunk/slice.
- Don't add a state library or data-fetching lib without being asked. Quality gates
  that now exist: `npm run typecheck` (tsc, strict), `npm run lint` (ESLint over JS+TS)
  and `npm run test` (Vitest) — run them after changes. ESLint keeps a batch of
  pre-existing react-hooks/`no-explicit-any` findings as **warnings** (tech-debt);
  don't let the count grow. CI (`.github/workflows/ci.yml`) runs all three plus
  `npm run build`. A formatter (prettier) is still intentionally not set up.
- Don't edit `vite.config.js` / `package.json` unless the task genuinely requires it.
- `App.jsx`, `main.jsx`, and `services/api.js` are intentionally JS — leave them JS.
