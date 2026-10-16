import {
  addDays,
  addMonths,
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
  toIsoDate,
} from "../../services/dates";

/**
 * Periodo dei Movimenti. È una preferenza di vista, non un filtro del BE: al
 * BE arrivano sempre e solo `data_inizio` / `data_fine`, che questo modulo
 * ricava dal preset. "custom" tiene le date scelte a mano e non le ricalcola.
 */
export type PeriodPreset =
  | "month"
  | "last_month"
  | "last_90"
  | "year"
  | "all"
  | "custom";

export const PERIOD_PRESETS: PeriodPreset[] = [
  "month",
  "last_month",
  "last_90",
  "year",
  "all",
];

/** Chiave i18n dell'etichetta di ogni preset dentro lo sheet dei filtri. */
export const PERIOD_LABEL_KEYS: Record<PeriodPreset, string> = {
  month: "period_this_month",
  last_month: "period_last_month",
  last_90: "period_last_90",
  year: "period_year",
  all: "period_all",
  custom: "period_custom",
};

// L'orizzonte di "ultimi 90 giorni" include oggi: 89 giorni indietro più oggi.
const LAST_DAYS = 90;

export interface PeriodRange {
  data_inizio?: string;
  data_fine?: string;
}

/**
 * Intervallo di date del preset. "all" e "custom" non ne hanno uno proprio:
 * il primo non filtra, il secondo conserva le date già scelte dall'utente.
 */
export function periodRange(
  preset: PeriodPreset,
  today: Date = new Date(),
): PeriodRange {
  switch (preset) {
    case "month":
      return {
        data_inizio: toIsoDate(startOfMonth(today)),
        data_fine: toIsoDate(endOfMonth(today)),
      };

    case "last_month": {
      const previous = addMonths(today, -1);
      return {
        data_inizio: toIsoDate(startOfMonth(previous)),
        data_fine: toIsoDate(endOfMonth(previous)),
      };
    }

    case "last_90":
      return {
        data_inizio: toIsoDate(addDays(today, -(LAST_DAYS - 1))),
        data_fine: toIsoDate(today),
      };

    case "year":
      return {
        data_inizio: toIsoDate(startOfYear(today)),
        data_fine: toIsoDate(endOfYear(today)),
      };

    default:
      return {};
  }
}
