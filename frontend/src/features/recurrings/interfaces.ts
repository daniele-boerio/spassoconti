export type tipoTransaction = "ENTRATA" | "USCITA" | "RIMBORSO";

export interface Recurring {
  id: string; // ID come stringa
  nome: string;
  importo: number;
  tipo: tipoTransaction;
  frequenza: string;
  prossima_esecuzione: string;
  attiva: true;
  conto_id: string;
  categoria_id: string;
  sottocategoria_id: string;
  tag_id: string;
  /** Dopo questa data non scatta più (YYYY-MM-DD); null = senza fine. */
  data_fine: string | null;
  /** Occorrenze che mancano (rate); null = illimitate. */
  rate_rimanenti: number | null;
  /** Bollette & co.: si registra a mano con l'importo vero. */
  importo_variabile: boolean;
  /** Rata di un debito: ogni esecuzione ne scala il residuo. */
  debito_id: string | null;
  creationDate: string;
  lastUpdate: string;
}

/** Campi del piano comuni a creazione e modifica. */
export interface RecurringPlan {
  data_fine?: string | null;
  rate_rimanenti?: number | null;
  importo_variabile?: boolean;
  debito_id?: string | null;
}

export interface RecurringsState {
  loading: boolean;
  recurrings: Recurring[];
  selectedRecurring: Recurring | null;
  filters: RecurringFilters;
}

export interface ExecuteRecurringParams {
  id: string;
  /** Importo vero di questa occorrenza: obbligatorio se è variabile. */
  importo?: number;
}

export interface CreateRecurringParams extends RecurringPlan {
  nome: string;
  importo: number;
  tipo: tipoTransaction;
  frequenza: string;
  prossima_esecuzione: string;
  attiva: true;
  conto_id: string;
  categoria_id?: string;
  sottocategoria_id?: string;
  tag_id?: string;
}

export interface UpdateRecurringParams extends RecurringPlan {
  id: string;
  nome?: string;
  importo?: number;
  tipo?: tipoTransaction;
  frequenza?: string;
  prossima_esecuzione?: string;
  attiva?: true;
  conto_id?: string;
  categoria_id?: string;
  sottocategoria_id?: string;
  tag_id?: string;
}

export interface DeleteRecurringParams {
  id: string;
}

export interface RecurringFilters {
  sort_by?: string[];
  nome?: string;
  tipo?: string;
  importo_min?: number;
  importo_max?: number;
  frequenza?: string;
  prossima_esecuzione_inizio?: string;
  prossima_esecuzione_fine?: string;
  attiva?: boolean;
  conto_id?: string[];
  categoria_id?: string[];
  sottocategoria_id?: string[];
  tag_id?: string[];
}
