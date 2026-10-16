import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  Recurring,
  CreateRecurringParams,
  UpdateRecurringParams,
  DeleteRecurringParams,
  ExecuteRecurringParams,
} from "./interfaces";
import { RootState } from "../../store/store";

export const getRecurrings = createAsyncThunk<Recurring[], undefined>(
  "recurring/getRecurrings",
  async (_, { getState, rejectWithValue }) => {
    try {
      const params = new URLSearchParams();

      const state = getState() as RootState;
      const filters = state.recurring.filters;

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

      const response = await api.get<Recurring[]>(
        `/ricorrenze?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione ricorrenze",
      );
    }
  },
);

export const createRecurring = createAsyncThunk<
  Recurring,
  CreateRecurringParams
>("recurring/createRecurring", async (params, { rejectWithValue }) => {
  try {
    const response = await api.post<Recurring>(`/ricorrenze`, params);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore creazione ricorrenze");
  }
});

export const updateRecurring = createAsyncThunk<
  Recurring,
  UpdateRecurringParams
>("recurring/updateRecurring", async (params, { rejectWithValue }) => {
  try {
    // Estraiamo l'id e raccogliamo tutto il resto in 'body'
    const { id, ...body } = params;

    const response = await api.put<Recurring>(`/ricorrenze/${id}`, body);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore update ricorrenze");
  }
});

export const deleteRecurring = createAsyncThunk<string, DeleteRecurringParams>(
  "recurring/deleteRecurring",
  async (params, { rejectWithValue }) => {
    try {
      await api.delete<void>(`/ricorrenze/${params.id}`);
      return params.id;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore eliminazione ricorrenze",
      );
    }
  },
);

/**
 * Registra adesso una ricorrenza già scaduta. Serve quando lo scheduler del BE
 * non è passato: da qui si sblocca a mano. Non anticipa niente — una
 * ricorrenza non ancora scaduta viene rifiutata dal server.
 */
export const executeRecurring = createAsyncThunk<
  Recurring,
  ExecuteRecurringParams
>("recurring/executeRecurring", async (params, { rejectWithValue }) => {
  try {
    const response = await api.post<Recurring>(
      `/ricorrenze/${params.id}/esegui`,
      params.importo !== undefined ? { importo: params.importo } : undefined,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore esecuzione ricorrenza",
    );
  }
});
