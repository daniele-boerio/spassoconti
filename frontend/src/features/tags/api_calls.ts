import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  createTagParams,
  DeleteTagParams,
  ApplyTagParams,
  ApplyTagResult,
  RejectTagSuggestionParams,
  Tag,
  TagSuggestion,
  TagSuggestionResponse,
  UpdateTagParams,
} from "./interfaces";
import { mapTagSuggestion } from "./suggestion";
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

// --- SUGGERIMENTI DI TAG -------------------------------------------------------
//
// Tipi fuori da "tag/" di proposito: il matcher del pending dello slice
// metterebbe in caricamento la lista dei tag.

/**
 * Tag da proporre al salvataggio per questa descrizione, o null.
 *
 * Non fallisce mai: un errore (rete, server) vuol dire solo "nessuna
 * domanda", e il salvataggio prosegue senza dialog rosse.
 */
export const suggestTag = createAsyncThunk<TagSuggestion | null, string>(
  "tagSuggestion/get",
  async (descrizione) => {
    try {
      const params = new URLSearchParams({ descrizione });
      const response = await api.get<TagSuggestionResponse | null>(
        `/tags/suggerimento?${params.toString()}`,
      );
      return response.data ? mapTagSuggestion(response.data) : null;
    } catch {
      return null;
    }
  },
);

/** Pulizia in blocco: gruppi di transazioni senza tag con una frase in comune. */
export const getTagProposals = createAsyncThunk<TagSuggestion[], void>(
  "tagSuggestion/getProposals",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<TagSuggestionResponse[]>("/tags/proposte");
      return response.data.map(mapTagSuggestion);
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore lettura proposte di tag");
    }
  },
);

/** Mette il tag (esistente o nuovo) sulle transazioni scelte nell'anteprima. */
export const applyTag = createAsyncThunk<ApplyTagResult, ApplyTagParams>(
  "tagSuggestion/apply",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<ApplyTagResult>("/tags/applica", {
        tag_id: params.tag_id ? Number(params.tag_id) : null,
        nome: params.nome ?? null,
        transazione_ids: params.transazione_ids.map(Number),
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore applicazione tag");
    }
  },
);

/** "Non chiederlo più". Non fallisce mai: al peggio la domanda tornerà. */
export const rejectTagSuggestion = createAsyncThunk<
  RejectTagSuggestionParams,
  RejectTagSuggestionParams
>("tagSuggestion/reject", async (params) => {
  try {
    await api.post("/tags/proposte/rifiuta", params);
  } catch {
    // ignorato di proposito
  }
  return params;
});
