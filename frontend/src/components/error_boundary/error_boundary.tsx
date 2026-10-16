import { Component, ErrorInfo, ReactNode } from "react";
import { t } from "../../i18n";
import { buildErrorReport, copyToClipboard } from "../../services/error_log";
import "./error_boundary.scss";

/**
 * L'ultima rete sotto l'albero React.
 *
 * Senza un ErrorBoundary un errore lanciato durante il render non viene
 * catturato da nessuno e React smonta l'intera radice: `#root` resta vuoto e
 * l'utente vede una schermata bianca, senza un messaggio né un modo per
 * uscirne. Su iPhone, con l'app in home, "uscirne" vuol dire chiudere e
 * riaprire — che è esattamente il sintomo che questo componente elimina.
 *
 * Il caso di gran lunga più frequente non è un bug nel render ma un chunk di
 * pagina che non si scarica (vedi `services/lazy_with_retry`), quindi lo
 * distinguiamo: lì il messaggio giusto parla di connessione, non di errore
 * dell'app.
 *
 * Sotto ai due bottoni c'è il motivo per cui questa schermata esiste anche
 * dopo il "Riprova": su un telefono la console non si apre, e senza un modo di
 * portare fuori lo stack un errore visto una volta sola non si ripara.
 */

// I motori scrivono questo errore ognuno a modo suo: WebKit "Importing a module
// script failed", Chrome "Failed to fetch dynamically imported module", Vite
// aggiunge la sua per il CSS preso in preload.
const CHUNK_ERROR_HINTS = [
  "dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
  "failed to fetch",
  "load failed",
];

const isChunkError = (error: Error | null): boolean => {
  const message = (error?.message ?? "").toLowerCase();
  return CHUNK_ERROR_HINTS.some((hint) => message.includes(hint));
};

type Props = { children: ReactNode };
type State = {
  error: Error | null;
  componentStack: string | null;
  /** `manual` = gli appunti non erano disponibili, il testo si copia a mano. */
  copied: "no" | "yes" | "manual";
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, copied: "no" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Non c'è raccolta errori lato server: la console resta l'unico posto dove
    // ritrovare lo stack collegando l'iPhone al Web Inspector — e il bottone
    // qui sotto l'unico modo di leggerlo senza cavo.
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  // Un reload e non un `setState({error: null})`: `React.lazy` si ricorda per
  // sempre della promise rifiutata, quindi rimontare lo stesso albero
  // ripresenterebbe subito lo stesso errore. Ricaricare la pagina è l'unico
  // modo di dare al chunk una possibilità vera.
  private retry = () => {
    window.location.reload();
  };

  private report = () =>
    buildErrorReport(this.state.error, this.state.componentStack);

  private copy = async () => {
    const ok = await copyToClipboard(this.report());
    this.setState({ copied: ok ? "yes" : "manual" });
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    const offline = isChunkError(error);

    return (
      <div className="error-boundary" role="alert">
        <span className="error-boundary__icon" aria-hidden="true">
          <i className={offline ? "ph-bold ph-wifi-slash" : "ph-bold ph-warning"} />
        </span>

        <div className="error-boundary__text">
          <h1 className="error-boundary__title">
            {t(offline ? "error_title_chunk" : "error_title_crash")}
          </h1>
          <p className="error-boundary__message">
            {t(offline ? "error_chunk" : "error_crash")}
          </p>
        </div>

        <button
          type="button"
          className="error-boundary__action"
          onClick={this.retry}
        >
          {t("error_retry")}
        </button>

        <button
          type="button"
          className="error-boundary__copy"
          onClick={this.copy}
        >
          <i
            className={copied === "yes" ? "ph-bold ph-check" : "ph-bold ph-copy"}
            aria-hidden="true"
          />
          {copied === "yes" ? t("error_copied") : t("error_copy")}
        </button>

        {/* Gli appunti hanno detto di no (succede fuori da https, o se il
            permesso è negato): il testo si seleziona a mano. */}
        {copied === "manual" && (
          <div className="error-boundary__manual">
            <p className="error-boundary__manual-hint">
              {t("error_copy_manual")}
            </p>
            <textarea
              className="error-boundary__report"
              readOnly
              rows={10}
              value={this.report()}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}
      </div>
    );
  }
}
