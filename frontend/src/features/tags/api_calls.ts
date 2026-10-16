import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  createTagParams,
  DeleteTagParams,
  Tag,
  UpdateTagParams,
} from "./interfaces";
import { RootState } from "../../store/store";

// --- API CALLS ---

// Recupero Tags
export const getTags = createAsyncThunk<Tag[], undefined>(
  "tags/getTags",
  async (_, { getState, rejectWithValue }) => {
    try {
      const params = new URLSearchParams();

      const state = getState() as RootState;
      const filters = state.tag.filters;

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

      const response = await api.get<Tag[]>(`/tags?${params.toString()}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante la ricezione dei tag",
      );
    }
  },
);

// creo Tags
export const createTag = createAsyncThunk<Tag, createTagParams>(
  "tags/createTag",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<Tag>(`/tags`, params);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante la creazione del tag",
      );
    }
  },
);

// modifico Tags
export const updateTag = createAsyncThunk<Tag, UpdateTagParams>(
  "tags/updateTag",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.put<Tag>(`/tags/${params.id}`, {
        nome: params.nome,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante la modifica del tag",
      );
    }
  },
);

// elimino Tags
export const deleteTag = createAsyncThunk<string, DeleteTagParams>(
  "tags/deleteTag",
  async (params, { rejectWithValue }) => {
    try {
      await api.delete<void>(`/tags/${params.id}`);
      return params.id;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore durante l'eliminazione del tag",
      );
    }
  },
);
