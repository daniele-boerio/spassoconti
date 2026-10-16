import { Categoria } from "../categorie/interfaces";
import { MonthlyDetailCategory } from "./interfaces";

/** Una categoria con un tetto di spesa, e quanto ci si è speso nel mese. */
export type BudgetRow = {
  id: string;
  nome: string;
  /** In valore assoluto: `monthDetails` manda le uscite col segno meno. */
  speso: number;
  budget: number;
  /** Quota del budget consumata. Può superare 100: è il punto. */
  percent: number;
  /** Quanto resta, o quanto si è sforato se negativo. */
  resta: number;
  over: boolean;
};

/**
 * Le categorie con un budget, confrontate con quanto ci si è speso nel mese.
 *
 * Il budget sta sulla categoria e il speso arriva da `monthDetails`: le due
 * cose si incrociano per nome, che è l'unica chiave che le statistiche danno.
 *
 * Una categoria col budget ma senza spese resta in elenco: "0 di 500" è
 * un'informazione, e toglierla farebbe sparire dall'elenco proprio i mesi in
 * cui il tetto è stato rispettato meglio.
 *
 * L'ordine è per quota consumata, non per importo: la riga che serve vedere
 * per prima è quella più vicina a sfondare, non quella che pesa di più.
 */
export function budgetRows(
  data: MonthlyDetailCategory[],
  categorie: Categoria[],
): BudgetRow[] {
  const spesoPerNome = new Map(
    data.map((entry) => [entry.categoria, Math.abs(Math.min(entry.totale, 0))]),
  );

  return categorie
    .filter((categoria) => categoria.budget_mensile !== null)
    .map((categoria) => {
      const budget = categoria.budget_mensile as number;
      const speso = spesoPerNome.get(categoria.nome) ?? 0;

      return {
        id: String(categoria.id),
        nome: categoria.nome,
        speso,
        budget,
        // Un budget a zero è "non spenderci niente": qualunque spesa è uno
        // sforamento pieno, e dividere per zero non direbbe niente.
        percent: budget > 0 ? (speso / budget) * 100 : speso > 0 ? 100 : 0,
        resta: budget - speso,
        over: speso > budget,
      };
    })
    .sort((a, b) => b.percent - a.percent);
}
