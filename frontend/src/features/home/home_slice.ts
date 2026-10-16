import { Action, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store/store";
import { HomeState, UpcomingRecurrence } from "./interfaces";
import { ExpenseCompositionOut } from "../charts/interfaces";
import { monthlyAverage } from "./derive";
import {
  getCategoryAverages,
  getPreviousMonthSavings,
  getUpcomingRecurrences,
} from "./api_calls";

const initialState: HomeState = {
  loading: false,
  upcoming: [],
  upcomingDays: 0,
  previousMonthSavings: null,
  categoryAverages: {},
};

// Dati che il BE non espone come tali: la Home li ricompone da endpoint
// esistenti. L'aggregazione sta qui, non nel componente.
const homeSlice = createSlice({
  name: "home",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(
        getUpcomingRecurrences.fulfilled,
        (
          state,
          action: PayloadAction<{ items: UpcomingRecurrence[]; days: number }>,
        ) => {
          state.upcoming = action.payload.items;
          state.upcomingDays = action.payload.days;
        },
      )

      .addCase(
        getPreviousMonthSavings.fulfilled,
        (state, action: PayloadAction<number>) => {
          state.previousMonthSavings = action.payload;
        },
      )

      .addCase(
        getCategoryAverages.fulfilled,
        (
          state,
          action: PayloadAction<{
            composition: ExpenseCompositionOut[];
            months: number;
          }>,
        ) => {
          const { composition, months } = action.payload;

          state.categoryAverages = Object.fromEntries(
            composition.map((entry) => [
              entry.categoria,
              monthlyAverage(Number(entry.totale), months),
            ]),
          );
        },
      )

      .addMatcher(
        (action: Action) =>
          action.type.startsWith("home/") && action.type.endsWith("/pending"),
        (state) => {
          state.loading = true;
        },
      )
      .addMatcher(
        (action: Action) =>
          action.type.startsWith("home/") &&
          (action.type.endsWith("/fulfilled") ||
            action.type.endsWith("/rejected")),
        (state) => {
          state.loading = false;
        },
      );
  },
});

export const selectHomeLoading = (state: RootState) => state.home.loading;

export const selectHomeUpcoming = (state: RootState) => state.home.upcoming;

export const selectHomeUpcomingDays = (state: RootState) =>
  state.home.upcomingDays;

export const selectHomePreviousMonthSavings = (state: RootState) =>
  state.home.previousMonthSavings;

export const selectHomeCategoryAverages = (state: RootState) =>
  state.home.categoryAverages;

export default homeSlice.reducer;
