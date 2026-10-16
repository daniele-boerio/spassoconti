import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import {
  discardPendingTransaction,
  retryPendingTransaction,
  selectPendingNotSaved,
  selectPendingTransactions,
} from "../../features/transactions/transaction_slice";
import { flushOfflineTransactions } from "../../features/transactions/api_calls";
import { STUCK_AFTER_ATTEMPTS } from "../../features/transactions/offline_queue";
import { useI18n } from "../../i18n/use-i18n";
import Button from "../button/button";
import "./pending_sync_banner.scss";

/**
 * Lo stato della coda offline, finché c'è qualcosa da dire.
 *
 * - "N movimenti in attesa di rete": i salvataggi fatti senza campo non sono
 *   ancora nei totali e nei saldi, e l'utente deve saperlo;
 * - dopo qualche tentativo andato a vuoto lo dice ("il server non risponde"),
 *   invece di far credere che sia solo questione di rete;
 * - un movimento rifiutato dal server resta qui con il motivo, Riprova ed
 *   Elimina: non sparisce più da solo dopo un toast;
 * - se il telefono non ha potuto salvare la coda, avvisa di non chiudere l'app.
 */
export default function PendingSyncBanner() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const pending = useAppSelector(selectPendingTransactions);
  const notSaved = useAppSelector(selectPendingNotSaved);
  const [sending, setSending] = useState(false);

  const waiting = pending.filter((item) => !item.failed);
  const rejected = pending.filter((item) => item.failed);

  if (waiting.length === 0 && rejected.length === 0 && !notSaved) return null;

  const stuck = waiting.some(
    (item) => (item.attempts ?? 0) >= STUCK_AFTER_ATTEMPTS,
  );
  const waitingLabel = stuck
    ? t("offline_pending_stuck").replace("{count}", String(waiting.length))
    : waiting.length === 1
      ? t("offline_pending_one")
      : t("offline_pending").replace("{count}", String(waiting.length));

  const sendNow = async () => {
    setSending(true);
    try {
      await dispatch(flushOfflineTransactions());
    } finally {
      setSending(false);
    }
  };

  const retry = (key: string) => {
    dispatch(retryPendingTransaction(key));
    void sendNow();
  };

  return (
    <div className="pending-sync-group">
      {waiting.length > 0 && (
        <div className="pending-sync" role="status">
          <i
            className={`ph-bold ${stuck ? "ph-warning" : "ph-cloud-arrow-up"} pending-sync__icon`}
            aria-hidden="true"
          />
          <span className="pending-sync__text">{waitingLabel}</span>
          <Button size="sm" variant="neutral" disabled={sending} onClick={sendNow}>
            {t("offline_send_now")}
          </Button>
        </div>
      )}

      {rejected.map((item) => (
        <div key={item.key} className="pending-sync pending-sync--error" role="alert">
          <i className="ph-bold ph-x-circle pending-sync__icon" aria-hidden="true" />
          <span className="pending-sync__text">
            {t("offline_rejected_item")
              .replace("{name}", item.params.descrizione || t("offline_no_description"))
              .replace("{date}", item.params.data)}
            {item.failed?.detail && (
              <span className="pending-sync__detail">{item.failed.detail}</span>
            )}
          </span>
          <div className="pending-sync__actions">
            <Button size="sm" variant="neutral" disabled={sending} onClick={() => retry(item.key)}>
              {t("offline_retry")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={sending}
              onClick={() => dispatch(discardPendingTransaction(item.key))}
            >
              {t("offline_discard")}
            </Button>
          </div>
        </div>
      ))}

      {notSaved && (
        <div className="pending-sync pending-sync--error" role="alert">
          <i className="ph-bold ph-warning pending-sync__icon" aria-hidden="true" />
          <span className="pending-sync__text">{t("offline_not_saved")}</span>
        </div>
      )}
    </div>
  );
}
