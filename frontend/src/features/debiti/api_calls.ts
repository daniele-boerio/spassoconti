import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  Debito,
  CreateDebitoParams,
  UpdateDebitoParams,
  PayDebitoParams,
  DeleteDebitoParams,
} from "./interfaces";
import { Transaction } from "../transactions/interfaces";

const normalizeDebito = (debito: any): Debito => ({
  id: String(debito.id),
  nome: debito.nome,
  ammontare: Number(debito.ammontare),
  residuo:
    debito.residuo !== null && debito.residuo !== undefined
      ? Number(debito.residuo)
      : null,
  descrizione: debito.descrizione ?? null,
  conto_id:
    debito.conto_id !== null && debito.conto_id !== undefined
      ? String(debito.conto_id)
      : null,
  creationDate: debito.creationDate,
  lastUpdate: debito.lastUpdate,
});

export const getDebiti = createAsyncThunk<Debito[], void>(
  "debiti/getDebiti",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<Debito[]>(`/debiti`);
      return response.data.map(normalizeDebito);
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore ricezione debiti");
    }
  },
);

export const createDebito = createAsyncThunk<Debito, CreateDebitoParams>(
  "debiti/createDebito",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<Debito>(`/debiti`, params);
      return normalizeDebito(response.data);
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore creazione debito");
    }
  },
);

export const updateDebito = createAsyncThunk<Debito, UpdateDebitoParams>(
  "debiti/updateDebito",
  async (params, { rejectWithValue }) => {
    try {
      const { id, ...body } = params;
      const response = await api.put<Debito>(`/debiti/${id}`, body);
      return normalizeDebito(response.data);
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore aggiornamento debito",
      );
    }
  },
);

export const deleteDebito = createAsyncThunk<string, DeleteDebitoParams>(
  "debiti/deleteDebito",
  async (params, { rejectWithValue }) => {
    try {
      const query = params.force ? "?force=true" : "";
      await api.delete<void>(`/debiti/${params.id}${query}`);
      return params.id;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore eliminazione debito",
      );
    }
  },
);

export const payDebito = createAsyncThunk<Transaction, PayDebitoParams>(
  "debiti/payDebito",
  async (params, { rejectWithValue }) => {
    try {
      const { id, ...body } = params;
      const response = await api.post<Transaction>(`/debiti/${id}/pay`, body);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore pagamento debito");
    }
  },
);
