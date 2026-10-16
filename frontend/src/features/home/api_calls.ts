import { createAsyncThunk } from "@reduxjs/toolkit";
import { AxiosError } from "axios";
import api from "../../services/api";
import { MonthlyIncomeExpenseOut, ExpenseCompositionOut } from "../charts/interfaces";
import { Recurring } from "../recurrings/interfaces";
import {
  GetCategoryAveragesParams,
  GetUpcomingParams,
  UpcomingRecurrence,
} from "./interfaces";
import { addMonths, endOfMonth, startOfMonth, toIsoDate } from "./derive";

// Nessuno di questi endpoint è nuovo: la Home ricompone dati che il BE espone
// già, chiedendo a ciascuno la finestra temporale che le serve.

export const getUpcomingRecurrences = createAsyncThunk<
  { items: UpcomingRecurrence[]; days: number },
  GetUpcomingParams
>("home/getUpcomingRecurrences", async ({ days }, { rejectWithValue }) => {
  try {
    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + days);

    const params = new URLSearchParams();
    params.append("attiva", "true");
    params.append("prossima_esecuzione_inizio", toIsoDate(today));
    params.append("prossima_esecuzione_fine", toIsoDate(horizon));

    const response = await api.get<Recurring[]>(
      `/ricorrenze?${params.toString()}`,
    );

    const items = response.data.map((recurring) => ({
      id: String(recurring.id),
      nome: recurring.nome,
      importo: Number(recurring.importo),
      prossima_esecuzione: recurring.prossima_esecuzione,
      conto_id: String(recurring.conto_id),
    }));

    return { items, days };
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore ricezione ricorrenze in arrivo",
    );
  }
});

/** Risparmio del mese precedente: il "vs agosto" del badge sull'hero. */
export const getPreviousMonthSavings = createAsyncThunk<number, void>(
  "home/getPreviousMonthSavings",
  async (_, { rejectWithValue }) => {
    try {
      const previous = addMonths(new Date(), -1);

      const response = await api.get<MonthlyIncomeExpenseOut[]>(
        "/charts/income-expense",
        {
          params: {
            data_inizio: toIsoDate(startOfMonth(previous)),
            data_fine: toIsoDate(endOfMonth(previous)),
          },
        },
      );

      // Il range copre un mese solo: la risposta ha una riga.
      const row = response.data[0];

      // Stessa formula di GET /conti/currentMonthExpenses: gli accantonamenti
      // non sono spese, ma i soldi non restano liberi a fine mese.
      return (
        Number(row?.entrate ?? 0) -
        Number(row?.uscite ?? 0) -
        Number(row?.accantonamento ?? 0)
      );
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione risparmio del mese precedente",
      );
    }
  },
);

/**
 * Media mensile di spesa per categoria sui mesi precedenti: è il riferimento
 * di "sopra media". Una chiamata sola sull'intero intervallo, non una per mese.
 */
export const getCategoryAverages = createAsyncThunk<
  { composition: ExpenseCompositionOut[]; months: number },
  GetCategoryAveragesParams
>("home/getCategoryAverages", async ({ months }, { rejectWithValue }) => {
  try {
    const today = new Date();

    const response = await api.get<ExpenseCompositionOut[]>(
      "/charts/expense-composition",
      {
        params: {
          data_inizio: toIsoDate(startOfMonth(addMonths(today, -months))),
          // Fino a fine mese scorso: il mese corrente è quello da confrontare.
          data_fine: toIsoDate(endOfMonth(addMonths(today, -1))),
        },
      },
    );

    return { composition: response.data, months };
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore ricezione medie per categoria",
    );
  }
});
