import { createSlice, PayloadAction, Action } from "@reduxjs/toolkit";
import {
  getDebiti,
  createDebito,
  updateDebito,
  deleteDebito,
  payDebito,
} from "./api_calls";
import { Debito, DebitoState } from "./interfaces";
import { RootState } from "../../store/store";

const initialState: DebitoState = {
  loading: false,
  debiti: [],
};

const handlePending = (state: DebitoState) => {
  state.loading = true;
};

const handleRejectedOrFulfilled = (state: DebitoState) => {
  state.loading = false;
};

const debitoSlice = createSlice({
  name: "debiti",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(
        getDebiti.fulfilled,
        (state, action: PayloadAction<Debito[]>) => {
          state.debiti = action.payload;
        },
      )
      .addCase(
        createDebito.fulfilled,
        (state, action: PayloadAction<Debito>) => {
          state.debiti.push(action.payload);
        },
      )
      .addCase(
        updateDebito.fulfilled,
        (state, action: PayloadAction<Debito>) => {
          const index = state.debiti.findIndex(
            (debito) => debito.id === action.payload.id,
          );
          if (index !== -1) {
            state.debiti[index] = action.payload;
          }
        },
      )
      .addCase(
        deleteDebito.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.debiti = state.debiti.filter(
            (debito) => debito.id !== action.payload,
          );
        },
      )
      .addCase(payDebito.fulfilled, (state, action) => {
        const { id, importo } = action.meta.arg;
        const debito = state.debiti.find((item) => item.id === id);
        if (debito) {
          if (debito.residuo !== null && debito.residuo !== undefined) {
            debito.residuo = Math.max(0, debito.residuo - importo);
          }
        }
      })
      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") && action.type.startsWith("debiti/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("debiti/"),
        handleRejectedOrFulfilled,
      );
  },
});

export const selectDebitiLoading = (state: RootState) => state.debiti.loading;
export const selectDebitiDebiti = (state: RootState) => state.debiti.debiti;

export default debitoSlice.reducer;
