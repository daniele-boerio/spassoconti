import { Doppione } from "./interfaces";

/**
 * Dove si vedono i movimenti di un gruppo di doppioni: i Movimenti di quel
 * giorno, tutti. Filtrare anche su conto, tipo e descrizione mostrava solo le
 * righe uguali, e senza il resto della giornata non si capisce se sono davvero
 * un doppione o due spese vere.
 */
export function linkMovimenti(gruppo: Doppione): string {
  const giorno = gruppo.data.slice(0, 10);
  const params = new URLSearchParams({ periodo: "custom", da: giorno, a: giorno });
  return `/transactions?${params.toString()}`;
}
