import { describe, expect, it } from "vitest";
import reducer from "./charts_slice";
import { getIncomeExpenseChart } from "./api_calls";

// Cambiando anno o filtri in fretta partono più richieste dello stesso grafico:
// vale l'ultima partita, anche se la risposta di una vecchia arriva dopo.
describe("grafici con risposte fuori ordine", () => {
  const args = {} as Parameters<typeof getIncomeExpenseChart>[0];
  const serie = (mese: number) =>
    [{ year: 2026, month: mese, entrate: 1, uscite: 1 }] as unknown as Parameters<
      typeof getIncomeExpenseChart.fulfilled
    >[0];

  it("la risposta di una richiesta superata si ignora", () => {
    let state = reducer(undefined, { type: "@@init" });
    state = reducer(state, getIncomeExpenseChart.pending("vecchia", args));
    state = reducer(state, getIncomeExpenseChart.pending("nuova", args));

    state = reducer(state, getIncomeExpenseChart.fulfilled(serie(2), "nuova", args));
    state = reducer(state, getIncomeExpenseChart.fulfilled(serie(1), "vecchia", args));

    expect(state.incomeExpense).toEqual(serie(2));
  });
});
