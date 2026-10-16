import { Action, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store/store";
import {
  MonthlyDetailCategory,
  MonthlyDetailResponse,
  YearDetailsResponse,
  YearDetailsStatRow,
} from "./interfaces";
import {
  getMonthRefunds,
  getMonthlyDetailsStatistics,
  getPreviousMonthSavings,
  getYearDetailsStatistics,
} from "./api_calls";

interface StatisticsState {
  yearlyData: YearDetailsStatRow[];
  /** Totali dell'anno selezionato; le uscite arrivano negative. */
  yearlyTotals: {
    incomes: number;
    expenses: number;
    accantonamento: number;
  };
  monthlyData: MonthlyDetailCategory[];
  totals: {
    incomes: number;
    expenses: number;
    accantonamento: number;
    total: number;
  };
  /** Netto del mese precedente: il riferimento del badge di variazione. */
  previousTotal: number | null;
  /** Rimborsi del mese, che i totali di `monthDetails` non contengono. */
  refunds: number;
  loading: boolean;
}

const initialState: StatisticsState = {
  yearlyData: [],
  yearlyTotals: { incomes: 0, expenses: 0, accantonamento: 0 },
  monthlyData: [],
  totals: {
    incomes: 0,
    expenses: 0,
    accantonamento: 0,
    total: 0,
  },
  previousTotal: null,
  refunds: 0,
  loading: false,
};

const handlePending = (state: StatisticsState) => {
  state.loading = true;
};

const handleRejected = (state: StatisticsState) => {
  state.loading = false;
};

const statisticsSlice = createSlice({
  name: "statistics",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(
        getYearDetailsStatistics.fulfilled,
        (state, action: PayloadAction<YearDetailsResponse>) => {
          state.loading = false;
          state.yearlyData = action.payload.data;
          state.yearlyTotals = {
            incomes: Number(action.payload.totale_entrata ?? 0),
            expenses: Number(action.payload.totale_uscita ?? 0),
            accantonamento: Number(action.payload.totale_accantonamento ?? 0),
          };
        },
      )

      .addCase(
        getMonthlyDetailsStatistics.fulfilled,
        (state, action: PayloadAction<MonthlyDetailResponse>) => {
          state.loading = false;
          state.monthlyData = action.payload.data;
          state.totals.incomes = action.payload.totale_entrata;
          state.totals.expenses = action.payload.totale_uscita;
          state.totals.accantonamento =
            action.payload.totale_accantonamento ?? 0;
          state.totals.total = action.payload.totale;
        },
      )

      .addCase(
        getPreviousMonthSavings.fulfilled,
        (state, action: PayloadAction<number>) => {
          state.previousTotal = action.payload;
        },
      )

      .addCase(
        getMonthRefunds.fulfilled,
        (state, action: PayloadAction<number>) => {
          state.refunds = action.payload;
        },
      )

      // Matchers (rimangono invariati)
      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") &&
          action.type.startsWith("statistics/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("statistics/"),
        handleRejected,
      );
  },
});

// Selectors
export const selectYearlyStatisticsData = (state: RootState) =>
  state.statistics.yearlyData;
export const selectMonthlyStatisticsData = (state: RootState) =>
  state.statistics.monthlyData;
export const selectMonthlyTotals = (state: RootState) =>
  state.statistics.totals;
export const selectYearlyTotals = (state: RootState) =>
  state.statistics.yearlyTotals;

export const selectPreviousMonthSavings = (state: RootState) =>
  state.statistics.previousTotal;

export const selectMonthRefunds = (state: RootState) =>
  state.statistics.refunds;

export const selectStatisticsLoading = (state: RootState) =>
  state.statistics.loading;

export default statisticsSlice.reducer;
