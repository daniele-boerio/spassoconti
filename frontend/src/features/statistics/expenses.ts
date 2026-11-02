import { Categoria } from "../categorie/interfaces";
import { MonthlyDetailCategory, YearDetailsStatRow } from "./interfaces";

// Come il BE chiama negli aggregati quello che una categoria (o una
// sottocategoria) non ce l'ha.
export const UNCATEGORIZED = "Uncategorized";

/**
 * Quale lato del periodo si mette in classifica. I totali per categoria
 * arrivano già netti e col segno (negativo uscita, positivo entrata): il lato
 * decide quali righe tenere, il valore si scrive sempre in positivo.
 */
export type Direction = "uscite" | "entrate";

const delLato = (totale: number, direction: Direction) =>
  direction === "entrate" ? totale > 0 : totale < 0;

/**
 * Una barra di "Uscite per categoria" (o "Entrate per categoria"): una
 * categoria, o una sottocategoria.
 */
export type ExpenseRow = {
  nome: string;
  totale: number;
  /** Valorizzato solo quando la riga è una sottocategoria riconosciuta. */
  sottocategoriaId: string | null;
};

/**
 * Le barre delle uscite del mese, dal payload di `monthDetails`.
 *
 * Con una categoria scelta si scende di un livello e si elencano le sue
 * sottocategorie — il nome della categoria è già nel titolo della card.
 *
 * La categoria si cerca *dentro* il payload invece di appiattire tutto quello
 * che c'è: lo store è globale e i dati possono essere quelli di un'altra
 * schermata o del filtro di un attimo prima, e appiattirli mescolerebbe le
 * sottocategorie di tutti — una riga "senza sottocategoria" per ogni categoria
 * che non ne ha. Se il payload non parla ancora della categoria scelta, non
 * c'è niente da mostrare: meglio vuoto che le righe di qualcun altro.
 *
 * `monthDetails` manda le uscite col segno meno: qui si ragiona in valore
 * assoluto, il segno lo rimette la scrittura. Con `direction` "entrate" si
 * tengono le righe col segno più, con le stesse regole.
 */
export function expenseRows(
  data: MonthlyDetailCategory[],
  categoria: Categoria | null,
  direction: Direction = "uscite",
): ExpenseRow[] {
  const rows: ExpenseRow[] = categoria
    ? (
        data.find((entry) => entry.categoria === categoria.nome)
          ?.sottocategorie ?? []
      ).map((sub) => ({
        nome: sub.sottocategoria,
        totale: sub.totale,
        // Le statistiche danno il nome della sottocategoria, non il suo id:
        // per poterci filtrare i movimenti lo ripeschiamo dalla categoria. Le
        // uscite senza sottocategoria non hanno corrispondenza e restano senza.
        sottocategoriaId:
          categoria.sottocategorie?.find(
            (item) => item.nome === sub.sottocategoria,
          )?.id ?? null,
      }))
    : data.map((entry) => ({
        nome: entry.categoria,
        totale: entry.totale,
        sottocategoriaId: null,
      }));

  return rows
    .filter((row) => delLato(row.totale, direction))
    .map((row) => ({ ...row, totale: Math.abs(row.totale) }))
    .sort((a, b) => b.totale - a.totale);
}

/**
 * Le stesse barre, dall'anno invece che dal mese.
 *
 * `yearDetails` manda una riga per mese con una colonna per etichetta, e
 * decide lui il livello: con una categoria scelta le colonne sono le sue
 * sottocategorie, senza sono le categorie. Qui si sommano i dodici mesi.
 *
 * Con una categoria scelta si tengono solo le etichette che possono essere
 * sue: se sono ancora quelle delle categorie il payload è di un attimo fa (o
 * di un'altra schermata) e non va mostrato sotto il titolo di adesso.
 */
export function yearExpenseRows(
  rows: YearDetailsStatRow[],
  categoria: Categoria | null,
  direction: Direction = "uscite",
): ExpenseRow[] {
  const totali = new Map<string, number>();

  for (const row of rows) {
    for (const [etichetta, valore] of Object.entries(row)) {
      if (etichetta === "month") continue;
      totali.set(etichetta, (totali.get(etichetta) ?? 0) + Number(valore ?? 0));
    }
  }

  const sue = categoria
    ? new Set([
        UNCATEGORIZED,
        ...(categoria.sottocategorie ?? []).map((item) => item.nome),
      ])
    : null;

  return [...totali]
    .filter(
      ([etichetta, totale]) =>
        delLato(totale, direction) && (sue?.has(etichetta) ?? true),
    )
    .map(([etichetta, totale]) => ({
      nome: etichetta,
      // Ai centesimi: nel mese i totali arrivano già sommati dal BE, qui li
      // sommiamo noi su dodici mesi e la deriva dei float si vede (400 + 404,42
      // fa 804,4200000000001).
      totale: Math.round(Math.abs(totale) * 100) / 100,
      sottocategoriaId:
        categoria?.sottocategorie?.find((item) => item.nome === etichetta)?.id ??
        null,
    }))
    .sort((a, b) => b.totale - a.totale);
}
