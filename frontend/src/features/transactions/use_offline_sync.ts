import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { selectProfileIsAuthenticated } from "../profile/profile_slice";
import { showToast } from "../ui/ui_slice";
import { t } from "../../i18n";
import { flushOfflineTransactions } from "./api_calls";

/**
 * Invia la coda dei movimenti salvati offline nei momenti in cui la rete può
 * essere tornata.
 *
 * Su iPhone la web app in Home non riceve la sincronizzazione in background:
 * l'invio può partire solo mentre l'app è aperta. Quindi all'avvio, al ritorno
 * della rete (`online`) e quando l'app torna in primo piano. Restituisce la
 * stessa funzione per il bottone "Invia ora".
 */
export function useOfflineSync(): () => Promise<void> {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectProfileIsAuthenticated);

  const sync = useCallback(async () => {
    const result = await dispatch(flushOfflineTransactions());

    if (!flushOfflineTransactions.fulfilled.match(result)) return;

    const sent = result.payload.sent.length;
    if (sent > 0) {
      dispatch(
        showToast({
          variant: "success",
          title: t("offline_sent").replace("{count}", String(sent)),
        }),
      );
    }
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated) return;

    sync();

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated, sync]);

  return sync;
}
