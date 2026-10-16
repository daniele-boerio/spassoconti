import { Action, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store/store";
import { BankProposal, BankProposalsState } from "./interfaces";
import {
  discardProposal,
  getPendingProposals,
  importProposal,
} from "./api_calls";

const initialState: BankProposalsState = {
  loading: false,
  proposals: [],
};

// I valori monetari arrivano come stringa dal BE: convertiamoli a Number qui.
const mapProposal = (p: BankProposal): BankProposal => ({
  ...p,
  id: String(p.id),
  conto_id: String(p.conto_id),
  importo: Number(p.importo),
});

const removeById = (state: BankProposalsState, id: string) => {
  state.proposals = state.proposals.filter(
    (p) => String(p.id) !== String(id),
  );
};

const bankProposalsSlice = createSlice({
  name: "bankProposals",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(
        getPendingProposals.fulfilled,
        (state, action: PayloadAction<BankProposal[]>) => {
          state.proposals = action.payload.map(mapProposal);
        },
      )
      .addCase(
        importProposal.fulfilled,
        (state, action: PayloadAction<string>) => {
          removeById(state, action.payload);
        },
      )
      .addCase(
        discardProposal.fulfilled,
        (state, action: PayloadAction<string>) => {
          removeById(state, action.payload);
        },
      )
      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") &&
          action.type.startsWith("bankProposals/"),
        (state) => {
          state.loading = true;
        },
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("bankProposals/"),
        (state) => {
          state.loading = false;
        },
      );
  },
});

export const selectBankProposals = (state: RootState) =>
  state.bankProposals.proposals;
export const selectBankProposalsLoading = (state: RootState) =>
  state.bankProposals.loading;

export default bankProposalsSlice.reducer;
