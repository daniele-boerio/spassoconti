export type ToastVariant = "success" | "error" | "offline";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  /** Seconda riga: il contesto dell'errore ("Conto Principale · ieri"). */
  meta?: string;
  actionLabel?: string;
  /** Millisecondi prima della chiusura automatica; 0 = resta finché non si tocca. */
  duration: number;
}

// Le callback non sono serializzabili e non possono stare nello store: le
// teniamo qui, indicizzate per id del toast, e le ripuliamo alla chiusura.
const handlers = new Map<string, () => void>();

export function registerToastAction(id: string, handler: () => void): void {
  handlers.set(id, handler);
}

export function runToastAction(id: string): void {
  handlers.get(id)?.();
  handlers.delete(id);
}

export function forgetToastAction(id: string): void {
  handlers.delete(id);
}
