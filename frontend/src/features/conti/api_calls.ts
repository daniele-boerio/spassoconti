import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  Conto,
  MonthlyBudgetResponse,
  ExpenseByCategory,
  UpdateBudgetParams,
  CreateContoParams,
  UpdateContoParams,
  AbsorbContoParams,
  PatrimonioPoint,
  VerificaSaldo,
  DeleteContoParams,
  ImportStatementParams,
  ImportStatementResponse,
  ContoFilters,
  GetMonthExpensesParams,
  Institution,
  StartBankAuthParams,
  BankAuthLink,
  ConfirmBankSessionParams,
  BankSessionResult,
  DisconnectBankParams,
} from "./interfaces";
import { RootState } from "../../store/store";

/**
 * Il totale del mese, con o senza le ricorrenti future.
 *
 * Il flag non è un parametro come gli altri: è una preferenza dell'utente che
 * vive nello store. Chi non lo passa non sta chiedendo il default del BE
 * (`false`) — non gli interessa, e basta. Se lo lasciassimo cadere, ogni
 * schermata che ricarica la card del mese senza ripassarlo riporterebbe il
 * conto a "senza ricorrenti", con la spunta in Impostazioni ancora accesa:
 * era esattamente il sintomo. Perciò il valore di riserva lo prendiamo da qui.
 */
export const getCurrentMonthExpenses = createAsyncThunk<
  MonthlyBudgetResponse,
  GetMonthExpensesParams | undefined,
  { state: RootState }
>(
  "conti/getCurrentMonthExpenses",
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const includeFutureRecurring =
        params?.include_future_recurring ??
        getState().conto.include_future_recurring;

      const queryParams = new URLSearchParams();
      queryParams.append(
        "include_future_recurring",
        String(includeFutureRecurring),
      );

      const response = await api.get<MonthlyBudgetResponse>(
        `/conti/currentMonthExpenses?${queryParams.toString()}`,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione spese mensili",
      );
    }
  },
);

export const updateBudget = createAsyncThunk<
  MonthlyBudgetResponse,
  UpdateBudgetParams,
  { state: RootState }
>("conti/monthlyBudget", async (params, { getState, rejectWithValue }) => {
  try {
    // Aggiornamento parziale: obiettivo di risparmio e tetto di spesa si
    // impostano da due controlli separati e il BE legge solo i campi presenti,
    // quindi mandiamo solo quelli passati. Un `null` esplicito cancella.
    const body: UpdateBudgetParams = {};
    if ("total_budget" in params) body.total_budget = params.total_budget;
    if ("monthly_spending_budget" in params)
      body.monthly_spending_budget = params.monthly_spending_budget;

    // La risposta è la card del mese ricalcolata e va a sostituire quella nello
    // store: senza il flag tornerebbe indietro il risparmio, come se la spunta
    // fosse spenta. Stessa preferenza di getCurrentMonthExpenses.
    const queryParams = new URLSearchParams({
      include_future_recurring: String(
        getState().conto.include_future_recurring,
      ),
    });

    const response = await api.put<MonthlyBudgetResponse>(
      `/monthlyBudget?${queryParams.toString()}`,
      body,
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore modifica budget");
  }
});

export const getCurrentMonthExpensesByCategory = createAsyncThunk<
  ExpenseByCategory[],
  void
>("conti/getExpensesByCategory", async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<ExpenseByCategory[]>(
      `/conti/expensesByCategory`,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore ricezione spese per categoria",
    );
  }
});

export const getConti = createAsyncThunk<Conto[], undefined>(
  "conti/getConti", // Nome più descrittivo
  async (_, { getState, rejectWithValue }) => {
    try {
      const params = new URLSearchParams();

      const state = getState() as RootState;
      const filters = state.conto.filters;

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            // Gestione corretta delle LISTE per FastAPI
            value.forEach((v) => params.append(key, v.toString()));
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await api.get<Conto[]>(`/conti?${params.toString()}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError<{ message: string }>;
      return rejectWithValue(err.response?.data || "Errore ricezione conti");
    }
  },
);

export const createConto = createAsyncThunk<Conto, CreateContoParams>(
  "conti/createConto",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<Conto>(`/conti`, params);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore creazione conto");
    }
  },
);

export const updateConto = createAsyncThunk<Conto, UpdateContoParams>(
  "conti/updateConto",
  async (params, { rejectWithValue }) => {
    try {
      const { id, ...body } = params;
      const response = await api.put<Conto>(`/conti/${id}`, body);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore aggiornamento conto",
      );
    }
  },
);

// --- Open Banking: collegamento del conto a una banca tramite Enable Banking ---

// Step 1: elenco delle banche (ASPSP) selezionabili (per mostrare loghi/nomi).
export const getInstitutions = createAsyncThunk<Institution[], string | undefined>(
  "openBanking/getInstitutions",
  async (country = "IT", { rejectWithValue }) => {
    try {
      const response = await api.get<Institution[]>(
        `/open-banking/institutions?country=${country}`,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione lista banche",
      );
    }
  },
);

// Step 2: avvia l'autorizzazione e restituisce l'URL verso la banca.
export const startBankAuth = createAsyncThunk<BankAuthLink, StartBankAuthParams>(
  "openBanking/startAuth",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<BankAuthLink>(`/open-banking/auth`, {
        conto_id: Number(params.conto_id),
        aspsp_name: params.aspsp_name,
        aspsp_country: params.aspsp_country,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore avvio collegamento bancario",
      );
    }
  },
);

// Step 5/6: la stretta di mano finale (scambia code + state per una sessione).
export const confirmBankSession = createAsyncThunk<
  BankSessionResult,
  ConfirmBankSessionParams
>("openBanking/confirmSession", async (params, { rejectWithValue }) => {
  try {
    const response = await api.post<BankSessionResult>(
      `/open-banking/sessions`,
      { state: params.state, code: params.code },
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore conferma collegamento bancario",
    );
  }
});

// Scollega il conto dalla banca; ritorna il conto aggiornato (senza connettore).
export const disconnectBank = createAsyncThunk<Conto, DisconnectBankParams>(
  "openBanking/disconnect",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.delete<Conto>(
        `/open-banking/link/${params.conto_id}`,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore scollegamento bancario",
      );
    }
  },
);

/**
 * Quante transazioni ha un conto. Serve alla conferma di eliminazione, che
 * deve dire quante righe sta per nascondere: la cancellazione è reversibile
 * sul BE, ma chi sbaglia conto deve capirlo prima di confermare, non dopo.
 *
 * Non finisce in nessun reducer: chi la chiama ne legge il risultato con
 * `.unwrap()` e lo mostra nell'alert.
 */
export const countContoTransactions = createAsyncThunk<
  number,
  DeleteContoParams
>("conti/countContoTransactions", async (params, { rejectWithValue }) => {
  try {
    const response = await api.get<{ total: number }>(
      `/transazioni/paginated?conto_id=${params.id}&size=1`,
    );

    return response.data?.total ?? 0;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore conteggio transazioni del conto",
    );
  }
});

/**
 * Unisce tutti i conti in quello di default: movimenti, ricorrenze, debiti e
 * saldi finiscono lì, gli altri conti vanno in soft-delete. Il server ritorna
 * il conto sopravvissuto.
 */
/**
 * Le foto mensili del patrimonio. La lista parte dal giorno in cui il BE ha
 * iniziato a scattarle: con meno di due mesi non c'è confronto da mostrare.
 */
export const getPatrimonio = createAsyncThunk<PatrimonioPoint[], void>(
  "conti/getPatrimonio",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<PatrimonioPoint[]>("/conti/patrimonio");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione patrimonio",
      );
    }
  },
);

/**
 * I conti il cui saldo non torna con i movimenti registrati: un controllo che
 * il BE fa anche ogni notte. Lista vuota = tutto in ordine.
 */
export const getVerificaSaldi = createAsyncThunk<VerificaSaldo[], void>(
  "conti/getVerificaSaldi",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<VerificaSaldo[]>("/conti/verifica-saldi");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore verifica dei saldi",
      );
    }
  },
);

/** Riporta il saldo di un conto a quello che dicono i movimenti. */
export const correggiSaldo = createAsyncThunk<Conto, { id: string }>(
  "conti/correggiSaldo",
  async ({ id }, { rejectWithValue }) => {
    try {
      const response = await api.post<Conto>(`/conti/${id}/correggi-saldo`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore correzione del saldo",
      );
    }
  },
);

export const consolidateConti = createAsyncThunk<Conto, void>(
  "conti/consolidateConti",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post<Conto>("/conti/consolida");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore unione dei conti",
      );
    }
  },
);

/**
 * Porta *tutti* i movimenti sul conto invisibile e leva di mezzo i conti veri.
 *
 * Il verso opposto di `absorbVirtualConto`: per chi le spese vuole segnarle e
 * basta, senza modellare da dove escono. Le transazioni non spariscono — cambia
 * solo il conto a cui puntano — ma quale stava su quale conto non si ricostruisce.
 */
export const moveAllToVirtualConto = createAsyncThunk<Conto, void>(
  "conti/moveAllToVirtualConto",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post<Conto>("/conti/rinuncia");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore spostamento dei movimenti",
      );
    }
  },
);

/**
 * Porta su un conto vero i movimenti rimasti sul conto virtuale: è il seguito
 * di "ho aperto il mio primo conto" per chi aveva già registrato qualcosa.
 */
export const absorbVirtualConto = createAsyncThunk<Conto, AbsorbContoParams>(
  "conti/absorbVirtualConto",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<Conto>(`/conti/${params.id}/assorbi`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore spostamento dei movimenti",
      );
    }
  },
);

export const deleteConto = createAsyncThunk<string, DeleteContoParams>(
  "conti/deleteConto",
  async (params, { rejectWithValue }) => {
    try {
      await api.delete<void>(`/conti/${params.id}`);
      return params.id;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore eliminazione conto");
    }
  },
);

// Importa un estratto conto (PDF, Excel o CSV): il BE ne estrae i movimenti e
// crea proposte PENDING, come una sincronizzazione bancaria. Ritorna gli esiti.
export const importStatement = createAsyncThunk<
  ImportStatementResponse,
  ImportStatementParams
>("conti/importStatement", async (params, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append("file", params.file);
    if (params.data_da) formData.append("data_da", params.data_da);
    if (params.data_a) formData.append("data_a", params.data_a);
    if (params.balance_column) formData.append("balance_column", "true");

    const response = await api.post<ImportStatementResponse>(
      `/conti/${params.conto_id}/bank-connector/import-statement`,
      formData,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore import estratto conto",
    );
  }
});
