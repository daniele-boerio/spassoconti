import { TagSuggestion, TagSuggestionResponse } from "./interfaces";

/**
 * Dal filo allo stato: importi (Decimal, stringhe) a numero e id a stringa,
 * come nel resto del FE. È l'unico punto in cui si fa.
 */
export function mapTagSuggestion(raw: TagSuggestionResponse): TagSuggestion {
  return {
    ...raw,
    tag_id: raw.tag_id === null ? null : String(raw.tag_id),
    transazioni: raw.transazioni.map((transazione) => ({
      ...transazione,
      id: String(transazione.id),
      importo: Number(transazione.importo),
    })),
  };
}

/** Aggiunge o toglie un id dalla selezione dell'anteprima. */
export function toggleId(selected: string[], id: string): string[] {
  return selected.includes(id)
    ? selected.filter((current) => current !== id)
    : [...selected, id];
}
