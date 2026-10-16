import { PeriodPreset } from "./period";
import type { QueuedTransaction } from "./offline_queue";

export interface PaginationParams {
  page: number;
  size: number;
  /**
   * Accoda i risultati invece di sostituirli: è il "carica altri" della lista
   * Movimenti, che tiene a schermo le pagine già scorse.
   */
  append?: boolean;
}

export interface LastTransactionsParams {
  n: number;
}

export type tipoTransaction =
  | "ENTRATA"
  | "USCITA"
  | "RIMBORSO"
  | "RICARICA"
  | "ACCANTONAMENTO";

export interface Transaction {
  id: string; // ID come stringa
  data: string;
  descrizione: string;
  importo: number;
  importo_netto: number | null;
  tipo: tipoTransaction;
  conto_id: string;
  conto_destinazione_id?: string | null;
  categoria_id: string;
  sottocategoria_id: string;
  tag_id: string;
  parent_transaction_id: string;
  /** Saldo del conto subito dopo: lo riempie solo `GET /transazioni/{id}`. */
  saldo_dopo?: number | null;
  creationDate: string;
  lastUpdate: string;
}

export interface PaginatedResponse {
  data: Transaction[];
  total: number;
  page: number;
  size: number;
  total_entrata: number;
  total_uscita: number;
  total_rimborsi: number;
}

export interface TransactionsState {
  loading: boolean;
  /** Periodo scelto nei Movimenti; le date che ne derivano stanno in `filters`. */
  period: PeriodPreset;
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  /** Movimenti salvati senza rete, in attesa di invio (vedi offline_queue.ts). */
  pending: QueuedTransaction[];
  /**
   * Sale a ogni scrittura riuscita (crea, modifica, elimina, dividi, invio
   * della coda). Le pagine che tengono una lista propria, fuori dallo store,
   * lo mettono fra le dipendenze del caricamento per non restare indietro.
   */
  revision: number;
  pagination: {
    total: number | null;
    page: number | null;
    size: number | null;
    total_incomes?: number | null;
    total_expenses?: number | null;
    total_compensation?: number | null;
  };
  filters: TransactionsFilters;
}

export interface CreateTransactionParams {
  importo: number;
  tipo: tipoTransaction;
  data: string;
  descrizione: string | null;
  conto_id: string;
  conto_destinazione_id?: string | null;
  categoria_id: string | null;
  sottocategoria_id: string | null;
  tag_id: string | null;
  parent_transaction_id: string | null;
  /**
   * Una per salvataggio, inviata come header `Idempotency-Key`: lo stesso
   * salvataggio ripetuto (rete caduta, coda offline) non crea doppioni.
   */
  idempotencyKey?: string;
}

export interface UpdateTransactionParams {
  id: string;
  importo: number | null;
  tipo: tipoTransaction | null;
  data: string | null;
  descrizione: string | null;
  conto_id: string | null;
  conto_destinazione_id?: string | null;
  categoria_id: string | null;
  sottocategoria_id: string | null;
  tag_id: string | null;
  parent_transaction_id: string | null;
}

export interface DeleteTransactionParams {
  id: string;
}

export interface TransactionByTagParams {
  tagId: string;
}

/**
 * Filtri come li accetta il BE. Conti, categorie, sottocategorie e tag sono
 * liste: `TransazioneFilters` li dichiara `List[int]` e li applica con una
 * clausola IN, quindi la selezione multipla dello sheet dei filtri non
 * richiede nulla di nuovo lato server.
 */
export interface TransactionsFilters {
  sort_by?: string[];
  importo_min?: number;
  importo_max?: number;
  tipo?: string;
  data_inizio?: string;
  data_fine?: string;
  descrizione?: string;
  /** Solo le transazioni a cui manca la categoria (`categoria_id IS NULL`). */
  senza_categoria?: boolean;
  conto_id?: string[];
  categoria_id?: string[];
  sottocategoria_id?: string[];
  tag_id?: string[];
}
