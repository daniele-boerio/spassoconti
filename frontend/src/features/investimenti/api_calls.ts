import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  CreateInvestimentoParams,
  CreateOperazioneParams,
  DeleteInvestimentoParams,
  DeleteOperazioneOutput,
  DeleteOperazioneParams,
  Investimento,
  InvestimentoFilters,
  Operazione,
  UpdateInvestimentoParams,
  UpdateOperazioneParams,
} from "./interfaces";
import { RootState } from "../../store/store";

export const getInvestimenti = createAsyncThunk<Investimento[], undefined>(
  "investimenti/investimenti",
  async (_, { getState, rejectWithValue }) => {
    try {
      const params = new URLSearchParams();

      const state = getState() as RootState;
      const filters = state.investimento.filters;

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            // Gestione corretta delle LISTE per FastAPI
            value.forEach((v) => params.append(key, v.toString()));
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await api.get<Investimento[]>(
        `/investimenti?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione investimenti",
      );
    }
  },
);

export const createInvestimento = createAsyncThunk<
  Investimento,
  CreateInvestimentoParams
>("investimenti/createInvestimento", async (params, { rejectWithValue }) => {
  try {
    const response = await api.post<Investimento>(`/investimenti`, params);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore creazione investimento",
    );
  }
});

export const updateInvestimento = createAsyncThunk<
  Investimento,
  UpdateInvestimentoParams
>("investimenti/updateInvestimento", async (params, { rejectWithValue }) => {
  try {
    const { id, ...body } = params;
    const response = await api.patch<Investimento>(`/investimenti/${id}`, body);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore aggiornamento investimento",
    );
  }
});

export const deleteInvestimento = createAsyncThunk<
  string,
  DeleteInvestimentoParams
>("investimenti/deleteInvestimento", async (params, { rejectWithValue }) => {
  try {
    await api.delete<void>(`/investimenti/${params.id}`);
    return params.id;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore eliminazione investimento",
    );
  }
});

export const createOperazione = createAsyncThunk<
  Operazione,
  CreateOperazioneParams
>("investimenti/createOperazione", async (params, { rejectWithValue }) => {
  try {
    const { investimento_id, ...body } = params;
    const response = await api.post<Operazione>(
      `/investimenti/${investimento_id}/operazione`,
      body,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore creazione operazione");
  }
});

export const updateOperazione = createAsyncThunk<
  Operazione,
  UpdateOperazioneParams
>("investimenti/updateOperazione", async (params, { rejectWithValue }) => {
  try {
    const { investimento_id, id, ...body } = params;
    const response = await api.put<Operazione>(
      `/investimenti/${investimento_id}/operazione/${id}`,
      body,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore aggiornamento operazione",
    );
  }
});

export const deleteOperazione = createAsyncThunk<
  DeleteOperazioneOutput,
  DeleteOperazioneParams
>("investimenti/deleteOperazione", async (params, { rejectWithValue }) => {
  try {
    const { investimento_id, id } = params;
    await api.delete<void>(`/investimenti/${investimento_id}/operazione/${id}`);
    return { inv_id: String(investimento_id), op_id: id };
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore eliminazione operazione",
    );
  }
});
