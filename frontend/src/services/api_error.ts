/**
 * Normalizzazione degli errori HTTP.
 *
 * Il BE non parla con una voce sola: `{detail: "..."}` sui router, `detail` come
 * ARRAY sui 422 di FastAPI, `{error: "..."}` sui 429 di slowapi, testo semplice se
 * la risposta arriva da un proxy. Passare quel corpo grezzo alla UI significa
 * mostrare all'utente un JSON, o "Rejected", o niente.
 *
 * Qui diventa sempre la stessa forma: uno `status` e un `detail` già leggibile.
 * La conversione è fatta una volta sola nell'interceptor di `services/api.js`, così
 * ogni thunk esistente (e futuro) la eredita senza doversene ricordare.
 */

/** Errore con risposta del server: è ciò che finisce in `rejectWithValue`. */
export interface ApiError {
  status: number;
  /** Messaggio già pronto da mostrare. Stringa vuota se il corpo non ne conteneva uno. */
  detail: string;
  /** Riferimento generato dal BE: lo stesso codice compare nei suoi log. */
  error_id?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isApiError = (value: unknown): value is ApiError =>
  isRecord(value) &&
  typeof value.status === "number" &&
  typeof value.detail === "string";

// Errori di validazione FastAPI: detail = [{loc: ["body", "importo"], msg, type}].
// "body"/"query"/"path" non dicono nulla all'utente, il nome del campo sì.
const CONTAINER_LOCS = ["body", "query", "path", "header", "cookie"];

const formatValidationErrors = (items: unknown[]): string =>
  items
    .map((item) => {
      if (!isRecord(item)) return "";
      const msg = typeof item.msg === "string" ? item.msg : "";
      const field = Array.isArray(item.loc)
        ? item.loc
            .filter(
              (part): part is string =>
                typeof part === "string" && !CONTAINER_LOCS.includes(part),
            )
            .join(".")
        : "";
      return field && msg ? `${field}: ${msg}` : field || msg;
    })
    .filter(Boolean)
    .join("; ");

const extractDetail = (data: unknown): string => {
  if (typeof data === "string") {
    // Una pagina d'errore HTML (proxy, gateway) non è un messaggio da mostrare.
    const text = data.trim();
    return text.startsWith("<") ? "" : text;
  }

  if (!isRecord(data)) return "";

  // `error` è il formato di slowapi sui 429, `message` quello di qualche handler.
  const raw = data.detail ?? data.error ?? data.message;

  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return formatValidationErrors(raw);
  if (raw !== undefined) return JSON.stringify(raw);
  return "";
};

/**
 * Costruisce l'ApiError dal corpo della risposta. Idempotente: applicarla a un
 * ApiError già normalizzato lo restituisce invariato.
 */
export const toApiError = (status: number, data: unknown): ApiError => {
  if (isApiError(data)) return data;

  const error: ApiError = { status, detail: extractDetail(data) };

  if (isRecord(data) && typeof data.error_id === "string") {
    error.error_id = data.error_id;
  }

  return error;
};
