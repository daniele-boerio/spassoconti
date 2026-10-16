import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { selectPendingTransactions } from "../../features/transactions/transaction_slice";
import { flushOfflineTransactions } from "../../features/transactions/api_calls";
import { useI18n } from "../../i18n/use-i18n";
import Button from "../button/button";
import "./pending_sync_banner.scss";

/**
 * "N movimenti in attesa di rete": i salvataggi fatti senza campo non sono
 * ancora nei totali e nei saldi, e l'utente deve saperlo. Sparisce da solo
 * quando la coda si svuota.
 */
export default function PendingSyncBanner() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const pending = useAppSelector(selectPendingTransactions);
  const [sending, setSending] = useState(false);

  if (pending.length === 0) return null;

  const label =
    pending.length === 1
      ? t("offline_pending_one")
      : t("offline_pending").replace("{count}", String(pending.length));

  const sendNow = async () => {
    setSending(true);
    try {
      await dispatch(flushOfflineTransactions());
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pending-sync" role="status">
      <i className="ph-bold ph-cloud-arrow-up pending-sync__icon" aria-hidden="true" />
      <span className="pending-sync__text">{label}</span>
      <Button size="sm" variant="neutral" disabled={sending} onClick={sendNow}>
        {t("offline_send_now")}
      </Button>
    </div>
  );
}
