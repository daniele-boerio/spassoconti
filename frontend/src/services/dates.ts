// Helper di calendario condivisi.
//
// Stanno qui e non dentro un dominio perché li usano più feature (la settimana
// della Home, i periodi dei Movimenti, gli intervalli dell'Analisi): duplicarli
// significherebbe farli divergere.

const MS_PER_DAY = 86_400_000;

/** Le date viaggiano come "YYYY-MM-DD": la formattiamo senza passare da UTC. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Mezzanotte locale del giorno di `date`, senza orario. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const shifted = startOfDay(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  // Giorno 0 del mese successivo: l'ultimo del mese corrente, bisestili inclusi.
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Primo giorno del mese spostato di `months`. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

/**
 * Giorni fra due date in formato "YYYY-MM-DD". Il confronto passa da UTC così
 * l'ora legale non fa mai valere una giornata 23 o 25 ore; `-1` se una delle
 * due non è una data valida.
 */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);

  if (Number.isNaN(from) || Number.isNaN(to)) return -1;

  return Math.round((to - from) / MS_PER_DAY);
}

/** Il giorno di una data che può arrivare con o senza orario. */
export function dayKey(value: string): string {
  return value.slice(0, 10);
}

// Scala del tempo relativo, dalla più grossa alla più fine. Si sceglie la
// prima unità in cui la distanza vale almeno 1: "2 ore fa", non "120 minuti fa".
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", MS_PER_DAY],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/**
 * "2 ore fa", "ieri", "adesso". `locale` è un tag BCP 47 ("it-IT").
 * Restituisce `null` per una data non leggibile, così chi chiama può
 * semplicemente non scrivere la riga.
 */
export function relativeTime(
  iso: string | null | undefined,
  locale: string,
  now: Date = new Date(),
): string | null {
  if (!iso) return null;

  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return null;

  const delta = timestamp - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, size] of RELATIVE_UNITS) {
    const value = delta / size;

    if (Math.abs(value) >= 1) {
      return formatter.format(Math.round(value), unit);
    }
  }

  // Sotto il minuto: "ora", che è quello che Intl scrive per lo zero.
  return formatter.format(0, "second");
}
