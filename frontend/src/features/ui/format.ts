import { getLocale } from "../../i18n";

// Il design scrive il segno prima del numero e la valuta dopo: −42,30 €.
// Il meno è il segno matematico U+2212, non il trattino: allinea con le cifre
// tabellari, il trattino no.
const MINUS = "\u2212";

export type AmountSign = "auto" | "always" | "never";

export interface FormatAmountOptions {
  /** "always" mette il + sui positivi (delta, variazioni). */
  sign?: AmountSign;
  /** Cifre decimali; 0 per gli importi arrotondati dell'hero. */
  decimals?: number;
}

/** Solo il numero, senza segno né valuta. */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat(getLocale() === "it" ? "it-IT" : "en-GB", {
    minimumFractionDigits: decimals,
    // L'italiano di default non raggruppa i numeri a quattro cifre
    // (minimumGroupingDigits = 2), il design invece scrive "1.200 €".
    useGrouping: "always",
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));
}

export function formatAmount(
  value: number,
  { sign = "auto", decimals = 2 }: FormatAmountOptions = {},
): string {
  const digits = formatNumber(value, decimals);

  if (value < 0 && sign !== "never") return `${MINUS}${digits}`;
  if (value > 0 && sign === "always") return `+${digits}`;

  return digits;
}
