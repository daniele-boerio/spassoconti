import { AxiosError } from "axios";
import { CreateTransactionParams } from "./interfaces";

/**
 * Coda dei movimenti salvati senza rete.
 *
 * Su iPhone la web app aggiunta alla Home non ha la sincronizzazione in
 * background: una transazione salvata senza campo resta qui (localStorage,
 * che sopravvive alla chiusura dell'app) e parte al primo momento utile con
 * la rete — riapertura dell'app, ritorno online, tocco su "Invia ora".
 *
 * Ogni voce porta la sua chiave di idempotenza: se l'invio arriva al server
 * ma la risposta si perde, il nuovo tentativo riceve la transazione già creata
 * invece di duplicarla.
 */

export interface QueuedTransaction {
  /** Chiave di idempotenza, e insieme identificativo della voce in coda. */
  key: string;
  /** Utente che l'ha salvata: la coda non deve partire con l'account di un altro. */
  owner: string | null;
  params: CreateTransactionParams;
  queuedAt: string;
  /** Invii tentati e falliti per un motivo passeggero (rete, server giù). */
  attempts?: number;
  /** Perché l'ultimo tentativo non è andato: "network" o "HTTP 503"… */
  lastError?: string;
  /**
   * Rifiutato dal server (4xx definitivo): non si riprova da solo, ma non si
   * butta nemmeno. Resta finché l'utente non sceglie Riprova o Elimina: prima
   * veniva tolto dalla coda con un toast che bastava non vedere per perderlo.
   */
  failed?: { status: number; detail: string | null };
}

/** Dopo questi tentativi falliti il banner dice che il server non risponde. */
export const STUCK_AFTER_ATTEMPTS = 3;

/**
 * Risposte per cui ha senso riprovare più tardi: server giù, sessione da
 * rinnovare, timeout, conflitto o troppe richieste. Il resto dei 4xx è un
 * "no" definitivo del server sul contenuto.
 */
export const isTransientStatus = (status: number): boolean =>
  status >= 500 || [401, 408, 409, 425, 429].includes(status);

const STORAGE_KEY = "offline_transactions_v1";

/**
 * Payload con cui `createTransaction` rifiuta quando ha messo il movimento in
 * coda: non è un errore da mostrare, è un "salvato più tardi".
 */
export const QUEUED_OFFLINE = { queuedOffline: true } as const;

export const isQueuedOffline = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  (value as { queuedOffline?: unknown }).queuedOffline === true;

/** Nessuna risposta dal server: rete assente, timeout, DNS. */
export const isNetworkError = (error: unknown): boolean => {
  const err = error as AxiosError | undefined;
  if (!err || typeof err !== "object") return false;
  if (err.code === "ERR_CANCELED") return false;
  return Boolean(err.isAxiosError) && !err.response;
};

export const newIdempotencyKey = (): string => {
  // randomUUID c'è da iOS 15.4; il ripiego serve solo a browser vecchi.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const isQueued = (value: unknown): value is QueuedTransaction => {
  const item = value as QueuedTransaction;
  return (
    typeof item === "object" &&
    item !== null &&
    typeof item.key === "string" &&
    typeof item.params === "object" &&
    item.params !== null
  );
};

export const loadQueue = (): QueuedTransaction[] => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isQueued) : [];
  } catch {
    // Illeggibile: il prossimo saveQueue lo sovrascriverebbe, e quei movimenti
    // sparirebbero. Prima se ne tiene una copia da cui si possono recuperare.
    // raw null = storage non disponibile (negato, o i test in Node): niente
    // da salvare né da segnalare.
    if (raw) {
      try {
        localStorage.setItem(`${STORAGE_KEY}_corrupt_${Date.now()}`, raw);
      } catch {
        // Storage pieno: non c'è niente di meglio da fare.
      }
      console.error("Coda offline illeggibile: salvata una copia di backup");
    }
    return [];
  }
};

/**
 * Scrive la coda sul telefono. `false` se lo storage è pieno o negato: la
 * voce resta solo in memoria e si perde alla chiusura dell'app, quindi chi
 * chiama lo deve far sapere (vedi `pendingNotSaved` nello slice).
 */
export const saveQueue = (queue: QueuedTransaction[]): boolean => {
  try {
    if (queue.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
};

/** Segna il rifiuto definitivo del server: la voce resta, ma non riparte da sola. */
export const markFailed = (
  queue: QueuedTransaction[],
  key: string,
  failed: { status: number; detail: string | null },
): QueuedTransaction[] =>
  queue.map((queued) => (queued.key === key ? { ...queued, failed } : queued));

/** Conta un tentativo andato a vuoto per un motivo passeggero. */
export const markAttempt = (
  queue: QueuedTransaction[],
  key: string,
  reason: string,
): QueuedTransaction[] =>
  queue.map((queued) =>
    queued.key === key
      ? { ...queued, attempts: (queued.attempts ?? 0) + 1, lastError: reason }
      : queued,
  );

/** "Riprova": la voce rifiutata torna in coda da inviare. */
export const clearFailure = (
  queue: QueuedTransaction[],
  key: string,
): QueuedTransaction[] =>
  queue.map((queued) =>
    queued.key === key
      ? { ...queued, failed: undefined, attempts: 0, lastError: undefined }
      : queued,
  );

/** Aggiunge una voce; la stessa chiave non entra due volte. */
export const enqueue = (
  queue: QueuedTransaction[],
  item: QueuedTransaction,
): QueuedTransaction[] =>
  queue.some((queued) => queued.key === item.key) ? queue : [...queue, item];

export const dequeue = (
  queue: QueuedTransaction[],
  key: string,
): QueuedTransaction[] => queue.filter((queued) => queued.key !== key);

/** Le voci dell'utente collegato (comprese quelle rifiutate, da mostrare). */
export const queueOf = (
  queue: QueuedTransaction[],
  owner: string | null,
): QueuedTransaction[] => queue.filter((queued) => queued.owner === owner);

/** Le voci che il flush deve provare a inviare: le rifiutate aspettano l'utente. */
export const sendableOf = (
  queue: QueuedTransaction[],
  owner: string | null,
): QueuedTransaction[] => queueOf(queue, owner).filter((queued) => !queued.failed);
