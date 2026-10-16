import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProgressSpinner } from "primereact/progressspinner";
import "./bank_callback_page.scss";
import { useAppDispatch } from "../../store/store";
import { confirmBankSession } from "../../features/conti/api_calls";
import { useI18n } from "../../i18n/use-i18n";
import Button from "../../components/legacy_button/legacy_button";

type CallbackStatus = "loading" | "success" | "error";

// Il `code` della banca è monouso, e questa pagina è montata in due alberi di
// rotte (utente non ancora autenticato / autenticato): quando la sessione si
// ripristina a metà, React la rimonta e il `useRef` riparte da capo. Una
// seconda conferma con lo stesso code fallisce e mostrava un errore dopo un
// collegamento riuscito. La conferma vive qui, fuori dal componente: chi
// rimonta si aggancia alla stessa richiesta invece di farne un'altra.
const conferme = new Map<string, Promise<unknown>>();

export default function BankCallbackPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState<string>("");
  // StrictMode monta i componenti due volte in dev: evitiamo la doppia conferma.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Enable Banking rimanda con ?code=...&state=... (o ?error=... se annullato).
    const error = searchParams.get("error");
    if (error) {
      setStatus("error");
      setMessage(searchParams.get("error_description") || t("bank_callback_error"));
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      setStatus("error");
      setMessage(t("bank_callback_missing_ref"));
      return;
    }

    let conferma = conferme.get(code);
    if (!conferma) {
      conferma = dispatch(confirmBankSession({ state, code })).unwrap();
      conferme.set(code, conferma);
    }

    conferma
      .then(() => {
        setStatus("success");
        setMessage(t("bank_callback_success"));
      })
      .catch((err) => {
        setStatus("error");
        const detail =
          (typeof err === "object" && err?.detail) ||
          (typeof err === "string" ? err : null);
        setMessage(detail || t("bank_callback_error"));
      });
  }, [dispatch, searchParams, t]);

  return (
    <div className="bank-callback-page">
      <div className="bank-callback-card">
        {status === "loading" && (
          <>
            <ProgressSpinner style={{ width: "56px", height: "56px" }} />
            <p className="bank-callback-message">
              {t("bank_callback_connecting")}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <i className="ph-bold ph-check-circle bank-callback-icon success" />
            <p className="bank-callback-message">{message}</p>
            <Button
              label={t("back_to_accounts")}
              className="action-button"
              onClick={() => navigate("/accounts")}
            />
          </>
        )}

        {status === "error" && (
          <>
            <i className="ph-bold ph-x-circle bank-callback-icon error" />
            <p className="bank-callback-message">{message}</p>
            <Button
              label={t("back_to_accounts")}
              className="action-button"
              onClick={() => navigate("/accounts")}
            />
          </>
        )}
      </div>
    </div>
  );
}
