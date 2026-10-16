import { dayKey, daysBetweenIso, toIsoDate } from "../../services/dates";
import { Transaction, tipoTransaction } from "./interfaces";

/** Un giorno della lista Movimenti: le sue righe e il suo subtotale. */
export interface DayGroup {
  /** Giorno come "YYYY-MM-DD". */
  day: string;
  /** Somma con segno delle righe del giorno; i giroconti non la muovono. */
  total: number;
  transactions: Transaction[];
}

// Il segno di ogni tipo nel bilancio di giornata. Il giroconto sposta denaro
// fra due conti dell'utente: nella lista si vede, nel subtotale vale zero —
// come negli aggregati del BE, che lo escludono dai totali.
const SIGN: Record<tipoTransaction, number> = {
  ENTRATA: 1,
  RIMBORSO: 1,
  USCITA: -1,
  ACCANTONAMENTO: -1,
  RICARICA: 0,
};

/**
 * Importo con segno di una riga. Lordo, non netto: la lista è un registro
 * cronologico, e il rimborso di una spesa è una riga sua nel giorno in cui è
 * arrivato — scontare anche il padre lo conterebbe due volte.
 */
export function signedAmount(transaction: Transaction): number {
  return SIGN[transaction.tipo] * Number(transaction.importo);
}

/**
 * Importo come va scritto in riga. Sul BE gli importi sono sempre positivi ed
 * è il tipo a dire la direzione: qui il segno torna dentro al numero, tranne
 * che per i giroconti, che non hanno una direzione da mostrare.
 */
export function displayAmount(transaction: Transaction): number {
  const signed = signedAmount(transaction);

  return signed === 0 ? Number(transaction.importo) : signed;
}

/** Il segno con cui la riga va mostrata: i giroconti restano senza. */
export function amountSign(tipo: tipoTransaction): "auto" | "always" | "never" {
  return SIGN[tipo] === 0 ? "never" : "always";
}

/**
 * Raggruppa per giorno mantenendo l'ordine di arrivo (il BE le manda già dalla
 * più recente): l'ordinamento è suo, qui si accorpa soltanto.
 */
export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byDay = new Map<string, DayGroup>();

  for (const transaction of transactions) {
    const day = dayKey(transaction.data);
    let group = byDay.get(day);

    if (!group) {
      group = { day, total: 0, transactions: [] };
      byDay.set(day, group);
      groups.push(group);
    }

    group.transactions.push(transaction);
    group.total += signedAmount(transaction);
  }

  return groups;
}

// Tetti "tondi" del cursore importo: il massimo caricato si arrotonda al primo
// che lo contiene, così la scala resta leggibile invece di finire a 1.847 €.
const CEILINGS = [500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000];

/** Estremo superiore del cursore importo, dedotto dai movimenti a schermo. */
export function amountCeiling(transactions: Transaction[]): number {
  const largest = transactions.reduce(
    (max, transaction) => Math.max(max, Math.abs(Number(transaction.importo))),
    0,
  );

  return (
    CEILINGS.find((ceiling) => ceiling >= largest) ??
    Math.ceil(largest / 100_000) * 100_000
  );
}

/**
 * Distanza in giorni fra `day` ("YYYY-MM-DD") e oggi: 0 è oggi, 1 ieri.
 * Serve alle intestazioni della lista, che scrivono "Oggi" e "Ieri" al posto
 * della data. Negativa per le date future (le ricorrenze già registrate).
 */
export function dayOffset(day: string, today: Date = new Date()): number {
  return daysBetweenIso(day, toIsoDate(today));
}
