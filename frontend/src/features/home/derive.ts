import {
  addMonths,
  endOfMonth,
  startOfMonth,
  toIsoDate,
} from "../../services/dates";

// Il calendario sta in `services/dates`: qui restano i calcoli che servono solo
// alla Home. Ri-esportiamo quello che la Home usa, così i suoi import non
// devono conoscere due moduli.
export { addMonths, endOfMonth, startOfMonth, toIsoDate };

/**
 * Variazione percentuale rispetto a un riferimento. `null` quando il
 * riferimento è zero o assente: "+∞% vs agosto" non vuol dire niente.
 */
export function percentDelta(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null || previous === 0) return null;

  return Math.round(((current - previous) / previous) * 100);
}

/** Media mensile a partire da un totale su più mesi. */
export function monthlyAverage(total: number, months: number): number {
  return months > 0 ? total / months : 0;
}
