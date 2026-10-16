// --- Proposte di transazione importate dalla banca (Open Banking) ---

export interface BankProposal {
  id: string;
  conto_id: string;
  provider: string;
  external_id?: string | null;
  tipo: string; // "ENTRATA" | "USCITA" | ...
  data: string;
  importo: number;
  descrizione?: string | null;
  status: string;
  imported_transaction_id?: number | null;
  creationDate: string;
  lastUpdate: string;
}

export interface BankProposalsState {
  loading: boolean;
  proposals: BankProposal[];
}

// Il conto "origine" (conto_origin_id) serve a comporre l'URL annidato;
// conto_id è invece il conto destinazione scelto (può differire dall'origine).
export interface ImportProposalParams {
  conto_origin_id: string;
  proposal_id: string;
  conto_id?: string | null;
  categoria_id?: string | null;
  sottocategoria_id?: string | null;
  tag_id?: string | null;
  descrizione?: string | null;
}

export interface DiscardProposalParams {
  conto_origin_id: string;
  proposal_id: string;
}
