import { ReactNode, useEffect, useMemo, useState } from "react";
import Sheet from "../../sheet/sheet";
import Alert from "../../alert/alert";
import Amount from "../../amount/amount";
import Button from "../../button/button";
import { useI18n } from "../../../i18n/use-i18n";
import { getLocale } from "../../../i18n";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { openSheet, showToast } from "../../../features/ui/ui_slice";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
} from "../../../features/transactions/api_calls";
import { Transaction } from "../../../features/transactions/interfaces";
import {
  amountSign,
  dayOffset,
  displayAmount,
} from "../../../features/transactions/group";
import { transactionIcon } from "../../../features/transactions/icons";
import { selectContiConti } from "../../../features/conti/conto_slice";
import {
  selectCategoriaCategorie,
  selectCategoriaSottocategorie,
} from "../../../features/categorie/categoria_slice";
import { selectTagTags } from "../../../features/tags/tag_slice";
import {
  isQueuedOffline,
  newIdempotencyKey,
} from "../../../features/transactions/offline_queue";
import "./transaction_detail_sheet.scss";

type TransactionDetailSheetProps = {
  visible: boolean;
  onHide: () => void;
  transaction: Transaction;
};

/**
 * Dettaglio di un movimento: quello che la riga della lista non ha spazio per
 * dire, più le tre azioni che lo riguardano.
 *
 * Nota e allegato del design non ci sono: su una transazione non hanno senso,
 * e il campo nota sul BE nemmeno esiste.
 */
export default function TransactionDetailSheet({
  visible,
  onHide,
  transaction,
}: TransactionDetailSheetProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const conti = useAppSelector(selectContiConti);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const sottocategorie = useAppSelector(selectCategoriaSottocategorie);
  const tags = useAppSelector(selectTagTags);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Duplica ed Elimina aspettano il server: senza, "Eliminato" compariva
  // anche quando la richiesta falliva, e un doppio tocco duplicava due volte.
  const [busy, setBusy] = useState(false);
  // Chiave fissa per questo dettaglio: due tocchi su Duplica, o un nuovo
  // tentativo dopo un errore di rete, creano una copia sola.
  const [duplicateKey] = useState(newIdempotencyKey);

  // Il saldo dopo non sta nella lista: sarebbe una somma progressiva per riga.
  // Lo chiediamo qui, dove serve e per una riga sola.
  const [saldoDopo, setSaldoDopo] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    dispatch(getTransaction({ id: transaction.id }))
      .unwrap()
      .then((full) => alive && setSaldoDopo(full.saldo_dopo ?? null))
      .catch(() => alive && setSaldoDopo(null));

    return () => {
      alive = false;
    };
  }, [dispatch, transaction.id]);

  const isIncome =
    transaction.tipo === "ENTRATA" || transaction.tipo === "RIMBORSO";

  const nameOf = <T extends { id: string; nome: string }>(
    list: (T | undefined)[],
    id?: string | null,
  ) =>
    id
      ? list.find((item) => item && String(item.id) === String(id))?.nome
      : undefined;

  const categoria = nameOf(categorie, transaction.categoria_id);
  const sottocategoria = nameOf(sottocategorie, transaction.sottocategoria_id);
  const tag = nameOf(tags, transaction.tag_id);
  const conto = nameOf(conti, transaction.conto_id);
  const contoDestinazione = nameOf(conti, transaction.conto_destinazione_id);

  const dateLabel = useMemo(() => {
    const day = transaction.data.slice(0, 10);
    const offset = dayOffset(day);

    const written = new Intl.DateTimeFormat(
      getLocale() === "it" ? "it-IT" : "en-GB",
      { day: "numeric", month: "long" },
    ).format(new Date(`${day}T00:00:00`));

    if (offset === 0) return `${t("mov_today")}, ${written}`;
    if (offset === 1) return `${t("mov_yesterday")}, ${written}`;

    return written;
  }, [transaction.data, t]);

  const duplicate = async () => {
    if (busy) return;
    setBusy(true);

    try {
      await dispatch(
        createTransaction({
          importo: transaction.importo,
          tipo: transaction.tipo,
          data: transaction.data.slice(0, 10),
          descrizione: transaction.descrizione || null,
          conto_id: transaction.conto_id,
          conto_destinazione_id: transaction.conto_destinazione_id ?? null,
          categoria_id: transaction.categoria_id ?? null,
          sottocategoria_id: transaction.sottocategoria_id ?? null,
          tag_id: transaction.tag_id ?? null,
          parent_transaction_id: null,
          idempotencyKey: duplicateKey,
        }),
      ).unwrap();

      dispatch(showToast({ variant: "success", title: t("mov_duplicated") }));
      onHide();
    } catch (error) {
      if (isQueuedOffline(error)) {
        dispatch(showToast({ variant: "offline", title: t("tx_saved_offline") }));
        onHide();
      }
      // Gli altri errori li mostra il middleware; il dettaglio resta aperto.
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setConfirmingDelete(false);

    try {
      await dispatch(deleteTransaction({ id: transaction.id })).unwrap();
      dispatch(showToast({ variant: "success", title: t("mov_deleted") }));
      onHide();
    } catch {
      // L'errore lo mostra il middleware; il movimento resta dov'era.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={visible} onClose={onHide} className="tx-detail">
        <header className="tx-detail__head">
          <span className="tx-detail__icon" aria-hidden="true">
            <i className={transactionIcon(transaction.tipo, categoria)} />
          </span>

          <div className="tx-detail__title">
            <span className="tx-detail__name">
              {transaction.descrizione || categoria || t("transaction")}
            </span>
            <span className="tx-detail__date">{dateLabel}</span>
          </div>

          <Amount
            className="tx-detail__amount"
            value={displayAmount(transaction)}
            sign={amountSign(transaction.tipo)}
            tone={isIncome ? "positive" : "neutral"}
          />
        </header>

        <dl className="tx-detail__table">
          <Row label={t("category")}>
            {[categoria, sottocategoria].filter(Boolean).join(" · ") || "—"}
          </Row>

          <Row label={t("bank_account")}>
            {contoDestinazione ? `${conto} → ${contoDestinazione}` : conto || "—"}
          </Row>

          <Row label={t("tag")}>{tag ? `#${tag}` : "—"}</Row>

          {saldoDopo !== null && (
            <Row label={t("tx_balance_after")}>
              <Amount value={saldoDopo} />
            </Row>
          )}
        </dl>

        <div className="tx-detail__actions">
          <Button
            block
            onClick={() =>
              dispatch(
                openSheet({
                  name: "newTransaction",
                  transactionId: transaction.id,
                }),
              )
            }
          >
            {t("edit")}
          </Button>

          <button
            type="button"
            className="tx-detail__action"
            aria-label={t("mov_duplicate")}
            disabled={busy}
            onClick={duplicate}
          >
            <i className="ph-bold ph-copy-simple" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="tx-detail__action tx-detail__action--danger"
            aria-label={t("delete")}
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
            <i className="ph-bold ph-trash" aria-hidden="true" />
          </button>
        </div>
      </Sheet>

      <Alert
        open={confirmingDelete}
        title={t("mov_delete_title")}
        description={
          conto
            ? `${t("mov_delete_text")} ${conto}.`
            : t("mov_delete_text_plain")
        }
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tx-detail__row">
      <dt className="tx-detail__label">{label}</dt>
      <dd className="tx-detail__value">{children}</dd>
    </div>
  );
}
