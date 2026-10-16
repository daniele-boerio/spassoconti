import { createSlice, PayloadAction, Action } from "@reduxjs/toolkit";
import {
  DeleteOperazioneOutput,
  Investimento,
  InvestimentoState,
  Operazione,
} from "./interfaces";
import {
  createInvestimento,
  createOperazione,
  deleteInvestimento,
  deleteOperazione,
  getInvestimenti,
  updateInvestimento,
  updateOperazione,
} from "./api_calls";
import { RootState } from "../../store/store";

const initialState: InvestimentoState = {
  loading: false,
  investimenti: [],
  selectedInvestimento: null,
  filters: {},
};

// --- HELPERS ---

// Helper per mappare l'investimento e convertire le stringhe Decimal in Number
const mapInvestimento = (inv: Investimento): Investimento => ({
  ...inv,
  prezzo_attuale: inv.prezzo_attuale ? Number(inv.prezzo_attuale) : null,
  // Campi calcolati dalle property del backend
  quantita_totale: inv.quantita_totale ? Number(inv.quantita_totale) : 0,
  valore_posizione: inv.valore_posizione ? Number(inv.valore_posizione) : 0,
  prezzo_medio_carico: inv.prezzo_medio_carico
    ? Number(inv.prezzo_medio_carico)
    : 0,
  storico: inv.storico ? inv.storico.map(mapOperazione) : [],
});

// Helper per mappare la singola operazione (storico)
const mapOperazione = (op: Operazione): Operazione => ({
  ...op,
  quantita: Number(op.quantita),
  prezzo_unitario: Number(op.prezzo_unitario),
  valore_attuale: op.valore_attuale ? Number(op.valore_attuale) : 0,
});

const handlePending = (state: InvestimentoState) => {
  state.loading = true;
};

const handleRejected = (state: InvestimentoState) => {
  state.loading = false;
};

const investimentoSlice = createSlice({
  name: "investimento",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // getInvestimenti
      .addCase(
        getInvestimenti.fulfilled,
        (state, action: PayloadAction<Investimento[]>) => {
          // Fondamentale mappare l'intero array convertendo i Decimal
          state.investimenti = action.payload.map(mapInvestimento);
        },
      )

      // createInvestimento
      .addCase(
        createInvestimento.fulfilled,
        (state, action: PayloadAction<Investimento>) => {
          state.investimenti.push(mapInvestimento(action.payload));
        },
      )

      // updateInvestimento
      .addCase(
        updateInvestimento.fulfilled,
        (state, action: PayloadAction<Investimento>) => {
          const index = state.investimenti.findIndex(
            (inv) => inv.id === action.payload.id,
          );
          if (index !== -1) {
            state.investimenti[index] = mapInvestimento(action.payload);
          }
        },
      )

      // deleteInvestimento
      .addCase(
        deleteInvestimento.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.investimenti = state.investimenti.filter(
            (inv) => String(inv.id) !== String(action.payload),
          );
        },
      )

      // createOperazione
      .addCase(
        createOperazione.fulfilled,
        (state, action: PayloadAction<Operazione>) => {
          const newOp = mapOperazione(action.payload);
          const investimento = state.investimenti.find(
            (inv) => inv.id === newOp.investimento_id,
          );
          if (investimento) {
            if (!investimento.storico) investimento.storico = [];
            investimento.storico.push(newOp);
          }
        },
      )

      // updateOperazione
      .addCase(
        updateOperazione.fulfilled,
        (state, action: PayloadAction<Operazione>) => {
          const updatedOp = mapOperazione(action.payload);
          const investimento = state.investimenti.find(
            (inv) => inv.id === updatedOp.investimento_id,
          );
          if (investimento && investimento.storico) {
            const subIndex = investimento.storico.findIndex(
              (sub) => sub.id === updatedOp.id,
            );
            if (subIndex !== -1) {
              investimento.storico[subIndex] = updatedOp;
            }
          }
        },
      )

      // deleteOperazione
      .addCase(
        deleteOperazione.fulfilled,
        (state, action: PayloadAction<DeleteOperazioneOutput>) => {
          const { op_id, inv_id } = action.payload;
          const investimento = state.investimenti.find(
            (inv) => inv.id === inv_id,
          );
          if (investimento && investimento.storico) {
            investimento.storico = investimento.storico.filter(
              (op) => op.id !== op_id,
            );
          }
        },
      )

      // Matchers
      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") &&
          action.type.startsWith("investimenti/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("investimenti/"),
        handleRejected,
      );
  },
});

// --- SELECTORS ---
export const selectInvestimenti = (state: RootState) =>
  state.investimento.investimenti;

export const selectInvestimentiLoading = (state: RootState) =>
  state.investimento.loading;

export const selectInvestimentoById = (id: string) => (state: RootState) =>
  state.investimento.investimenti.find(
    (inv) => String(inv.id) === String(id),
  ) || null;

export default investimentoSlice.reducer;
