export interface Tag {
  id: string;
  nome: string;
  /** Quante transazioni lo usano: lo conta il BE a ogni GET. */
  n_transazioni?: number;
}

/** Riga dell'anteprima: una transazione passata che finirebbe nel tag. */
export interface TagPreviewTransaction {
  id: string;
  data: string | null;
  descrizione: string | null;
  /** Già convertito a numero dal mapper (sul filo è una stringa Decimal). */
  importo: number;
}

/**
 * Tag proposto dalla descrizione (GET /tags/suggerimento) o per un gruppo di
 * transazioni senza tag (GET /tags/proposte).
 */
export interface TagSuggestion {
  /** "esistente": tag che c'è già (tag_id); "nuovo": da creare con `nome`. */
  tipo: "esistente" | "nuovo";
  tag_id: string | null;
  nome: string;
  /** Frase normalizzata: va rimandata per "Non chiederlo più". */
  chiave: string;
  /** La frase com'è scritta ("con la Gaia"). */
  frase: string;
  occorrenze: number;
  transazioni: TagPreviewTransaction[];
}

/** Com'è sul filo, prima del mapper. */
export interface TagSuggestionResponse
  extends Omit<TagSuggestion, "tag_id" | "transazioni"> {
  tag_id: number | null;
  transazioni: (Omit<TagPreviewTransaction, "id" | "importo"> & {
    id: number;
    importo: string;
  })[];
}

export interface ApplyTagParams {
  /** Tag esistente; altrimenti `nome` (riusato se c'è, creato se no). */
  tag_id?: string | null;
  nome?: string;
  transazione_ids: string[];
}

export interface ApplyTagResult {
  tag: Tag;
  aggiornate: number;
}

export interface RejectTagSuggestionParams {
  chiave: string;
  nome: string;
}

// 2. Definiamo lo stato dello slice
export interface TagState {
  loading: boolean;
  tags: Tag[];
  selectedTag: Tag | null;
  filters: TagsFilters;
}

export interface createTagParams {
  nome: string;
}

export interface UpdateTagParams {
  id: string;
  nome: string;
}

export interface DeleteTagParams {
  id: string;
}

export interface TagsFilters {
  sort_by?: string[];
}
