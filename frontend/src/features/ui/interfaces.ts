import type { ThemePreference } from "./theme";
import type { ToastItem } from "./toast";

/**
 * Navigazione modale: quale sheet è aperto e con quale payload. Unione
 * discriminata invece di un booleano per dialog — cresce con un caso per ogni
 * sheet del design.
 */
export type ActiveSheet =
  /** Form di inserimento; con `transactionId` è la modifica di un movimento. */
  | { name: "newTransaction"; transactionId?: string }
  | { name: "transactionDetail"; transactionId: string }
  | { name: "filters" };

export interface UiState {
  /** Preferenza di tema dell'utente, persistita in localStorage. */
  theme: ThemePreference;
  /** Sheet attualmente aperto, `null` se nessuno. */
  sheet: ActiveSheet | null;
  /** Coda dei toast visibili, dal più vecchio al più recente. */
  toasts: ToastItem[];
}
