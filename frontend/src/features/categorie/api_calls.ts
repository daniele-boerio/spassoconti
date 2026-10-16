import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  Categoria,
  CreateCategoriaParams,
  CreateSottoCategoriaParams,
  DeleteCategoriaParams,
  DeleteSottoCategoriaParams,
  DeleteSottoCategoriaResponse,
  MigrateTransactionsParams,
  MigrateTransactionsResult,
  SottoCategoria,
  UpdateCategoriaParams,
  UpdateSottoCategoriaParams,
} from "./interfaces";
import { RootState } from "../../store/store";

// --- API CALLS ---

// Recupero Categorie
export const getCategorie = createAsyncThunk<Categoria[], undefined>(
  "categorie/getCategoria",
  async (_, { getState, rejectWithValue }) => {
    try {
      const params = new URLSearchParams();

      const state = getState() as RootState;
      const filters = state.categoria.filters;

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

      const response = await api.get<Categoria[]>(
        `/categorie?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante la ricezione delle categorie",
      );
    }
  },
);

// Creazione Categoria
export const createCategoria = createAsyncThunk<
  Categoria,
  CreateCategoriaParams
>(
  "categorie/createCategoria",
  async (
    { nome, solo_entrata, solo_uscita, budget_mensile, sottocategorie },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.post<Categoria>(`/categorie`, {
        nome,
        solo_entrata,
        solo_uscita,
        budget_mensile,
        sottocategorie,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante la creazione",
      );
    }
  },
);

// Aggiornamento Categoria
export const updateCategoria = createAsyncThunk<
  Categoria,
  UpdateCategoriaParams
>(
  "categorie/updateCategoria",
  async (
    { id, nome, solo_entrata, solo_uscita, budget_mensile },
    { rejectWithValue },
  ) => {
    try {
      // `budget_mensile` viaggia solo se il chiamante l'ha nominato: il BE usa
      // `exclude_unset`, quindi mandarlo sempre a `undefined` andrebbe bene, ma
      // mandarlo a `null` è il modo di *togliere* il budget — due cose diverse
      // che devono restare distinguibili.
      const response = await api.put<Categoria>(`/categorie/${id}`, {
        nome,
        solo_entrata,
        solo_uscita,
        ...(budget_mensile !== undefined ? { budget_mensile } : {}),
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante la modifica",
      );
    }
  },
);

// Eliminazione Categoria
export const deleteCategoria = createAsyncThunk<string, DeleteCategoriaParams>(
  "categorie/deleteCategoria",
  async ({ id }, { rejectWithValue }) => {
    try {
      await api.delete<void>(`/categorie/${id}`);
      return id; // Restituisce l'ID (stringa) eliminato
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante l'eliminazione",
      );
    }
  },
);

// Creazione SottoCategorie
export const createSottoCategorie = createAsyncThunk<
  SottoCategoria[],
  CreateSottoCategoriaParams
>(
  "categorie/createSottoCategoria",
  async ({ id, subList }, { rejectWithValue }) => {
    try {
      // Mappiamo la lista per aggiungere l'id della categoria a ogni elemento
      const payload = subList.map((sub) => ({
        ...sub,
        categoria_id: id, // Inseriamo l'id ricevuto come parametro
      }));

      const response = await api.post<SottoCategoria[]>(
        `/categorie/${id}/sottocategorie`,
        payload, // Inviamo la lista arricchita
      );

      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore creazione sottocategoria",
      );
    }
  },
);

// Aggiornamento SottoCategoria
export const updateSottoCategoria = createAsyncThunk<
  SottoCategoria,
  UpdateSottoCategoriaParams
>(
  "categorie/updateSottoCategoria",
  async ({ id, nome, solo_entrata, solo_uscita }, { rejectWithValue }) => {
    try {
      const response = await api.put<SottoCategoria>(`/sottocategorie/${id}`, {
        nome,
        solo_entrata,
        solo_uscita,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore modifica sottocategoria",
      );
    }
  },
);

// Eliminazione SottoCategoria
export const deleteSottoCategoria = createAsyncThunk<
  DeleteSottoCategoriaResponse,
  DeleteSottoCategoriaParams
>(
  "categorie/deleteSottoCategoria",
  async ({ catId, subId }, { rejectWithValue }) => {
    try {
      await api.delete<void>(`/sottocategorie/${subId}`);
      return { catId, subId };
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore eliminazione sottocategoria",
      );
    }
  },
);

// Migrazione Transazioni
export const migrateTransactions = createAsyncThunk<
  MigrateTransactionsResult,
  MigrateTransactionsParams
>(
  "categorie/migrateTransactions",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<MigrateTransactionsResult>(
        `/categorie/migrate`,
        params,
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante la migrazione",
      );
    }
  },
);
