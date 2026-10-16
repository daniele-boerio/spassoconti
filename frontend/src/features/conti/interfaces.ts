// --- INTERFACCE ---

export interface Conto {
  id: string;
  nome: string;
  saldo: number;
  ricarica_automatica: boolean;
  budget_obiettivo?: number;
  soglia_minima?: number;
  conto_sorgente_id?: string;
  frequenza_controllo?: string;
  prossimo_controllo?: string;
  creationDate: string;
  lastUpdate: string;
  color: string;
  default: boolean;
  /**
   * Conto aperto dall'app, non dall'utente. Resta fuori dagli elenchi finché
   * è l'unico, e i movimenti che ci stanno sopra si leggono come "senza conto".
   */
  virtuale: boolean;
  /** corrente / salvadanaio / prepagata: decide la forma della card. */
  tipo?: string | null;
  // Open Banking: collegato quando bank_connector_account_id è valorizzato
  bank_connector_provider?: string | null;
  bank_connector_account_id?: string | null;
  bank_connector_institution_id?: string | null;
  bank_connector_last_sync?: string | null;
  bank_connector_last_error?: string | null;
}

/** Una foto mensile del patrimonio, come la manda il BE. */
/**
 * Un conto il cui saldo non torna con i movimenti (GET /conti/verifica-saldi).
 * Gli importi arrivano come stringhe Decimal e diventano Number nello slice.
 */
export interface VerificaSaldo {
  conto_id: string;
  nome: string;
  saldo: number;
  /** Il saldo che avrebbe se ogni movimento l'avesse mosso giusto. */
  saldo_atteso: number;
  differenza: number;
}

export interface PatrimonioPoint {
  label: string;
  conti: number;
  titoli: number;
  totale: number;
}

export interface ExpenseByCategory {
  label: string;
  value: number;
}

// `remaining` è il RISPARMIO del mese (entrate - uscite - accantonamenti), non
// il residuo del budget: è il BE a calcolarlo, il FE non lo ricalcola mai.
export interface MonthlyBudget {
  total_budget: number | null;
  percentage: number | null;
  remaining: number | null;
}

// Il tetto di spesa del mese: quanto l'utente si concede di spendere. Concetto
// distinto da `MonthlyBudget`, che è l'obiettivo di risparmio.
// `remaining` può essere negativo — è lo sforamento — ed è `null` finché un
// tetto non è stato impostato.
export interface MonthlySpending {
  budget: number | null;
  spent: number;
  /** Uscite ricorrenti attive non ancora scattate entro fine mese. */
  projected: number;
  remaining: number | null;
  percentage: number | null;
}

export interface BudgetUpdateData {
  total_budget?: number | null;
  monthly_spending_budget?: number | null;
}

// Struttura specifica della risposta API per il budget
// (GET /conti/currentMonthExpenses e PUT /monthlyBudget)
export interface MonthlyBudgetResponse {
  monthly_budget: {
    total_budget: number | null;
    percentage: number | null;
    remaining: number | null;
    period?: { start: string; end: string };
  };
  spending: {
    budget: number | null;
    spent: number;
    projected: number;
    remaining: number | null;
    percentage: number | null;
  };
  income: number;
  saved: number;
}

export interface ContoState {
  loading: boolean;
  conti: Conto[];
  selectedConto: Conto | null;
  monthlyBudget: MonthlyBudget;
  monthlySpending: MonthlySpending;
  /** Entrate e accantonamenti del mese, dalla stessa risposta del budget. */
  monthIncome: number;
  monthSaved: number;
  monthlyExpensesByCategory: ExpenseByCategory[];
  filters: ContoFilters;
  include_future_recurring: boolean;
  /** Foto mensili del patrimonio, dalla più vecchia alla più recente. */
  patrimonio: PatrimonioPoint[];
  /** Conti con il saldo fuori sincrono rispetto ai movimenti. Vuota = tutto ok. */
  saldiFuoriSincrono: VerificaSaldo[];
}

// Interfaccia per il payload di aggiornamento budget
export interface UpdateBudgetParams {
  total_budget?: number | null;
  monthly_spending_budget?: number | null;
}

export interface GetMonthExpensesParams {
  include_future_recurring?: boolean;
}

export interface CreateContoParams {
  nome: string;
  saldo: number;
  default: boolean;
  ricarica_automatica: boolean;
  budget_obiettivo?: number;
  soglia_minima?: number;
  conto_sorgente_id?: string;
  frequenza_controllo?: string;
  prossimo_controllo?: string;
}

export interface UpdateContoParams {
  id: string;
  nome?: string;
  saldo?: number;
  default?: boolean;
  ricarica_automatica?: boolean;
  budget_obiettivo?: number;
  soglia_minima?: number;
  conto_sorgente_id?: string;
  frequenza_controllo?: string;
  prossimo_controllo?: string;
}

export interface AbsorbContoParams {
  /** Il conto vero su cui portare i movimenti rimasti sul virtuale. */
  id: string;
}

export interface DeleteContoParams {
  id: string;
}

// --- Import estratto conto (PDF, Excel .xlsx o CSV) ---

export interface ImportStatementParams {
  conto_id: string;
  file: File;
  data_da?: string | null; // formato YYYY-MM-DD
  data_a?: string | null; // formato YYYY-MM-DD
  balance_column?: boolean; // rilevante solo per il PDF
}

export interface ImportStatementResponse {
  parsed: number; // movimenti riconosciuti (dopo il filtro date)
  new_proposals: number; // proposte PENDING create
  skipped: number; // scartati perché duplicati
}

export interface ContoFilters {
  sort_by?: string[];
  nome?: string;
  saldo_min?: number;
  saldo_max?: number;
  ricarica_automatica?: boolean;
}

// --- Open Banking (collegamento conto a banca via Enable Banking) ---

// Una banca (ASPSP): identificata da nome + paese, non da un singolo id.
export interface Institution {
  name: string;
  country: string;
  logo?: string;
}

export interface StartBankAuthParams {
  conto_id: string;
  aspsp_name: string;
  aspsp_country: string;
}

export interface BankAuthLink {
  url: string;
}

export interface ConfirmBankSessionParams {
  state: string;
  code: string;
}

export interface DisconnectBankParams {
  conto_id: string;
}

export interface BankSessionResult {
  conto_id: number;
  account_id: string;
  status: string;
}
