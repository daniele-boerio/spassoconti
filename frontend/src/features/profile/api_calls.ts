import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { AxiosError } from "axios";
import {
  AuthResponse,
  DisableTwoFactorParams,
  LoginParams,
  ProfileResponse,
  RecoveryCodesResponse,
  RegisterParams,
  TwoFactorSetup,
  TwoFactorStatus,
  VerifyTwoFactorParams,
} from "./interfaces";
import { forgetThisDevice } from "../notifiche/api_calls";

export const login = createAsyncThunk<AuthResponse, LoginParams>(
  "profile/login",
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const response = await api.post<AuthResponse>(`/login`, formData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Errore sconosciuto");
    }
  },
);

export const register = createAsyncThunk<AuthResponse, RegisterParams>(
  "profile/register",
  async ({ email, username, password }, { rejectWithValue }) => {
    try {
      const response = await api.post<AuthResponse>(`/register`, {
        email,
        username,
        password,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Errore sconosciuto");
    }
  },
);

export const getProfile = createAsyncThunk<ProfileResponse, void>(
  "profile/getProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<ProfileResponse>("/me");
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Errore sconosciuto");
    }
  },
);

// Il logout deve passare dal server: svuotare solo il localStorage lascerebbe il
// cookie di refresh valido, e la sessione resterebbe rinnovabile su quel dispositivo.
// Se la chiamata fallisce (offline, cookie già scaduto) usciamo comunque lato client:
// un logout non deve mai lasciare l'utente "dentro".
export const logout = createAsyncThunk<void, void>(
  "profile/logout",
  async () => {
    // Prima del logout, finché il token vale: il dispositivo smette di
    // ricevere le notifiche di questo account.
    await forgetThisDevice();
    try {
      await api.post("/auth/logout");
    } catch {
      // ignorato di proposito: la pulizia locale avviene comunque nel reducer
    }
  },
);

// Ripristino della sessione all'avvio quando in localStorage non c'è più un access
// token ma il cookie httpOnly è ancora buono. Serve davvero: Safari (ITP) può
// svuotare il localStorage dopo giorni di inattività, mentre il cookie impostato dal
// server sopravvive — senza questo l'utente si ritroverebbe sloggato pur avendo una
// sessione valida, cioè esattamente ciò che il refresh token deve evitare.
//
// Non fallisce mai (restituisce null): un avvio senza sessione è la normalità per un
// visitatore anonimo e non deve far comparire una dialog d'errore.
export const restoreSession = createAsyncThunk<AuthResponse | null, void>(
  "profile/restoreSession",
  async () => {
    try {
      const response = await api.post<AuthResponse>("/auth/refresh", null, {
        // Un 401 qui significa "nessuna sessione": non ha senso che l'interceptor
        // tenti a sua volta un refresh.
        _skipAuthRefresh: true,
      });

      if (!response.data.access_token) return null;
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("username", response.data.username);
      return response.data;
    } catch {
      return null;
    }
  },
);

/**
 * Cambia lo username. Il server ritorna il profilo aggiornato, con le stesse
 * regole della registrazione: minuscolo e unico.
 */
export const updateUsername = createAsyncThunk<ProfileResponse, string>(
  "profile/updateUsername",
  async (username, { rejectWithValue }) => {
    try {
      const response = await api.put<ProfileResponse>("/me", { username });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore cambio username");
    }
  },
);

/**
 * Chiede la mail per reimpostare la password: è lo stesso flusso della
 * schermata di accesso, e il server risponde sempre allo stesso modo — non
 * dice se l'indirizzo esiste.
 */
export const requestPasswordReset = createAsyncThunk<void, string>(
  "profile/requestPasswordReset",
  async (email, { rejectWithValue }) => {
    try {
      await api.post("/auth/forgot-password", { email });
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore invio email");
    }
  },
);

// --- VERIFICA IN DUE PASSAGGI -------------------------------------------------

/**
 * Secondo passo del login: il token avuto da /login (password giusta) più il
 * codice dell'app di autenticazione, o un codice di recupero.
 */
export const verifyTwoFactor = createAsyncThunk<AuthResponse, VerifyTwoFactorParams>(
  "profile/verifyTwoFactor",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<AuthResponse>("/auth/2fa/verify", params, {
        // Non c'è ancora una sessione da rinnovare: un 401 qui è "token del
        // primo passo scaduto", da mostrare, non da rigiocare.
        _skipAuthRefresh: true,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore verifica codice");
    }
  },
);

export const getTwoFactorStatus = createAsyncThunk<TwoFactorStatus, void>(
  "profile/getTwoFactorStatus",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<TwoFactorStatus>("/auth/2fa");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore lettura verifica in due passaggi");
    }
  },
);

/** Genera il segreto (ancora inattivo) da aggiungere all'app di autenticazione. */
export const setupTwoFactor = createAsyncThunk<TwoFactorSetup, void>(
  "profile/setupTwoFactor",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post<TwoFactorSetup>("/auth/2fa/setup");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore configurazione verifica");
    }
  },
);

/** Attiva con il primo codice dell'app; restituisce i codici di recupero (una volta sola). */
export const enableTwoFactor = createAsyncThunk<RecoveryCodesResponse, string>(
  "profile/enableTwoFactor",
  async (code, { rejectWithValue }) => {
    try {
      const response = await api.post<RecoveryCodesResponse>("/auth/2fa/enable", { code });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore attivazione verifica");
    }
  },
);

export const disableTwoFactor = createAsyncThunk<TwoFactorStatus, DisableTwoFactorParams>(
  "profile/disableTwoFactor",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.post<TwoFactorStatus>("/auth/2fa/disable", params);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore disattivazione verifica");
    }
  },
);

export const regenerateRecoveryCodes = createAsyncThunk<RecoveryCodesResponse, string>(
  "profile/regenerateRecoveryCodes",
  async (code, { rejectWithValue }) => {
    try {
      const response = await api.post<RecoveryCodesResponse>("/auth/2fa/recovery-codes", {
        code,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore codici di recupero");
    }
  },
);
