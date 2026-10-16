import { correggiSaldo, getPatrimonio, getVerificaSaldi } from "./api_calls";
import { createSlice, PayloadAction, Action } from "@reduxjs/toolkit";
import {
  confirmBankSession,
  createConto,
  deleteConto,
  disconnectBank,
  getConti,
  getCurrentMonthExpenses,
  getCurrentMonthExpensesByCategory,
  updateBudget,
  updateConto,
} from "./api_calls";
import {
  BankSessionResult,
  Conto,
  ContoState,
  ExpenseByCategory,
  MonthlyBudgetResponse,
} from "./interfaces";
import { RootState } from "../../store/store";
import { createTransaction } from "../transactions/api_calls";
import { Transaction } from "../transactions/interfaces";

// "Includi le ricorrenti future nel calcolo del budget": preferenza locale,
// senza controparte sul BE, che ogni chiamata alla card del mese ripassa.
const INCLUDE_FUTURE_RECURRING_STORAGE_KEY = "includeFutureRecurring";

const initialState: ContoState = {
  loading: false,
  conti: [],
  selectedConto: null,
  monthlyBudget: {
    total_budget: null,
    remaining: null,
    percentage: null,
  },
  monthlySpending: {
    budget: null,
    spent: 0,
    projected: 0,
    remaining: null,
    percentage: null,
  },
  monthIncome: 0,
  monthSaved: 0,
  monthlyExpensesByCategory: [],
  filters: {
    sort_by: ["saldo:desc"],
  },
  include_future_recurring:
    localStorage.getItem(INCLUDE_FUTURE_RECURRING_STORAGE_KEY) === "true",
  patrimonio: [],
  saldiFuoriSincrono: [],
};

// --- HELPERS ---

const handlePending = (state: ContoState) => {
  state.loading = true;
};

const handleRejected = (state: ContoState) => {
  state.loading = false;
};

// I Decimal del BE arrivano come stringhe: la conversione a Number avviene solo
// qui, al confine con lo store.
const toNumber = (value: number | string | null | undefined): number | null =>
  value !== null && value !== undefined ? Number(value) : null;

// GET /conti/currentMonthExpenses e PUT /monthlyBudget rispondono con la stessa
// struttura: un solo posto dove leggerla.
const applyMonthlyBudget = (
  state: ContoState,
  payload: MonthlyBudgetResponse,
) => {
  const { monthly_budget, spending } = payload;

  state.monthlyBudget.total_budget = toNumber(monthly_budget.total_budget);
  state.monthlyBudget.remaining = toNumber(monthly_budget.remaining);
  state.monthlyBudget.percentage = monthly_budget.percentage ?? 0;

  state.monthlySpending = {
    budget: toNumber(spending.budget),
    spent: toNumber(spending.spent) ?? 0,
    projected: toNumber(spending.projected) ?? 0,
    remaining: toNumber(spending.remaining),
    percentage: spending.percentage ?? null,
  };

  state.monthIncome = toNumber(payload.income) ?? 0;
  state.monthSaved = toNumber(payload.saved) ?? 0;
};

const contoSlice = createSlice({
  name: "conto",
  initialState,
  reducers: {
    setIncludeFutureRecurring: (state, action: PayloadAction<boolean>) => {
      state.include_future_recurring = action.payload;
      localStorage.setItem(
        INCLUDE_FUTURE_RECURRING_STORAGE_KEY,
        String(action.payload),
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getVerificaSaldi.fulfilled, (state, action) => {
        state.saldiFuoriSincrono = action.payload.map((riga) => ({
          ...riga,
          conto_id: String(riga.conto_id),
          saldo: Number(riga.saldo),
          saldo_atteso: Number(riga.saldo_atteso),
          differenza: Number(riga.differenza),
        }));
      })

      .addCase(correggiSaldo.fulfilled, (state, action: PayloadAction<Conto>) => {
        const corretto = action.payload;
        state.saldiFuoriSincrono = state.saldiFuoriSincrono.filter(
          (riga) => String(riga.conto_id) !== String(corretto.id),
        );
        const index = state.conti.findIndex(
          (conto) => String(conto.id) === String(corretto.id),
        );
        if (index !== -1) state.conti[index] = corretto;
      })

      .addCase(getPatrimonio.fulfilled, (state, action) => {
        state.patrimonio = action.payload;
      })
      // currentMonthExpenses & updateBudget
      .addCase(
        getCurrentMonthExpenses.fulfilled,
        (state, action: PayloadAction<MonthlyBudgetResponse>) => {
          applyMonthlyBudget(state, action.payload);
        },
      )
      .addCase(
        updateBudget.fulfilled,
        (state, action: PayloadAction<MonthlyBudgetResponse>) => {
          applyMonthlyBudget(state, action.payload);
        },
      )

      // getConti
      .addCase(getConti.fulfilled, (state, action: PayloadAction<Conto[]>) => {
        // Mappiamo i conti per assicurarci che i campi numerici siano effettivamente numeri nello stato
        state.conti = action.payload.map((c) => ({
          ...c,
          saldo: Number(c.saldo),
          budget_obiettivo: c.budget_obiettivo ? Number(c.budget_obiettivo) : 0,
          soglia_minima: c.soglia_minima ? Number(c.soglia_minima) : 0,
        }));
      })

      // getCurrentMonthExpensesByCategory
      .addCase(
        getCurrentMonthExpensesByCategory.fulfilled,
        (state, action: PayloadAction<ExpenseByCategory[]>) => {
          // Cast del valore per ogni categoria
          state.monthlyExpensesByCategory = action.payload.map((item) => ({
            ...item,
            value: Number(item.value),
          }));
        },
      )

      // createConto
      .addCase(createConto.fulfilled, (state, action: PayloadAction<Conto>) => {
        // Stessa logica: se il nuovo conto nasce come default,
        // spegniamo il flag a tutti gli altri prima di inserirlo.
        if (action.payload.default) {
          state.conti.forEach((conto) => {
            conto.default = false;
          });
        }

        // Inseriamo il nuovo conto (che avrà is_default: true dal payload)
        state.conti.push({
          ...action.payload,
          saldo: Number(action.payload.saldo),
        });
      })

      // updateConto
      .addCase(updateConto.fulfilled, (state, action: PayloadAction<Conto>) => {
        // Se il conto che stiamo salvando è contrassegnato come default,
        // prima togliamo il flag "default" a tutti i conti esistenti nello state.
        if (action.payload.default) {
          state.conti.forEach((conto) => {
            conto.default = false;
          });
        }

        // Poi aggiorniamo (o inseriamo) il conto con i nuovi dati
        const index = state.conti.findIndex(
          (conto) => conto.id === action.payload.id,
        );

        if (index !== -1) {
          state.conti[index] = {
            ...action.payload,
            saldo: Number(action.payload.saldo),
          };
        }
      })

      .addCase(
        deleteConto.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.conti = state.conti.filter(
            (conto) => String(conto.id) !== String(action.payload),
          );
        },
      )

      // disconnectBank: il conto torna senza connettore bancario
      .addCase(
        disconnectBank.fulfilled,
        (state, action: PayloadAction<Conto>) => {
          const index = state.conti.findIndex(
            (c) => String(c.id) === String(action.payload.id),
          );
          if (index !== -1) {
            state.conti[index] = {
              ...action.payload,
              saldo: Number(action.payload.saldo),
            };
          }
        },
      )

      // confirmBankSession: feedback immediato del collegamento riuscito
      .addCase(
        confirmBankSession.fulfilled,
        (state, action: PayloadAction<BankSessionResult>) => {
          const { conto_id, account_id } = action.payload;
          const conto = state.conti.find(
            (c) => String(c.id) === String(conto_id),
          );
          if (conto) {
            conto.bank_connector_account_id = account_id;
            conto.bank_connector_last_error = null;
          }
        },
      )

      .addCase(
        createTransaction.fulfilled,
        (state, action: PayloadAction<Transaction>) => {
          const newTx = action.payload;
          const txImporto = Number(newTx.importo); // Fondamentale: cast dell'importo stringa

          // Qui aggiorniamo SOLO i saldi dei conti: il thunk createTransaction
          // rifà già il fetch di currentMonthExpenses e expensesByCategory (e le
          // loro `fulfilled` arrivano PRIMA di questa), quindi budget e grafico
          // sono già i valori del server. Riapplicare qui il delta li contava due
          // volte — la torta raddoppiava la spesa e il risparmio sottraeva
          // l'accantonamento due volte. `getConti` invece non viene rifetchato,
          // quindi il saldo va aggiornato a mano.

          // Aggiorna il saldo del conto coinvolto
          if (newTx.tipo === "RICARICA" || newTx.tipo === "ACCANTONAMENTO") {
            // Giroconto/accantonamento: esce dalla sorgente; per l'accantonamento
            // la destinazione (salvadanaio) è opzionale.
            const srcIndex = state.conti.findIndex(
              (c) => String(c.id) === String(newTx.conto_id),
            );
            if (srcIndex !== -1) {
              state.conti[srcIndex].saldo -= txImporto;
            }
            const dstIndex = state.conti.findIndex(
              (c) => String(c.id) === String(newTx.conto_destinazione_id),
            );
            if (dstIndex !== -1) {
              state.conti[dstIndex].saldo += txImporto;
            }
          } else {
            const contoIndex = state.conti.findIndex(
              (c) => String(c.id) === String(newTx.conto_id),
            );
            if (contoIndex !== -1) {
              const mod = newTx.tipo === "USCITA" ? -1 : 1;
              // Calcolo sicuro tra numeri
              state.conti[contoIndex].saldo += txImporto * mod;
            }
          }
        },
      )

      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") && action.type.startsWith("conti/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("conti/"),
        handleRejected,
      );
  },
});

// Selectors (Invariati)
export const selectContiLoading = (state: RootState) => state.conto.loading;
export const selectContiConti = (state: RootState) => state.conto.conti;
export const selectContiSelectedConto = (state: RootState) =>
  state.conto.selectedConto;
export const selectContiMonthlySpending = (state: RootState) =>
  state.conto.monthlySpending;

export const selectContiMonthIncome = (state: RootState) =>
  state.conto.monthIncome;

export const selectContiMonthSaved = (state: RootState) =>
  state.conto.monthSaved;

export const selectContiMonthlyBudget = (state: RootState) =>
  state.conto.monthlyBudget;
export const selectContiMonthlyExpensesByCategory = (state: RootState) =>
  state.conto.monthlyExpensesByCategory;
export const selectContiFilters = (state: RootState) => state.conto.filters;
export const selectContiPatrimonio = (state: RootState) =>
  state.conto.patrimonio;
export const selectSaldiFuoriSincrono = (state: RootState) =>
  state.conto.saldiFuoriSincrono;

export const selectIncludeFutureRecurring = (state: RootState) =>
  state.conto.include_future_recurring;

export default contoSlice.reducer;
export const { setIncludeFutureRecurring } = contoSlice.actions;
