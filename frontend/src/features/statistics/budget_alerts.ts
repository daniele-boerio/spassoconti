import { Categoria } from "../categorie/interfaces";
import { ExpenseByCategory } from "../conti/interfaces";

/** Da questa quota consumata in su il budget merita un avviso. */
export const WARNING_PERCENT = 80;

export type BudgetAlertLevel = "warning" | "over";

/** Un budget vicino al limite o già sforato, nel mese corrente. */
export type BudgetAlert = {
  /** "total" per il tetto mensile, "cat:<id>" per una categoria. */
  key: string;
  /** Nome della categoria; null per il tetto di spesa complessivo. */
  nome: string | null;
  speso: number;
  budget: number;
  percent: number;
  level: BudgetAlertLevel;
};

type BudgetAlertsInput = {
  /** Uscite nette del mese per categoria, come le dà /conti/expensesByCategory. */
  byCategory: ExpenseByCategory[];
  categorie: Categoria[];
  /** Tetto di spesa del mese e quanto si è speso (card della Home). */
  spending: { budget: number | null; spent: number };
};

const levelOf = (speso: number, budget: number): BudgetAlertLevel | null => {
  // Un budget a zero è "non spenderci niente": qualsiasi spesa lo sfora.
  if (budget <= 0) return speso > 0 ? "over" : null;
  if (speso > budget) return "over";
  if ((speso / budget) * 100 >= WARNING_PERCENT) return "warning";
  return null;
};

const percentOf = (speso: number, budget: number) =>
  budget > 0 ? (speso / budget) * 100 : speso > 0 ? 100 : 0;

/**
 * I budget che meritano attenzione questo mese: il tetto complessivo e quelli
 * per categoria, dal più consumato.
 *
 * Il speso per categoria arriva per nome (è l'unica chiave della torta), come
 * in `budgetRows`.
 */
export function budgetAlerts({
  byCategory,
  categorie,
  spending,
}: BudgetAlertsInput): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  if (spending.budget !== null) {
    const level = levelOf(spending.spent, spending.budget);
    if (level) {
      alerts.push({
        key: "total",
        nome: null,
        speso: spending.spent,
        budget: spending.budget,
        percent: percentOf(spending.spent, spending.budget),
        level,
      });
    }
  }

  const spesoPerNome = new Map(
    byCategory.map((entry) => [entry.label, Number(entry.value)]),
  );

  for (const categoria of categorie) {
    if (categoria.budget_mensile === null || categoria.budget_mensile === undefined) {
      continue;
    }

    const budget = Number(categoria.budget_mensile);
    const speso = spesoPerNome.get(categoria.nome) ?? 0;
    const level = levelOf(speso, budget);

    if (level) {
      alerts.push({
        key: `cat:${categoria.id}`,
        nome: categoria.nome,
        speso,
        budget,
        percent: percentOf(speso, budget),
        level,
      });
    }
  }

  return alerts.sort((a, b) => b.percent - a.percent);
}

// --- Avvisi già mostrati ---------------------------------------------------
//
// Il toast compare una volta per budget e per livello nel mese: passare da
// "quasi" a "sforato" avvisa di nuovo, riaprire la Home no. La card invece
// resta visibile finché il budget è in quella condizione.

const SEEN_STORAGE_KEY = "budget_alerts_seen_v1";

export type SeenAlerts = { month: string; seen: string[] };

export const alertId = (alert: BudgetAlert) => `${alert.key}:${alert.level}`;

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Gli avvisi non ancora mostrati questo mese. */
export function unseenAlerts(
  alerts: BudgetAlert[],
  seen: SeenAlerts | null,
  month: string,
): BudgetAlert[] {
  const already = seen && seen.month === month ? new Set(seen.seen) : new Set();
  return alerts.filter((alert) => !already.has(alertId(alert)));
}

export function markSeen(
  alerts: BudgetAlert[],
  seen: SeenAlerts | null,
  month: string,
): SeenAlerts {
  const base = seen && seen.month === month ? seen.seen : [];
  return {
    month,
    seen: Array.from(new Set([...base, ...alerts.map(alertId)])),
  };
}

export const loadSeenAlerts = (): SeenAlerts | null => {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SeenAlerts) : null;
  } catch {
    return null;
  }
};

export const saveSeenAlerts = (seen: SeenAlerts): void => {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // Senza storage il toast si ripresenta: fastidio, non un errore.
  }
};
