import { Doppione } from "./interfaces";

/**
 * Dove si vedono i movimenti di un gruppo di doppioni: i Movimenti filtrati su
 * quel giorno, conto, tipo e descrizione (gli stessi campi della chiave del
 * doppione), così quello di troppo si elimina dalla lista.
 */
export function linkMovimenti(gruppo: Doppione): string {
  const giorno = gruppo.data.slice(0, 10);
  const params = new URLSearchParams({
    periodo: "custom",
    da: giorno,
    a: giorno,
    tipo: gruppo.tipo,
  });
  const conto = gruppo.transazioni[0]?.conto_id;
  if (conto !== undefined && conto !== null) params.set("conti", String(conto));
  if (gruppo.descrizione?.trim()) params.set("q", gruppo.descrizione.trim());
  return `/transactions?${params.toString()}`;
}
