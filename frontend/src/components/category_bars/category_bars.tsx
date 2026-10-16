import Amount from "../amount/amount";
import { ExpenseRow, UNCATEGORIZED } from "../../features/statistics/expenses";
import "./category_bars.scss";

// Le tinte della serie grafici sono cinque: dalla sesta riga in giù si
// ricomincia dalla prima.
const SERIES_TINTS = 5;

type CategoryBarsProps = {
  rows: ExpenseRow[];
  /**
   * Etichetta delle righe che una tassonomia non ce l'hanno: cambia a seconda
   * del livello — "senza categoria" o "senza sottocategoria".
   */
  missingLabel: string;
  /** Cosa scrivere quando non c'è niente da mostrare. */
  emptyText: string;
  onSelect: (row: ExpenseRow) => void;
};

/**
 * Le uscite di un periodo in classifica, una barra per riga: la usano sia la
 * vista Mese sia la vista Anno, sulle categorie o sulle loro sottocategorie.
 *
 * La quota è sulla somma di quello che è a schermo e non su un totale che
 * arriva da fuori: mentre i dati si aggiornano le due cose possono non essere
 * d'accordo, e la card deve almeno tornare con sé stessa.
 */
export default function CategoryBars({
  rows,
  missingLabel,
  emptyText,
  onSelect,
}: CategoryBarsProps) {
  if (rows.length === 0)
    return <p className="category-bars__empty">{emptyText}</p>;

  const total = rows.reduce((sum, row) => sum + row.totale, 0);

  return (
    <div className="category-bars">
      {rows.map((row, index) => {
        const percent = total > 0 ? (row.totale / total) * 100 : 0;

        return (
          <button
            type="button"
            className="category-bars__row"
            key={row.nome}
            onClick={() => onSelect(row)}
          >
            <span className="category-bars__body">
              <span className="category-bars__line">
                <span className="category-bars__name">
                  {row.nome === UNCATEGORIZED ? missingLabel : row.nome}
                </span>
                <span className="category-bars__figure">
                  {`${Math.round(percent)}% · `}
                  <strong>
                    <Amount value={row.totale} />
                  </strong>
                </span>
              </span>

              <span className="category-bars__track">
                <span
                  className={`category-bars__fill category-bars__fill--${(index % SERIES_TINTS) + 1}`}
                  style={{ width: `${percent}%` }}
                />
              </span>
            </span>

            <i
              className="ph-bold ph-caret-right category-bars__chevron"
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
