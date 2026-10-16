import { createSlice, PayloadAction, Action } from "@reduxjs/toolkit";
import {
  createRecurring,
  deleteRecurring,
  executeRecurring,
  getRecurrings,
  updateRecurring,
} from "./api_calls";
import { Recurring, RecurringsState } from "./interfaces";
import { RootState } from "../../store/store";

const initialState: RecurringsState = {
  loading: false,
  recurrings: [],
  selectedRecurring: null,
  filters: {
    sort_by: ["prossima_esecuzione:asc"],
  },
};

// --- HELPERS ---

// Converte l'importo da stringa (Decimal) a number per il frontend
const mapRecurring = (rec: Recurring): Recurring => ({
  ...rec,
  importo: Number(rec.importo),
});

const handlePending = (state: RecurringsState) => {
  state.loading = true;
};

const handleRejected = (state: RecurringsState) => {
  state.loading = false;
};

const recurringsSlice = createSlice({
  name: "recurrings",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // get Recurring Transactions
      .addCase(
        getRecurrings.fulfilled,
        (state, action: PayloadAction<Recurring[]>) => {
          // Mappiamo l'array convertendo gli importi
          state.recurrings = action.payload.map(mapRecurring);
        },
      )
      // Create Recurring Transaction
      .addCase(
        createRecurring.fulfilled,
        (state, action: PayloadAction<Recurring>) => {
          state.recurrings.push(mapRecurring(action.payload));
        },
      )

      .addCase(
        updateRecurring.fulfilled,
        (state, action: PayloadAction<Recurring>) => {
          const index = state.recurrings.findIndex(
            (rec) => rec.id === action.payload.id,
          );
          if (index !== -1) {
            state.recurrings[index] = mapRecurring(action.payload);
          }
        },
      )

      // Registrata a mano: il server torna la ricorrenza con la data già
      // spostata alla prossima occorrenza.
      .addCase(
        executeRecurring.fulfilled,
        (state, action: PayloadAction<Recurring>) => {
          const index = state.recurrings.findIndex(
            (rec) => String(rec.id) === String(action.payload.id),
          );
          if (index !== -1) {
            state.recurrings[index] = mapRecurring(action.payload);
          }
        },
      )

      .addCase(
        deleteRecurring.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.recurrings = state.recurrings.filter(
            (rec) => String(rec.id) !== String(action.payload),
          );
        },
      )

      // Matchers (rimangono invariati)
      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") &&
          action.type.startsWith("recurring/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("recurring/"),
        handleRejected,
      );
  },
});

export const selectRecurringLoading = (state: RootState) =>
  state.recurring.loading;
export const selectRecurringRecurrings = (state: RootState) =>
  state.recurring.recurrings;
export const selectRecurringSelectedRecurring = (state: RootState) =>
  state.recurring.selectedRecurring;
export const selectRecurringFilters = (state: RootState) =>
  state.recurring.filters;

export default recurringsSlice.reducer;
