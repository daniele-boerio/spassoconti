import { configureStore } from "@reduxjs/toolkit";
import trasactionReducer from "../features/transactions/transaction_slice";
import profileReducer from "../features/profile/profile_slice";
import contoReducer from "../features/conti/conto_slice";
import categoriaReducer from "../features/categorie/categoria_slice";
import tagReducer from "../features/tags/tag_slice";
import errorReducer from "../features/error/error_slice";
import recurringReducer from "../features/recurrings/recurring_slice";
import investimentoReducer from "../features/investimenti/investimento_slice";
import debitiReducer from "../features/debiti/debito_slice";
import statisticsReducer from "../features/statistics/statistics_slice";
import chartsReducer from "../features/charts/charts_slice";
import bankProposalsReducer from "../features/bank_proposals/bank_proposals_slice";
import uiReducer from "../features/ui/ui_slice";
import homeReducer from "../features/home/home_slice";
import { useDispatch, useSelector } from "react-redux";
import { errorMiddleware } from "./error_middleware";

export const store = configureStore({
  reducer: {
    transaction: trasactionReducer,
    profile: profileReducer,
    conto: contoReducer,
    categoria: categoriaReducer,
    tag: tagReducer,
    error: errorReducer,
    recurring: recurringReducer,
    investimento: investimentoReducer,
    debiti: debitiReducer,
    statistics: statisticsReducer,
    charts: chartsReducer,
    bankProposals: bankProposalsReducer,
    ui: uiReducer,
    home: homeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(errorMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
