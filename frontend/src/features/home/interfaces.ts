/** Una ricorrenza attesa nei prossimi giorni, per la card "In arrivo". */
export interface UpcomingRecurrence {
  id: string;
  nome: string;
  importo: number;
  prossima_esecuzione: string;
  conto_id: string;
}

export interface HomeState {
  loading: boolean;
  upcoming: UpcomingRecurrence[];
  /** Giorni di orizzonte della card "In arrivo". */
  upcomingDays: number;
  /** Risparmio del mese precedente: il riferimento del delta sull'hero. */
  previousMonthSavings: number | null;
  /** Media mensile per categoria sui mesi precedenti, per nome categoria. */
  categoryAverages: Record<string, number>;
}

export interface GetUpcomingParams {
  /** Orizzonte in giorni; il design ne mostra 10. */
  days: number;
}

export interface GetCategoryAveragesParams {
  /** Quanti mesi precedenti mediare; il design ne usa 3. */
  months: number;
}
