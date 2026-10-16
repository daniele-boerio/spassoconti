import { dayKey, daysBetweenIso, toIsoDate } from "../../services/dates";
import { Recurring } from "./interfaces";

/**
 * Quante volte al mese scatta ogni frequenza. Settimanale non è "quattro":
 * un anno ha 52,18 settimane, e su dodici mesi la differenza si vede.
 */
const PER_MONTH: Record<string, number> = {
  GIORNALIERA: 365.25 / 12,
  SETTIMANALE: 52.18 / 12,
  MENSILE: 1,
  ANNUALE: 1 / 12,
};

/**
 * Impegno fisso mensile: quanto se ne va ogni mese, in media, per le uscite
 * ricorrenti attive. Le frequenze diverse dal mese vengono normalizzate,
 * altrimenti un abbonamento annuale peserebbe come uno mensile.
 */
export function monthlyCommitment(recurrings: Recurring[]): number {
  return recurrings
    .filter((recurring) => recurring.attiva && recurring.tipo === "USCITA")
    .reduce(
      (sum, recurring) =>
        sum + Number(recurring.importo) * (PER_MONTH[recurring.frequenza] ?? 1),
      0,
    );
}

/**
 * Ricorrenze attive la cui data è già passata. Di norma la lista è vuota: il
 * BE le esegue a mezzanotte. Se una resta indietro — tipicamente perché il suo
 * conto è in soft-delete — è l'unico posto in cui si vede.
 *
 * Le ricorrenze a importo variabile ci entrano già dal giorno in cui scadono:
 * lo scheduler non le registra mai da sé, aspettano la cifra vera.
 */
export function overdue(
  recurrings: Recurring[],
  today: Date = new Date(),
): Recurring[] {
  const todayKey = toIsoDate(today);

  return recurrings.filter(
    (recurring) =>
      recurring.attiva &&
      daysBetweenIso(dayKey(recurring.prossima_esecuzione), todayKey) >
        (recurring.importo_variabile ? -1 : 0),
  );
}

/** Ricorrenze in arrivo entro `days` giorni, dalla più vicina. */
export function upcoming(
  recurrings: Recurring[],
  days: number,
  today: Date = new Date(),
): Recurring[] {
  const todayKey = toIsoDate(today);

  return recurrings
    .filter((recurring) => {
      const distance = daysBetweenIso(
        todayKey,
        dayKey(recurring.prossima_esecuzione),
      );
      return distance >= 0 && distance <= days;
    })
    .sort((a, b) =>
      dayKey(a.prossima_esecuzione).localeCompare(dayKey(b.prossima_esecuzione)),
    );
}
