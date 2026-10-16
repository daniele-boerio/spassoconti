// --- INTERFACCE ---

export interface Investimento {
  id: string;
  isin?: string;
  ticker?: string;
  nome_titolo: string;
  quantita_totale: number | null;
  valore_posizione: number | null;
  prezzo_medio_carico: number | null;
  prezzo_attuale: number | null;
  data_ultimo_aggiornamento: string | null;
  storico: Operazione[];
}

export interface Operazione {
  id: string;
  data: string;
  quantita: number;
  prezzo_unitario: number;
  investimento_id: string;
  valore_attuale: number;
}

export interface InvestimentoState {
  loading: boolean;
  investimenti: Investimento[];
  selectedInvestimento: Investimento | null;
  filters: InvestimentoFilters;
}

export interface CreateInvestimentoParams {
  isin: string;
  ticker?: string;
  nome_titolo: string;
  quantita_iniziale: number;
  prezzo_carico_iniziale: number;
  data_iniziale: string;
}

export interface UpdateInvestimentoParams {
  id: string;
  isin?: string;
  ticker?: string;
  nome_titolo?: string;
  prezzo_attuale?: number;
  data_ultimo_aggiornamento?: string;
}

export interface DeleteInvestimentoParams {
  id: string;
}

export interface CreateOperazioneParams {
  data: string;
  quantita: number;
  prezzo_unitario: number;
  investimento_id: string;
}

export interface UpdateOperazioneParams {
  id: string;
  investimento_id: string;
  data?: string;
  quantita?: number;
  prezzo_unitario?: number;
}

export interface DeleteOperazioneParams {
  id: string;
  investimento_id: string;
}

export interface DeleteOperazioneOutput {
  op_id: string;
  inv_id: string;
}

export interface InvestimentoFilters {
  sort_by?: string[];
  isin?: string;
  ticker?: string;
  nome_titolo?: string;
  quantita_min?: number;
  quantita_max?: number;
  valore_attuale_min?: number;
  valore_attuale_max?: number;
  data_inizio?: string;
  data_fine?: string;
}
