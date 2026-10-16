import { describe, it, expect, beforeEach, vi } from "vitest";

// `conto_slice` legge localStorage a import-time (la preferenza "includi le
// ricorrenti future") e i test girano in node: va stubbato PRIMA degli import,
// stesso pattern di ui_slice.test.ts.
vi.hoisted(() => {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  } as Storage;
});

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import reducer, { setIncludeFutureRecurring } from "./conto_slice";
import {
  getCurrentMonthExpenses,
  getCurrentMonthExpensesByCategory,
} from "./api_calls";
import { createTransaction } from "../transactions/api_calls";
import { Transaction } from "../transactions/interfaces";
import api from "../../services/api";
import { RootState } from "../../store/store";

const initial = reducer(undefined, { type: "@@INIT" });

// I thunk qui sotto girano a mano, senza store: dell'HTTP ci serve solo sapere
// con che URL è stato chiamato.
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>;

const storeConIlFlag = (include: boolean) =>
  ({ conto: { include_future_recurring: include } }) as RootState;

const budgetFromServer = (remaining: number) =>
  getCurrentMonthExpenses.fulfilled(
    {
      monthly_budget: { total_budget: 1000, remaining, percentage: null },
      spending: {
        budget: null,
        spent: 0,
        projected: 0,
        remaining: null,
        percentage: null,
      },
      income: 0,
      saved: 0,
    },
    "req",
    undefined,
  );

const pieFromServer = (value: number) =>
  getCurrentMonthExpensesByCategory.fulfilled(
    [{ label: "Casa", value }],
    "req",
    undefined,
  );

const transactionCreated = (tipo: string, importo: number) =>
  createTransaction.fulfilled(
    {
      id: "1",
      importo,
      tipo,
      data: new Date().toISOString(),
      conto_id: "1",
      categoria: { id: "1", nome: "Casa" },
    } as unknown as Transaction,
    "req",
    {} as never,
  );

/**
 * Il thunk createTransaction attende il refetch di budget e grafico PRIMA di
 * risolvere, quindi le loro `fulfilled` arrivano sempre prima della propria.
 * Questi test fissano quell'ordine: chi arriva dopo non deve riapplicare nulla.
 */
describe("conto_slice — totali del mese dopo una nuova transazione", () => {
  it("non raddoppia la spesa nel grafico per categoria", () => {
    let state = initial;
    state = reducer(state, pieFromServer(50)); // server: già include i 50
    state = reducer(state, transactionCreated("USCITA", 50));

    expect(state.monthlyExpensesByCategory).toEqual([
      { label: "Casa", value: 50 },
    ]);
  });

  it("non sottrae due volte l'accantonamento dal risparmio", () => {
    let state = initial;
    state = reducer(state, budgetFromServer(200)); // server: già al netto dei 50
    state = reducer(state, transactionCreated("ACCANTONAMENTO", 50));

    expect(state.monthlyBudget.remaining).toBe(200);
  });

  it("lascia al server il risparmio anche dopo una spesa", () => {
    let state = initial;
    state = reducer(state, budgetFromServer(150));
    state = reducer(state, transactionCreated("USCITA", 50));

    expect(state.monthlyBudget.remaining).toBe(150);
  });

  it("aggiorna comunque il saldo del conto (getConti non viene rifetchato)", () => {
    let state = reducer(initial, {
      type: "conti/getConti/fulfilled",
      // bastano i campi letti dal reducer
      payload: [{ id: "1", saldo: "1000" }],
    });
    state = reducer(state, transactionCreated("USCITA", 50));

    expect(state.conti[0].saldo).toBe(950);
  });

  it("converte a Number i Decimal che arrivano come stringhe", () => {
    const state = reducer(
      initial,
      getCurrentMonthExpenses.fulfilled(
        {
          monthly_budget: {
            total_budget: "1000.00" as unknown as number,
            remaining: "-42.50" as unknown as number,
            percentage: null,
          },
          spending: {
            budget: "1200.00" as unknown as number,
            spent: "900.00" as unknown as number,
            projected: "650.00" as unknown as number,
            remaining: "300.00" as unknown as number,
            percentage: 75,
          },
          income: "1850.00" as unknown as number,
          saved: "125.00" as unknown as number,
        },
        "req",
        undefined,
      ),
    );

    expect(state.monthlyBudget.total_budget).toBe(1000);
    expect(state.monthlyBudget.remaining).toBe(-42.5);

    // Il tetto di spesa è un blocco a parte: obiettivo di risparmio e tetto di
    // spesa non si sovrascrivono a vicenda.
    expect(state.monthlySpending).toEqual({
      budget: 1200,
      spent: 900,
      projected: 650,
      remaining: 300,
      percentage: 75,
    });
    expect(state.monthIncome).toBe(1850);
    expect(state.monthSaved).toBe(125);
  });

  it("tiene il tetto di spesa a null finché l'utente non lo imposta", () => {
    const state = reducer(initial, budgetFromServer(100));

    expect(state.monthlySpending.budget).toBeNull();
    expect(state.monthlySpending.remaining).toBeNull();
    expect(state.monthlySpending.percentage).toBeNull();
    // Lo speso c'è comunque: l'hero mostra le spese anche senza tetto.
    expect(state.monthlySpending.spent).toBe(0);
  });
});

describe("preferenza «includi le ricorrenti future»", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ricorda la scelta oltre il refresh", () => {
    const acceso = reducer(initial, setIncludeFutureRecurring(true));

    expect(acceso.include_future_recurring).toBe(true);
    // È l'unico posto dove la preferenza sopravvive: senza, bastava ricaricare
    // la pagina per ritrovare la spunta spenta.
    expect(localStorage.getItem("includeFutureRecurring")).toBe("true");

    const spento = reducer(acceso, setIncludeFutureRecurring(false));

    expect(spento.include_future_recurring).toBe(false);
    expect(localStorage.getItem("includeFutureRecurring")).toBe("false");
  });
});

describe("getCurrentMonthExpenses", () => {
  beforeEach(() => {
    apiGet.mockClear();
    apiGet.mockResolvedValue({ data: {} });
  });

  // Il bug: chi ricaricava la card del mese senza ripassare il flag faceva
  // ricadere il BE sul default (`false`), e il risparmio tornava indietro con
  // la spunta ancora accesa. Ora il valore di riserva è quello dello store.
  it("manda comunque la preferenza dello store quando nessuno passa il flag", async () => {
    await getCurrentMonthExpenses()(
      vi.fn(),
      () => storeConIlFlag(true),
      undefined,
    );

    expect(apiGet).toHaveBeenCalledWith(
      "/conti/currentMonthExpenses?include_future_recurring=true",
    );
  });

  it("lascia decidere al chiamante quando il flag lo passa lui", async () => {
    await getCurrentMonthExpenses({ include_future_recurring: false })(
      vi.fn(),
      () => storeConIlFlag(true),
      undefined,
    );

    expect(apiGet).toHaveBeenCalledWith(
      "/conti/currentMonthExpenses?include_future_recurring=false",
    );
  });
});
