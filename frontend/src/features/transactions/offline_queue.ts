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
}

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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isQueued) : [];
  } catch {
    return [];
  }
};

export const saveQueue = (queue: QueuedTransaction[]): void => {
  try {
    if (queue.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage pieno o negato: la voce resta almeno nello stato in memoria.
  }
};

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

/** Le voci che l'utente collegato può inviare. */
export const queueOf = (
  queue: QueuedTransaction[],
  owner: string | null,
): QueuedTransaction[] => queue.filter((queued) => queued.owner === owner);
