import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  CategoryTrendOut,
  ExpenseCompositionOut,
  GetCategoryTrendParams,
  GetExpenseCompositionParams,
  GetIncomeExpenseParams,
  GetSavingsParams,
  MonthlyIncomeExpenseOut,
  MonthlySavingsOut,
  ChartFilters,
} from "./interfaces";

/**
 * Periodo e filtri in query string.
 *
 * Le sottocategorie sono più d'una: axios serializzerebbe l'array come
 * `sottocategoria_id[]=1`, che FastAPI non riconosce — il parametro va
 * ripetuto, come già fanno statistiche e Movimenti.
 */
const chartQuery = (params: ChartFilters): URLSearchParams => {
  const query = new URLSearchParams();

  if (params.data_inizio) query.append("data_inizio", params.data_inizio);
  if (params.data_fine) query.append("data_fine", params.data_fine);
  if (params.categoria_id) query.append("categoria_id", params.categoria_id);

  for (const id of params.sottocategoria_id ?? [])
    query.append("sottocategoria_id", id);

  if (params.tag_id) query.append("tag_id", params.tag_id);

  return query;
};

// --- API CALLS ---

export const getIncomeExpenseChart = createAsyncThunk<
  MonthlyIncomeExpenseOut[],
  GetIncomeExpenseParams
>("charts/getIncomeExpenseChart", async (params, { rejectWithValue }) => {
  try {
    const response = await api.get<MonthlyIncomeExpenseOut[]>(
      `/charts/income-expense?${chartQuery(params).toString()}`,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore dati entrate/uscite");
  }
});

export const getSavingsChart = createAsyncThunk<
  MonthlySavingsOut[],
  GetSavingsParams
>("charts/getSavingsChart", async (params, { rejectWithValue }) => {
  try {
    const response = await api.get<MonthlySavingsOut[]>(
      `/charts/savings?${chartQuery(params).toString()}`,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore dati risparmi");
  }
});

export const getExpenseCompositionChart = createAsyncThunk<
  ExpenseCompositionOut[],
  GetExpenseCompositionParams
>("charts/getExpenseCompositionChart", async (params, { rejectWithValue }) => {
  try {
    const response = await api.get<ExpenseCompositionOut[]>(
      `/charts/expense-composition?${chartQuery(params).toString()}`,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore composizione spese");
  }
});

export const getCategoryTrendChart = createAsyncThunk<
  CategoryTrendOut[],
  GetCategoryTrendParams
>("charts/getCategoryTrendChart", async (params, { rejectWithValue }) => {
  try {
    const response = await api.get<CategoryTrendOut[]>(
      `/charts/category-trend?${chartQuery(params).toString()}`,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore trend categoria");
  }
});
