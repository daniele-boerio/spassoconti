import {
  createAsyncThunk,
  ThunkDispatch,
  UnknownAction,
} from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  Transaction,
  PaginatedResponse,
  PaginationParams,
  CreateTransactionParams,
  UpdateTransactionParams,
  DeleteTransactionParams,
  LastTransactionsParams,
} from "./interfaces";
import { RootState } from "../../store/store";
import {
  getCurrentMonthExpenses,
  getCurrentMonthExpensesByCategory,
  getConti,
} from "../conti/api_calls";
import { showError } from "../error/error_slice";
import { saveFile } from "../../services/save_file";
import { t } from "../../i18n";
import {
  isNetworkError,
  isTransientStatus,
  newIdempotencyKey,
  QUEUED_OFFLINE,
  QueuedTransaction,
  sendableOf,
} from "./offline_queue";

/**
 * Ricarica budget e grafico del mese dopo una scrittura sulle transazioni.
 *
 * Il flag "includi ricorrenti future" non serve passarlo: `getCurrentMonthExpenses`
 * lo prende dallo store quando il chiamante non ne impone uno.
 */
const refreshMonthlyTotals = async (
  dispatch: ThunkDispatch<RootState, unknown, UnknownAction>,
) => {
  await dispatch(getCurrentMonthExpenses());
  await dispatch(getCurrentMonthExpensesByCategory());
};

/** I filtri dei Movimenti come query string: liste ripetute chiave per chiave. */
const appendFilters = (
  params: URLSearchParams,
  filters: RootState["transaction"]["filters"],
) => {
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v.toString()));
      } else {
        params.append(key, value.toString());
      }
    }
  });
};

/**
 * Scarica i movimenti filtrati come CSV (stessi filtri della lista).
 *
 * Il file non passa dallo store — un Blob non è serializzabile — ma va dritto
 * all'utente: sul telefono con il foglio di condivisione (Salva in File,
 * Numbers, Mail…), altrove come download.
 */
export const exportTransactions = createAsyncThunk<
  void,
  void,
  { state: RootState }
>("export/transazioni", async (_, { getState, rejectWithValue }) => {
  try {
    const params = new URLSearchParams();
    appendFilters(params, getState().transaction.filters);

    const response = await api.get<Blob>(
      `/transazioni/export?${params.toString()}`,
      { responseType: "blob" },
    );

    const today = new Date().toISOString().slice(0, 10);
    await saveFile(response.data, `movimenti_${today}.csv`, "text/csv");
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore export movimenti");
  }
});

/**
 * Le ultime N transazioni, per la card "Ultimi movimenti" della Home.
 *
 * Non passa dai filtri dei Movimenti: quelli ora vivono nell'URL e
 * sopravvivono all'uscita dalla pagina, per cui ereditarli qui vorrebbe dire
 * mostrare in Home i movimenti di un periodo scelto altrove.
 */
export const getLastTransactions = createAsyncThunk<
  Transaction[],
  LastTransactionsParams
>("transazioni/getLastTransactions", async ({ n }, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams();
    params.append("n", n.toString());

    const response = await api.get<Transaction[]>(
      `/transazioni?${params.toString()}`,
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore ricezione ultime transazioni",
    );
  }
});

/**
 * Una transazione sola, con il saldo del conto subito dopo. Non passa dallo
 * slice: la usa il foglio di dettaglio, e riguarda solo lui.
 */
export const getTransaction = createAsyncThunk<Transaction, { id: string }>(
  "transazioni/getTransaction",
  async ({ id }, { rejectWithValue }) => {
    try {
      const response = await api.get<Transaction>(`/transazioni/${id}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione transazione",
      );
    }
  },
);

/**
 * I filtri con cui è partita una richiesta della lista, come stringa: lo slice
 * accoda una pagina solo se i filtri sono ancora quelli (vedi fulfilled).
 */
export const filtersKey = (filters: RootState["transaction"]["filters"]) =>
  JSON.stringify(filters);

export const getTransactionsPaginated = createAsyncThunk<
  PaginatedResponse & { filtersKey: string },
  PaginationParams
>(
  "transazioni/getTransactionsPaginated",
  async ({ page, size }, { getState, rejectWithValue }) => {
    try {
      const params = new URLSearchParams();

      // Aggiungiamo i parametri di paginazione
      params.append("page", page.toString());
      params.append("size", size.toString());

      const state = getState() as RootState;
      appendFilters(params, state.transaction.filters);

      const response = await api.get<PaginatedResponse>(
        `/transazioni/paginated?${params.toString()}`,
      );
      return { ...response.data, filtersKey: filtersKey(state.transaction.filters) };
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione transazioni paginate",
      );
    }
  },
);

export const getTransactionsByCategory = createAsyncThunk<
  Transaction[],
  {
    categoria_id?: string | null;
    sottocategoria_id?: string | null;
    tag_id?: string | null;
    data_inizio?: string;
    data_fine?: string;
    tipo?: string;
  }
>(
  "transazioni/getTransactionsByCategory",
  async (
    { categoria_id, sottocategoria_id, tag_id, data_inizio, data_fine, tipo },
    { rejectWithValue },
  ) => {
    try {
      const params = new URLSearchParams();
      if (categoria_id) params.append("categoria_id", categoria_id);
      if (sottocategoria_id)
        params.append("sottocategoria_id", sottocategoria_id);
      if (tag_id) params.append("tag_id", tag_id);
      if (data_inizio) params.append("data_inizio", data_inizio);
      if (data_fine) params.append("data_fine", data_fine);
      if (tipo) params.append("tipo", tipo);

      // Niente slash prima di `?`: la rotta è `/transazioni`, e su `/transazioni/`
      // FastAPI risponde con un redirect in http che il browser (in https)
      // blocca — a schermo diventava "Server non raggiungibile".
      const response = await api.get<Transaction[]>(
        `/transazioni?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione transazioni per categoria",
      );
    }
  },
);

export const createTransaction = createAsyncThunk<
  Transaction, // Tipo restituito dal thunk
  CreateTransactionParams, // Tipo dei parametri in ingresso
  { state: RootState } // Dichiariamo che vogliamo accedere al RootState
>(
  "transazioni/createTransazione",
  async (params, { getState, dispatch, rejectWithValue }) => {
    // Senza chiave dal chiamante ne generiamo una: serve comunque alla coda
    // offline per non duplicare quando riprova.
    const { idempotencyKey = newIdempotencyKey(), ...body } = params;

    try {
      // 1. Facciamo la chiamata API standard
      const response = await api.post<Transaction>(`/transazioni`, body, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const newTx = response.data;

      // 2. Accediamo allo stato globale dell'app tramite getState()
      const state = getState();

      // 3. Troviamo la categoria corrispondente nello slice delle categorie
      // Usiamo String() per sicurezza, nel caso ci siano discrepanze tra string e number
      const categoriaTrovata = state.categoria.categorie.find(
        (c) => String(c.id) === String(newTx.categoria_id),
      );

      const enrichedTx = {
        ...newTx,
        categoria: {
          id: newTx.categoria_id,
          nome: categoriaTrovata ? categoriaTrovata.nome : "Uncategorized",
        },
      } as Transaction;

      // Aggiorniamo i dati del budget e del grafico dopo la creazione
      await refreshMonthlyTotals(dispatch);

      return enrichedTx;
    } catch (error) {
      // Nessuna risposta: il movimento resta sul telefono e parte appena
      // torna la rete (vedi offline_queue.ts e flushOfflineTransactions).
      if (isNetworkError(error)) {
        const item: QueuedTransaction = {
          key: idempotencyKey,
          owner: getState().profile.username ?? null,
          params: body,
          queuedAt: new Date().toISOString(),
        };
        return rejectWithValue({ ...QUEUED_OFFLINE, item });
      }

      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore creazione transazione",
      );
    }
  },
);

/**
 * Invia i movimenti salvati senza rete, uno alla volta e nell'ordine in cui
 * sono stati inseriti.
 *
 * - inviato (o già arrivato in un tentativo precedente: lo dice la chiave di
 *   idempotenza) → esce dalla coda;
 * - rifiutato dal server con un 4xx definitivo → resta in coda segnato come
 *   rifiutato (non riparte da solo) e l'errore si mostra; dal banner l'utente
 *   sceglie Riprova o Elimina. Prima veniva buttato via;
 * - rete assente o errore passeggero (5xx, 401, 408, 409, 429) → resta, si
 *   conta il tentativo e ci si ferma qui fino alla prossima.
 *
 * Non sta sotto il prefisso "transazioni/" apposta: non deve accendere lo
 * spinner della lista mentre lavora in sottofondo.
 */
export const flushOfflineTransactions = createAsyncThunk<
  {
    sent: { key: string; transaction: Transaction }[];
    failed: { key: string; status: number; detail: string | null }[];
    attempt: { key: string; reason: string } | null;
  },
  void,
  { state: RootState }
>(
  "offline/flushTransactions",
  async (_, { getState, dispatch }) => {
    const state = getState();
    const queue = sendableOf(
      state.transaction.pending,
      state.profile.username ?? null,
    );

    const sent: { key: string; transaction: Transaction }[] = [];
    const failed: { key: string; status: number; detail: string | null }[] = [];
    let attempt: { key: string; reason: string } | null = null;

    flushing = true;
    try {
      for (const item of queue) {
        try {
          const response = await api.post<Transaction>(
            `/transazioni`,
            item.params,
            { headers: { "Idempotency-Key": item.key } },
          );
          sent.push({ key: item.key, transaction: response.data });
        } catch (error) {
          if (isNetworkError(error)) {
            attempt = { key: item.key, reason: "network" };
            break;
          }

          const status = (error as AxiosError).response?.status ?? 0;
          if (isTransientStatus(status)) {
            attempt = { key: item.key, reason: `HTTP ${status}` };
            break;
          }

          // Il body è già normalizzato da services/api.js: `detail` è leggibile.
          const detail =
            (error as AxiosError<{ detail?: string }>).response?.data?.detail ??
            null;
          failed.push({ key: item.key, status, detail });
          dispatch(
            showError({
              title: t("offline_rejected_title"),
              message: [item.params.descrizione, detail]
                .filter(Boolean)
                .join(" — "),
            }),
          );
        }
      }
    } finally {
      flushing = false;
    }

    if (sent.length > 0) {
      await dispatch(getConti());
      await refreshMonthlyTotals(dispatch);
    }

    return { sent, failed, attempt };
  },
  {
    // Un invio alla volta: due flush in parallelo manderebbero le stesse voci
    // (innocuo grazie alla chiave, ma inutile). Un flush scartato qui non è un
    // errore: l'errorMiddleware ignora i rejected per `condition`.
    condition: (_, { getState }) =>
      !flushing &&
      sendableOf(
        getState().transaction.pending,
        getState().profile.username ?? null,
      ).length > 0,
  },
);

/** C'è un invio della coda offline in corso (vedi `condition` qui sopra). */
let flushing = false;

export const updateTransaction = createAsyncThunk<
  Transaction,
  UpdateTransactionParams,
  { state: RootState }
>(
  "transazioni/updateTransazione",
  async (params, { dispatch, rejectWithValue }) => {
    try {
      // Estraiamo l'id e raccogliamo tutto il resto in 'body'
      const { id, ...body } = params;

      const response = await api.put<Transaction>(`/transazioni/${id}`, body);

      await refreshMonthlyTotals(dispatch);

      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore update transazione");
    }
  },
);

export const deleteTransaction = createAsyncThunk<
  string,
  DeleteTransactionParams,
  { state: RootState }
>(
  "transazioni/deleteTransaction",
  async (params, { dispatch, rejectWithValue }) => {
    try {
      await api.delete<void>(`/transazioni/${params.id}`);

      await refreshMonthlyTotals(dispatch);

      return params.id;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore eliminazione transazione",
      );
    }
  },
);

export const splitTransaction = createAsyncThunk<
  { sourceId: string; parts: Transaction[] },
  {
    id: string;
    parts: Array<{
      importo: number | string;
      categoria_id?: string | null;
      sottocategoria_id?: string | null;
      tag_id?: string | null;
      descrizione?: string | null;
      debito_id?: number | null;
    }>;
  },
  { state: RootState }
>(
  "transazioni/splitTransazione",
  async ({ id, parts }, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.post<Transaction[]>(
        `/transazioni/${id}/split`,
        { parts },
      );

      // Refresh key data
      await dispatch(getConti());
      await refreshMonthlyTotals(dispatch);

      return { sourceId: id, parts: response.data };
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore split transazione");
    }
  },
);
