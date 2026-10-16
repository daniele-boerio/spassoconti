import { createSlice, PayloadAction, Action } from "@reduxjs/toolkit";
import {
  getProfile,
  login,
  logout,
  register,
  restoreSession,
  updateUsername,
} from "./api_calls";
import { AuthResponse, ProfileResponse, ProfileState } from "./interfaces";
import { RootState } from "../../store/store";
import { createTransaction } from "../transactions/api_calls";
import { Transaction } from "../transactions/interfaces";

// --- STATO INIZIALE ---

const savedToken = localStorage.getItem("token");
const savedUsername = localStorage.getItem("username");

const initialState: ProfileState = {
  loading: false,
  token: localStorage.getItem("token") || null,
  username: savedUsername,
  email: null,
  isAuthenticated: !!savedToken,
  // C'è un token da verificare: fino alla risposta del server non sappiamo
  // ancora se vale.
  restoring: !!savedToken,
  isOpenBankingAdmin: false,
  lastTagId: null,
};

// --- HELPERS ---

const handlePending = (state: ProfileState) => {
  state.loading = true;
};

const handleRejected = (state: ProfileState) => {
  state.loading = false;
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setLogout: (state) => {
      state.token = null;
      state.username = null;
      state.isAuthenticated = false;
      state.isOpenBankingAdmin = false;
      state.lastTagId = null;
      localStorage.removeItem("token");
      localStorage.removeItem("username");
    },
  },
  extraReducers: (builder) => {
    builder
      // Fulfilled: Login & Register hanno lo stesso comportamento
      .addCase(
        login.fulfilled,
        (state, action: PayloadAction<AuthResponse>) => {
          state.restoring = false;
          state.token = action.payload.access_token;
          state.username = action.payload.username;
          state.isAuthenticated = true;

          localStorage.setItem("token", action.payload.access_token);
          localStorage.setItem("username", action.payload.username);
        },
      )
      .addCase(
        register.fulfilled,
        (state, action: PayloadAction<AuthResponse>) => {
          state.restoring = false;
          state.token = action.payload.access_token;
          state.username = action.payload.username;
          state.isAuthenticated = true;

          localStorage.setItem("token", action.payload.access_token);
          localStorage.setItem("username", action.payload.username);
        },
      )

      // Lo username nuovo arriva col profilo aggiornato: stesso payload della
      // GET, quindi lo stesso reducer.
      .addCase(updateUsername.fulfilled, (state, action) => {
        state.username = action.payload.username;
        localStorage.setItem("username", action.payload.username);
      })

      // Il server ha risposto: il token salvato vale, la verifica è finita.
      .addCase(
        getProfile.fulfilled,
        (state, action: PayloadAction<ProfileResponse>) => {
          state.restoring = false;
          state.isAuthenticated = true;

          state.username = action.payload.username;
          state.email = action.payload.email;
          state.isOpenBankingAdmin =
            action.payload.is_open_banking_admin ?? false;
          // Il BE lo espone come intero: lo normalizziamo a stringa perché è
          // così che gli id della tassonomia viaggiano nel resto del FE.
          state.lastTagId =
            action.payload.last_tag_id != null
              ? String(action.payload.last_tag_id)
              : null;
        },
      )

      .addCase(getProfile.rejected, (state) => {
        state.isAuthenticated = false;
        state.isOpenBankingAdmin = false;
        state.lastTagId = null;

        localStorage.removeItem("token");
        localStorage.removeItem("username");
      })

      // Creare una transazione sposta il tag di default del prossimo inserimento.
      // Lo rispecchiamo dalla risposta invece di rifare una GET /me: `getProfile`
      // in caso di errore chiude la sessione, e un blip di rete dopo un
      // salvataggio butterebbe fuori l'utente.
      //
      // La condizione è il gemello di quella in BE/routers/transazioni.py
      // (create_transazione): il default si muove solo se il tag l'ha scelto
      // l'utente nel form — il giroconto quel campo non ce l'ha e il rimborso
      // eredita il tag del padre. Se le due dovessero divergere, il /me
      // all'avvio dell'app risincronizza dal valore autorevole del BE.
      .addCase(
        createTransaction.fulfilled,
        (state, action: PayloadAction<Transaction>) => {
          const newTx = action.payload;
          if (newTx.tipo === "RICARICA" || newTx.parent_transaction_id) return;

          state.lastTagId = newTx.tag_id != null ? String(newTx.tag_id) : null;
        },
      )

      // Sessione recuperata dal solo cookie httpOnly (payload null = nessuna sessione,
      // resta la pagina di login).
      .addCase(
        restoreSession.fulfilled,
        (state, action: PayloadAction<AuthResponse | null>) => {
          if (!action.payload) return;

          state.token = action.payload.access_token;
          state.username = action.payload.username;
          state.isAuthenticated = true;
        },
      )

      // La thunk non fallisce mai (l'errore è già assorbito): la sessione locale
      // viene sempre azzerata, anche se il server non era raggiungibile.
      .addCase(logout.fulfilled, (state) => {
        state.token = null;
        state.username = null;
        state.email = null;
        state.isAuthenticated = false;
        state.isOpenBankingAdmin = false;
        state.lastTagId = null;

        localStorage.removeItem("token");
        localStorage.removeItem("username");
      })

      // Matchers per caricamento ed errori del modulo profile
      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") &&
          action.type.startsWith("profile/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("profile/"),
        handleRejected,
      );
  },
});

export const { setLogout } = profileSlice.actions;

export const selectProfileLoading = (state: RootState) => state.profile.loading;

export const selectProfileToken = (state: RootState) => state.profile.token;

export const selectProfileUsername = (state: RootState) =>
  state.profile.username;

export const selectProfileEmail = (state: RootState) => state.profile.email;

export const selectProfileIsAuthenticated = (state: RootState) =>
  state.profile.isAuthenticated;

export const selectIsOpenBankingAdmin = (state: RootState) =>
  state.profile.isOpenBankingAdmin;

export const selectLastTagId = (state: RootState) => state.profile.lastTagId;

export default profileSlice.reducer;
