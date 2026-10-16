import { Suspense, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { closeSheet, selectActiveSheet } from "../../features/ui/ui_slice";
import {
  mapTransaction,
  selectTransactionTransactions,
} from "../../features/transactions/transaction_slice";
import { getTransaction } from "../../features/transactions/api_calls";
import { Transaction } from "../../features/transactions/interfaces";
import { lazyWithRetry } from "../../services/lazy_with_retry";

// Pesa quanto tutto il form di inserimento: resta fuori dal bundle iniziale.
const TransactionDialog = lazyWithRetry(
  () => import("../dialog/transaction_dialog/transaction_dialog"),
);
const TransactionDetailSheet = lazyWithRetry(
  () => import("../dialog/transaction_detail_sheet/transaction_detail_sheet"),
);
const FiltersSheet = lazyWithRetry(
  () => import("../dialog/filters_sheet/filters_sheet"),
);

/**
 * Modifica di un movimento che la lista in memoria non ha: lo chiede al BE
 * prima di aprire il form.
 *
 * La lista dello store contiene solo la pagina/il periodo caricato (o gli
 * ultimi N della Home), mentre la modifica si apre anche da pagine con una
 * lista propria (es. dettaglio categoria). Senza dato il form partiva in
 * modalità *creazione*: importo vuoto ("0") e salvataggio che non modificava.
 */
function EditTransactionLoader({
  transactionId,
  onHide,
}: {
  transactionId: string;
  onHide: () => void;
}) {
  const dispatch = useAppDispatch();
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    let alive = true;

    dispatch(getTransaction({ id: transactionId }))
      .unwrap()
      .then((full) => alive && setTransaction(mapTransaction(full)))
      // Movimento sparito (eliminato altrove): niente da modificare.
      // L'errore lo mostra già il middleware.
      .catch(() => alive && onHide());

    return () => {
      alive = false;
    };
  }, [dispatch, transactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!transaction) return null;

  return (
    <Suspense fallback={null}>
      <TransactionDialog visible onHide={onHide} transaction={transaction} />
    </Suspense>
  );
}

/**
 * Punto unico di montaggio degli sheet globali. Il FAB della tab bar è
 * raggiungibile da ogni schermata, quindi il form di nuova transazione non può
 * più vivere dentro una pagina.
 */
export default function SheetHost() {
  const sheet = useAppSelector(selectActiveSheet);
  const transactions = useAppSelector(selectTransactionTransactions);
  const dispatch = useAppDispatch();

  if (!sheet) return null;

  const hide = () => dispatch(closeSheet());

  // Gli sheet ricevono il movimento, non il suo id: così restano componenti di
  // presentazione e la ricerca sta qui, dove la lista è già in memoria.
  const find = (id: string) =>
    transactions.find((transaction) => String(transaction.id) === String(id));

  switch (sheet.name) {
    case "newTransaction": {
      const transaction = sheet.transactionId
        ? find(sheet.transactionId)
        : undefined;

      // Modifica di un movimento fuori dalla lista: va caricato, non va
      // aperto il form vuoto.
      if (sheet.transactionId && !transaction) {
        return (
          <EditTransactionLoader
            key={sheet.transactionId}
            transactionId={sheet.transactionId}
            onHide={hide}
          />
        );
      }

      return (
        <Suspense fallback={null}>
          <TransactionDialog visible onHide={hide} transaction={transaction} />
        </Suspense>
      );
    }

    case "transactionDetail": {
      const transaction = find(sheet.transactionId);

      // La riga può essere sparita sotto allo sheet (eliminata altrove, o
      // filtrata via da un refetch): senza dato non c'è dettaglio da mostrare.
      if (!transaction) return null;

      return (
        <Suspense fallback={null}>
          <TransactionDetailSheet
            visible
            onHide={hide}
            transaction={transaction}
          />
        </Suspense>
      );
    }

    case "filters":
      return (
        <Suspense fallback={null}>
          <FiltersSheet visible onHide={hide} />
        </Suspense>
      );

    default:
      return null;
  }
}
