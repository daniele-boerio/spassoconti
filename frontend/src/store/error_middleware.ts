import { Middleware } from "@reduxjs/toolkit";
import { showError } from "../features/error/error_slice";
import { setLogout } from "../features/profile/profile_slice";
import { ApiError, isApiError } from "../services/api_error";
import { t } from "../i18n";
import { isQueuedOffline } from "../features/transactions/offline_queue";

// Un 401 su login/registrazione vuol dire "credenziali sbagliate", non "sessione
// scaduta": va mostrato il messaggio del server, non buttato fuori l'utente (che
// dentro non c'è ancora mai stato).
const CREDENTIAL_THUNKS = ["profile/login/", "profile/register/"];

const titleKey = (status: number): string => {
  if (status === 400 || status === 422) return "error_title_validation";
  if (status === 403) return "error_title_forbidden";
  if (status === 404) return "error_title_not_found";
  if (status === 409) return "error_title_conflict";
  if (status === 429) return "error_title_rate_limited";
  if (status >= 500) return "error_title_server";
  return "error";
};

const buildMessage = (error: ApiError): string => {
  // Sui 429 il messaggio del server ("Rate limit exceeded: 10 per 1 minute") è
  // tecnico e non dice all'utente cosa fare.
  if (error.status === 429) return t("error_rate_limited");

  let message =
    error.detail || t(error.status >= 500 ? "error_server" : "error_generic");

  // Il riferimento è l'unico appiglio per ritrovare la traceback lato server.
  if (error.error_id && !message.includes(error.error_id)) {
    message = `${message} (${t("error_reference")} ${error.error_id})`;
  }

  return message;
};

export const errorMiddleware: Middleware =
  (store) => (next) => (action: any) => {
    if (!action.type?.endsWith("/rejected")) return next(action);

    // Un thunk annullato (o mai partito per `condition`) non è un errore da mostrare.
    if (action.meta?.aborted || action.meta?.condition) return next(action);

    const payload = action.payload;

    // Movimento messo in coda senza rete: non è fallito, partirà più tardi.
    // Lo comunica il form con un toast suo.
    if (isQueuedOffline(payload)) return next(action);

    // CASO 1 — il server ha risposto: `services/api.js` ha già normalizzato il corpo.
    if (isApiError(payload)) {
      const isCredentialCheck = CREDENTIAL_THUNKS.some((prefix) =>
        action.type.startsWith(prefix),
      );

      if (payload.status === 401 && !isCredentialCheck) {
        // All'avvio l'app parte fidandosi del token salvato, quindi monta tutte
        // le schermate e ognuna chiama il server: se quel token era vecchio,
        // arrivano dieci 401 insieme. Non è una sessione scaduta sotto le mani
        // dell'utente — è un tentativo di ripristino andato a vuoto, e la
        // schermata di accesso che compare lo dice già da sola.
        const restoring = store.getState().profile?.restoring;

        // Il refresh automatico ha già fallito (vedi services/api.js): la sessione
        // è finita davvero. Meglio dirlo che far sparire i dati senza spiegazioni.
        store.dispatch(setLogout());

        if (!restoring) {
          store.dispatch(
            showError({
              title: t("error_title_session_expired"),
              message: t("error_session_expired"),
            }),
          );
        }

        return next(action);
      }

      store.dispatch(
        showError({
          title: `${t(titleKey(payload.status))} (${payload.status})`,
          message: buildMessage(payload),
        }),
      );
      return next(action);
    }

    // CASO 2 — nessuna risposta (rete, CORS, timeout): il payload è la stringa di
    // fallback del thunk, che dice almeno quale operazione è fallita.
    if (typeof payload === "string" && payload) {
      store.dispatch(
        showError({
          title: t("error_title_network"),
          message: `${t("error_network")} (${payload})`,
        }),
      );
      return next(action);
    }

    // CASO 3 — eccezione fuori da una chiamata HTTP (bug nel thunk): il messaggio
    // dell'errore JS è comunque più utile di "Errore".
    // "Rejected" è il placeholder di Redux Toolkit quando si usa rejectWithValue.
    const jsMessage = action.error?.message;
    store.dispatch(
      showError({
        title: t("error"),
        message:
          jsMessage && jsMessage !== "Rejected"
            ? jsMessage
            : t("error_generic"),
      }),
    );

    return next(action);
  };
