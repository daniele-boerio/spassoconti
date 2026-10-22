import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import { AdminUser } from "./interfaces";

export const getAdminUsers = createAsyncThunk<AdminUser[], void>(
  "admin/getUsers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<AdminUser[]>("/admin/users");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore lettura utenti");
    }
  },
);

/**
 * Blocca l'accesso dell'utente e chiude tutte le sue sessioni. Il profilo e i
 * dati restano: `unbanUser` lo fa rientrare.
 */
export const banUser = createAsyncThunk<AdminUser, number>(
  "admin/banUser",
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.post<AdminUser>(`/admin/users/${id}/ban`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore ban utente");
    }
  },
);

export const unbanUser = createAsyncThunk<AdminUser, number>(
  "admin/unbanUser",
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.post<AdminUser>(`/admin/users/${id}/unban`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore riattivazione utente");
    }
  },
);
