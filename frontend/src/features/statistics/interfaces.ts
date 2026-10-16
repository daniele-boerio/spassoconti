export interface YearDetailsStatRow {
  month: number; // 1 = Gennaio, 2 = Febbraio...
  [key: string]: number; // Chiavi dinamiche per categorie (es. "Stipendio": 1500, "Spesa": -400)
}

/** Risposta di `/statistics/yearDetails`: le righe più i totali dell'anno. */
export interface YearDetailsResponse {
  data: YearDetailsStatRow[];
  totale_entrata: number;
  /** Negativo, come in `monthDetails`. */
  totale_uscita: number;
  totale_accantonamento: number;
}

export interface FetchYearStatisticsParams {
  year: number;
  categoria_id?: string | null;
  /** Ripetibile: il filtro dell'Analisi ne accetta più d'una alla volta. */
  sottocategoria_id?: string[] | null;
  tag_id?: string | null;
}

export interface MonthlyDetailResponse {
  data: MonthlyDetailCategory[];
  totale_entrata: number;
  totale_uscita: number;
  totale_accantonamento: number;
  totale: number;
}

export interface MonthlyDetailCategory {
  categoria: string;
  totale: number;
  tipo: "USCITA" | "ENTRATA" | "OTHER";
  sottocategorie: SubcategoryData[];
}

export interface SubcategoryData {
  sottocategoria: string;
  totale: number;
}

export interface FetchMonthStatisticsParams {
  year: number;
  month: number;
  categoria_id?: string | null;
  /** Ripetibile: il filtro dell'Analisi ne accetta più d'una alla volta. */
  sottocategoria_id?: string[] | null;
  tag_id?: string | null;
}
