import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  FetchYearStatisticsParams,
  FetchMonthStatisticsParams,
  YearDetailsResponse,
  MonthlyDetailResponse,
} from "./interfaces";
import { toIsoDate } from "../../services/dates";

/**
 * Categoria, sottocategorie e tag in query string.
 *
 * Le sottocategorie sono più d'una: axios serializzerebbe l'array come
 * `sottocategoria_id[]=1`, che FastAPI non riconosce — il parametro va
 * ripetuto, come già fanno i filtri dei Movimenti.
 */
const tassonomiaQuery = (
  params: FetchYearStatisticsParams | FetchMonthStatisticsParams,
): URLSearchParams => {
  const query = new URLSearchParams();

  if (params.categoria_id) query.append("categoria_id", params.categoria_id);

  for (const id of params.sottocategoria_id ?? [])
    query.append("sottocategoria_id", id);

  if (params.tag_id) query.append("tag_id", params.tag_id);

  return query;
};

// --- API CALLS ---

export const getYearDetailsStatistics = createAsyncThunk<
  YearDetailsResponse,
  FetchYearStatisticsParams
>("statistics/yearDetails", async (params, { rejectWithValue }) => {
  try {
    // La risposta porta anche i totali dell'anno: servono alla tabella in
    // fondo alla vista Anno, e prima venivano buttati via.
    const query = tassonomiaQuery(params);
    query.append("year", String(params.year));

    const response = await api.get<YearDetailsResponse>(
      `/statistics/yearDetails?${query.toString()}`,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore nel caricamento statistiche",
    );
  }
});

export const getMonthlyDetailsStatistics = createAsyncThunk<
  MonthlyDetailResponse,
  FetchMonthStatisticsParams
>("statistics/monthDetails", async (params, { rejectWithValue }) => {
  try {
    const query = tassonomiaQuery(params);
    query.append("year", String(params.year));
    query.append("month", String(params.month));

    const response = await api.get<MonthlyDetailResponse>(
      `/statistics/monthDetails?${query.toString()}`,
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore nel caricamento statistiche",
    );
  }
});

/**
 * Risparmio del mese precedente: è il riferimento del badge di variazione
 * sulla card "Risparmio del mese". Chiede lo stesso endpoint del mese corrente
 * ma ne tiene solo il netto, così i due valori sono calcolati alla stessa
 * maniera e la percentuale ha senso.
 */
export const getPreviousMonthSavings = createAsyncThunk<
  number,
  FetchMonthStatisticsParams
>("statistics/previousMonthSavings", async (params, { rejectWithValue }) => {
  try {
    // Mese 1 → dicembre dell'anno prima.
    const month = params.month === 1 ? 12 : params.month - 1;
    const year = params.month === 1 ? params.year - 1 : params.year;

    const query = tassonomiaQuery(params);
    query.append("year", String(year));
    query.append("month", String(month));

    const response = await api.get<MonthlyDetailResponse>(
      `/statistics/monthDetails?${query.toString()}`,
    );

    return Number(response.data.totale ?? 0);
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(
      err.response?.data || "Errore nel caricamento del mese precedente",
    );
  }
});

/**
 * Rimborsi incassati nel mese. `monthDetails` li esclude da ogni totale (le
 * uscite arrivano già al netto), quindi per scriverli in chiaro serve
 * chiederli a parte.
 */
export const getMonthRefunds = createAsyncThunk<
  number,
  FetchMonthStatisticsParams
>("statistics/monthRefunds", async (params, { rejectWithValue }) => {
  try {
    const start = new Date(params.year, params.month - 1, 1);
    const end = new Date(params.year, params.month, 0);

    const query = new URLSearchParams({
      page: "1",
      // Servono solo i totali aggregati, non le righe.
      size: "1",
      tipo: "RIMBORSO",
      data_inizio: toIsoDate(start),
      data_fine: toIsoDate(end),
    });

    for (const [key, value] of tassonomiaQuery(params))
      query.append(key, value);

    const response = await api.get<{ total_rimborsi: number }>(
      `/transazioni/paginated?${query.toString()}`,
    );

    return Number(response.data.total_rimborsi ?? 0);
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore nel calcolo rimborsi");
  }
});
