import {
  createSelector,
  createSlice,
  PayloadAction,
  Action,
} from "@reduxjs/toolkit";
import {
  createTransaction,
  deleteTransaction,
  flushOfflineTransactions,
  getLastTransactions,
  getTransactionsPaginated,
  updateTransaction,
  splitTransaction,
} from "./api_calls";
import {
  PaginatedResponse,
  Transaction,
  TransactionsState,
} from "./interfaces";
import { RootState } from "../../store/store";
import { PeriodPreset, periodRange } from "./period";
import { DEFAULT_PERIOD } from "./filters_url";
import {
  dequeue,
  enqueue,
  isQueuedOffline,
  loadQueue,
  QueuedTransaction,
  saveQueue,
} from "./offline_queue";

const DEFAULT_SORT = ["data:desc", "lastUpdate:desc"];

const initialState: TransactionsState = {
  loading: false,
  transactions: [],
  selectedTransaction: null,
  pending: loadQueue(),
  revision: 0,
  period: DEFAULT_PERIOD,
  pagination: {
    total: null,
    page: null,
    size: null,
  },
  filters: {
    sort_by: DEFAULT_SORT,
    ...periodRange(DEFAULT_PERIOD),
  },
};

// --- HELPERS ---

// Converte i campi Decimal (stringhe) in Number per il frontend
export const mapTransaction = (tx: Transaction): Transaction => ({
  ...tx,
  importo: Number(tx.importo),
  importo_netto: tx.importo_netto !== null ? Number(tx.importo_netto) : null,
});

const sortTransactions = (a: Transaction, b: Transaction) => {
  const dateA = new Date(a.data).getTime();
  const dateB = new Date(b.data).getTime();
  if (dateA !== dateB) return dateB - dateA;

  const lastUpdateA = new Date(a.lastUpdate).getTime();
  const lastUpdateB = new Date(b.lastUpdate).getTime();
  if (lastUpdateA !== lastUpdateB) return lastUpdateB - lastUpdateA;

  const creationA = new Date(a.creationDate).getTime();
  const creationB = new Date(b.creationDate).getTime();
  if (creationA !== creationB) return creationB - creationA;

  return String(b.id).localeCompare(String(a.id));
};

/**
 * Inserisce movimenti nella lista in memoria, senza doppioni per id.
 *
 * Prima l'inserimento tagliava la lista alla dimensione di una pagina: chi
 * aveva già scrollato e caricato altre pagine se le vedeva sparire, e lo
 * scroll infinito perdeva il segno. La Home mostra comunque i primi N da sé.
 */
const insertTransactions = (state: TransactionsState, incoming: Transaction[]) => {
  const ids = new Set(incoming.map((tx) => String(tx.id)));
  state.transactions = [
    ...state.transactions.filter((tx) => !ids.has(String(tx.id))),
    ...incoming,
  ].sort(sortTransactions);
};

const handlePending = (state: TransactionsState) => {
  state.loading = true;
};

const handleRejected = (state: TransactionsState) => {
  state.loading = false;
};

const transactionsSlice = createSlice({
  name: "transactions",
  initialState,
  reducers: {
    updateFilters: (
      state,
      action: PayloadAction<Partial<TransactionsState["filters"]>>,
    ) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    /**
     * Sostituisce il blocco di filtri per intero. La usa il ripristino
     * dall'URL: una fusione lascerebbe in piedi i filtri della visita
     * precedente, che nell'indirizzo non ci sono più.
     */
    applyFilters: (
      state,
      action: PayloadAction<{
        period: PeriodPreset;
        filters: TransactionsState["filters"];
      }>,
    ) => {
      state.period = action.payload.period;
      state.filters = { sort_by: DEFAULT_SORT, ...action.payload.filters };
    },

    /**
     * Cambia periodo e ricalcola le date. "custom" non tocca `data_inizio` e
     * `data_fine`: le ha scelte l'utente.
     */
    setPeriod: (state, action: PayloadAction<PeriodPreset>) => {
      state.period = action.payload;

      if (action.payload === "custom") return;

      const range = periodRange(action.payload);
      state.filters.data_inizio = range.data_inizio;
      state.filters.data_fine = range.data_fine;
    },

    resetFilters: (state) => {
      state.period = DEFAULT_PERIOD;
      state.filters = {
        sort_by: DEFAULT_SORT,
        ...periodRange(DEFAULT_PERIOD),
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // GET LastTransactions
      .addCase(
        getLastTransactions.fulfilled,
        (state, action: PayloadAction<Transaction[]>) => {
          state.transactions = action.payload.map(mapTransaction);
        },
      )

      // GET TransactionsPaginated
      .addCase(getTransactionsPaginated.fulfilled, (state, action) => {
        // Le pagine oltre la prima si accodano: la lista dei Movimenti cresce
        // verso il basso invece di ripartire da capo.
        const loaded = action.payload.data.map(mapTransaction);

        // Accodando una pagina, una riga può essere già in lista: un movimento
        // inserito nel frattempo sposta tutte le altre di una posizione.
        if (action.meta.arg.append) insertTransactions(state, loaded);
        else state.transactions = loaded.sort(sortTransactions);
        state.pagination.total = action.payload.total;
        state.pagination.page = action.payload.page;
        state.pagination.size = action.payload.size;

        // Cast obbligatorio per i totali aggregati che arrivano come stringhe
        state.pagination.total_incomes = Number(action.payload.total_entrata || 0);
        state.pagination.total_expenses = Number(action.payload.total_uscita || 0);
        state.pagination.total_compensation = Number(
          action.payload.total_rimborsi || 0,
        );
      })

      .addCase(
        createTransaction.fulfilled,
        (state, action: PayloadAction<Transaction>) => {
          state.pagination.total = (state.pagination.total || 0) + 1;
          insertTransactions(state, [mapTransaction(action.payload)]);
        },
      )

      // Senza rete il movimento va in coda (vedi offline_queue.ts): la coda
      // vive anche in localStorage, così sopravvive alla chiusura dell'app.
      .addCase(createTransaction.rejected, (state, action) => {
        const payload = action.payload as
          | { item?: QueuedTransaction }
          | undefined;

        if (isQueuedOffline(payload) && payload?.item) {
          state.pending = enqueue(state.pending, payload.item);
          saveQueue(state.pending);
        }
      })

      .addCase(flushOfflineTransactions.fulfilled, (state, action) => {
        const { sent, dropped } = action.payload;

        for (const key of [...sent.map((item) => item.key), ...dropped]) {
          state.pending = dequeue(state.pending, key);
        }
        saveQueue(state.pending);

        if (sent.length > 0) {
          state.pagination.total = (state.pagination.total || 0) + sent.length;
          insertTransactions(
            state,
            sent.map((item) => mapTransaction(item.transaction)),
          );
        }
      })

      .addCase(
        splitTransaction.fulfilled,
        (
          state,
          action: PayloadAction<{ sourceId: string; parts: Transaction[] }>,
        ) => {
          const { sourceId, parts } = action.payload;

          // Remove original transaction if present
          state.transactions = state.transactions.filter(
            (t) => String(t.id) !== String(sourceId),
          );

          // Map and insert new parts
          insertTransactions(state, parts.map(mapTransaction));

          // Adjust total (remove original, add parts)
          if (
            state.pagination.total !== null &&
            state.pagination.total !== undefined
          ) {
            state.pagination.total =
              state.pagination.total - 1 + (parts ? parts.length : 0);
          }
        },
      )

      .addCase(
        updateTransaction.fulfilled,
        (state, action: PayloadAction<Transaction>) => {
          const updatedTx = mapTransaction(action.payload);
          const index = state.transactions.findIndex(
            (tran) => String(tran.id) === String(updatedTx.id),
          );

          if (index !== -1) {
            state.transactions[index] = updatedTx;
            state.transactions.sort(sortTransactions);
          }
        },
      )

      .addCase(
        deleteTransaction.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.transactions = state.transactions.filter(
            (tran) => String(tran.id) !== String(action.payload),
          );
          state.pagination.total = state.pagination.total
            ? state.pagination.total - 1
            : 0;
        },
      )

      // Ogni scrittura riuscita fa avanzare la revisione (vedi interfaces.ts)
      .addMatcher(
        (action: Action) =>
          [
            createTransaction.fulfilled.type,
            updateTransaction.fulfilled.type,
            deleteTransaction.fulfilled.type,
            splitTransaction.fulfilled.type,
            flushOfflineTransactions.fulfilled.type,
          ].includes(action.type),
        (state) => {
          state.revision += 1;
        },
      )

      // Matchers (invariati)
      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") &&
          action.type.startsWith("transazioni/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("transazioni/"),
        handleRejected,
      );
  },
});

export const selectTransactionLoading = (state: RootState) =>
  state.transaction.loading;

export const selectTransactionTransactions = (state: RootState) =>
  state.transaction.transactions;

export const selectTransactionSelectedTransaction = (state: RootState) =>
  state.transaction.selectedTransaction;

export const selectTransactionPagination = (state: RootState) =>
  state.transaction.pagination;

export const selectTransactionFilters = (state: RootState) =>
  state.transaction.filters;

export const selectTransactionPeriod = (state: RootState) =>
  state.transaction.period;

export const selectTransactionRevision = (state: RootState) =>
  state.transaction.revision;

/**
 * Movimenti salvati offline dall'utente collegato, in attesa di invio.
 * Memoizzato: un `filter` nudo darebbe un array nuovo a ogni lettura e
 * farebbe ridisegnare chi lo usa a ogni azione dello store.
 */
export const selectPendingTransactions = createSelector(
  [
    (state: RootState) => state.transaction.pending,
    (state: RootState) => state.profile.username ?? null,
  ],
  (pending, owner) => pending.filter((item) => item.owner === owner),
);

export const { updateFilters, applyFilters, setPeriod, resetFilters } =
  transactionsSlice.actions;

export default transactionsSlice.reducer;
