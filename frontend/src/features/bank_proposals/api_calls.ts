import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  BankProposal,
  DiscardProposalParams,
  ImportProposalParams,
} from "./interfaces";

// Una sola chiamata: tutte le proposte PENDING dell'utente (qualsiasi conto).
export const getPendingProposals = createAsyncThunk<BankProposal[], void>(
  "bankProposals/getPending",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<BankProposal[]>(`/bank-proposals`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(
        err.response?.data || "Errore ricezione proposte bancarie",
      );
    }
  },
);

// Approva: crea la transazione. Ritorna l'id della proposta per rimuoverla.
export const importProposal = createAsyncThunk<string, ImportProposalParams>(
  "bankProposals/import",
  async (params, { rejectWithValue }) => {
    try {
      const { conto_origin_id, proposal_id, ...body } = params;
      await api.post(
        `/conti/${conto_origin_id}/bank-connector/proposals/${proposal_id}/import`,
        body,
      );
      return proposal_id;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore import proposta");
    }
  },
);

// Rifiuta: scarta la proposta. Ritorna l'id per rimuoverla.
export const discardProposal = createAsyncThunk<string, DiscardProposalParams>(
  "bankProposals/discard",
  async (params, { rejectWithValue }) => {
    try {
      const { conto_origin_id, proposal_id } = params;
      await api.post(
        `/conti/${conto_origin_id}/bank-connector/proposals/${proposal_id}/discard`,
      );
      return proposal_id;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore scarto proposta");
    }
  },
);
