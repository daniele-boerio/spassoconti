import { ReactNode } from "react";
import Amount from "../amount/amount";
import { useI18n } from "../../i18n/use-i18n";
import { Transaction } from "../../features/transactions/interfaces";
import { amountSign, displayAmount } from "../../features/transactions/group";
import { transactionIcon } from "../../features/transactions/icons";
import "./transaction_table.scss";

type TransactionTableRowProps = {
  transaction: Transaction;
  categoria?: string;
  sottocategoria?: string;
  tag?: string;
  conto?: string;
  contoDestinazione?: string;
  /** L'ora del movimento, già scritta: la riga non formatta date. */
  time?: ReactNode;
  onOpen: () => void;
};

/**
 * La riga dei Movimenti da schermo largo: cinque colonne invece delle due
 * righe del telefono.
 *
 * Categoria e conto sul telefono stanno stretti in una riga di meta sotto la
 * descrizione; qui hanno una colonna a testa e si leggono in verticale lungo
 * l'elenco. È un componente a parte e non una variante di `ListRow` perché
 * `ListRow` lo usa mezza app: qui cambia la griglia, non lo stile.
 */
export function TransactionTableRow({
  transaction,
  categoria,
  sottocategoria,
  tag,
  conto,
  contoDestinazione,
  time,
  onOpen,
}: TransactionTableRowProps) {
  const { t } = useI18n();

  const isIncome =
    transaction.tipo === "ENTRATA" || transaction.tipo === "RIMBORSO";

  // Un giroconto si racconta con i due conti: la sua categoria non direbbe
  // niente, e la colonna "conto" da sola non basta a dire dove sono andati.
  const transfer = Boolean(transaction.conto_destinazione_id && contoDestinazione);

  const taxonomy = [categoria, sottocategoria].filter(Boolean).join(" · ");

  return (
    <button type="button" className="tx-row" onClick={onOpen}>
      <span
        className={`tx-row__icon ${isIncome ? "tx-row__icon--accent" : ""}`}
        aria-hidden="true"
      >
        <i className={transactionIcon(transaction.tipo, categoria)} />
      </span>

      <span className="tx-row__main">
        <span className="tx-row__title">
          {transaction.descrizione || categoria || t("transaction")}
        </span>
        {(time || tag) && (
          <span className="tx-row__sub">
            {[time, tag && `#${tag}`].filter(Boolean).map((piece, index) => (
              <span key={index}>{piece}</span>
            ))}
          </span>
        )}
      </span>

      <span className="tx-row__cell">
        {transfer ? `${conto ?? "—"} → ${contoDestinazione}` : taxonomy || "—"}
      </span>

      <span className="tx-row__cell">{conto ?? "—"}</span>

      <span className="tx-row__amount">
        <Amount
          value={displayAmount(transaction)}
          sign={amountSign(transaction.tipo)}
          tone={isIncome ? "positive" : "neutral"}
        />
      </span>

      <i className="ph-bold ph-dots-three tx-row__more" aria-hidden="true" />
    </button>
  );
}

/** L'intestazione delle colonne: si scrive una volta sola, in cima all'elenco. */
export function TransactionTableHeader() {
  const { t } = useI18n();

  return (
    <div className="tx-head" aria-hidden="true">
      <span />
      <span>{t("description")}</span>
      <span>{t("category")}</span>
      <span>{t("mov_col_account")}</span>
      <span className="tx-head__amount">{t("amount")}</span>
      <span />
    </div>
  );
}
