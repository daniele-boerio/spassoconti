export interface MonthlyIncomeExpenseOut {
  label: string;
  entrate: number;
  uscite: number;
  accantonamento: number;
}

export interface MonthlySavingsOut {
  label: string;
  risparmio: number;
}

export interface ExpenseCompositionOut {
  categoria: string;
  totale: number;
  color?: string | null;
}

export interface CategoryTrendOut {
  label: string;
  spesa: number;
}

// Params Interfaces

/**
 * Periodo e filtri dell'Analisi: tutti e quattro i grafici guardano lo stesso
 * sottoinsieme delle viste Mese e Anno. Sono tutti facoltativi — chi vuole
 * l'intero periodo (la media per categoria della vista Mese, per esempio) li
 * lascia fuori.
 */
export interface ChartFilters {
  data_inizio?: string | null;
  data_fine?: string | null;
  categoria_id?: string | null;
  /** Ripetibile: il filtro ne accetta più d'una alla volta. */
  sottocategoria_id?: string[] | null;
  tag_id?: string | null;
}

export type GetIncomeExpenseParams = ChartFilters;

export type GetSavingsParams = ChartFilters;

export type GetExpenseCompositionParams = ChartFilters;

/** L'unico dove la categoria non è un filtro ma il soggetto del grafico. */
export interface GetCategoryTrendParams extends ChartFilters {
  categoria_id: string;
}

// State Interface
export interface ChartsState {
  incomeExpense: MonthlyIncomeExpenseOut[];
  savings: MonthlySavingsOut[];
  expenseComposition: ExpenseCompositionOut[];
  categoryTrend: CategoryTrendOut[];
  loading: boolean;
  error: string | null;
}
