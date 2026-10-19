import { createSlice, PayloadAction, Action } from "@reduxjs/toolkit";
import {
  addPasskey,
  deletePasskey,
  disableTwoFactor,
  enableTwoFactor,
  getPasskeys,
  getProfile,
  getTwoFactorStatus,
  login,
  loginWithPasskey,
  logout,
  regenerateRecoveryCodes,
  register,
  restoreSession,
  updateUsername,
  verifyTwoFactor,
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
  mfaToken: null,
  twoFactor: null,
  passkeys: null,
};

// --- HELPERS ---

const handlePending = (state: ProfileState) => {
  state.loading = true;
};

const handleRejected = (state: ProfileState) => {
  state.loading = false;
};

/** Sessione aperta: access token in memoria e in localStorage. */
const signIn = (state: ProfileState, payload: AuthResponse) => {
  if (!payload.access_token) return;

  state.restoring = false;
  state.mfaToken = null;
  state.token = payload.access_token;
  state.username = payload.username;
  state.isAuthenticated = true;

  localStorage.setItem("token", payload.access_token);
  localStorage.setItem("username", payload.username);
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
      state.twoFactor = null;
      state.passkeys = null;
      localStorage.removeItem("token");
      localStorage.removeItem("username");
    },
    /** "Torna indietro" dal codice: si riparte dalla password. */
    cancelTwoFactor: (state) => {
      state.mfaToken = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login, registrazione e secondo passo della 2FA finiscono allo stesso
      // modo quando c'è un access token. Il login di un account con la 2FA
      // risponde invece senza: la schermata passa a chiedere il codice.
      .addCase(login.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        if (action.payload.mfa_required && action.payload.mfa_token) {
          state.mfaToken = action.payload.mfa_token;
          return;
        }
        signIn(state, action.payload);
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        signIn(state, action.payload);
      })
      .addCase(
        verifyTwoFactor.fulfilled,
        (state, action: PayloadAction<AuthResponse>) => {
          signIn(state, action.payload);
        },
      )
      // Token del primo passo scaduto (5 minuti) o password cambiata nel
      // frattempo: si torna a chiedere la password. Un codice sbagliato (400)
      // invece lascia sul codice.
      .addCase(verifyTwoFactor.rejected, (state, action) => {
        if ((action.payload as { status?: number } | undefined)?.status === 401) {
          state.mfaToken = null;
        }
      })

      // null = pannello chiuso dall'utente: si resta sulla schermata di accesso.
      .addCase(loginWithPasskey.fulfilled, (state, action) => {
        if (action.payload) signIn(state, action.payload);
      })
      .addCase(getPasskeys.fulfilled, (state, action) => {
        state.passkeys = action.payload;
      })
      .addCase(addPasskey.fulfilled, (state, action) => {
        if (action.payload) {
          state.passkeys = [...(state.passkeys ?? []), action.payload];
        }
      })
      .addCase(deletePasskey.fulfilled, (state, action) => {
        state.passkeys = (state.passkeys ?? []).filter(
          (passkey) => passkey.id !== action.payload,
        );
      })

      .addCase(getTwoFactorStatus.fulfilled, (state, action) => {
        state.twoFactor = action.payload;
      })
      .addCase(disableTwoFactor.fulfilled, (state, action) => {
        state.twoFactor = action.payload;
      })
      .addCase(enableTwoFactor.fulfilled, (state, action) => {
        state.twoFactor = {
          enabled: true,
          recovery_codes_remaining: action.payload.recovery_codes.length,
        };
      })
      .addCase(regenerateRecoveryCodes.fulfilled, (state, action) => {
        if (state.twoFactor) {
          state.twoFactor.recovery_codes_remaining =
            action.payload.recovery_codes.length;
        }
      })

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
        state.twoFactor = null;
        state.passkeys = null;

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

export const { setLogout, cancelTwoFactor } = profileSlice.actions;

export const selectMfaToken = (state: RootState) => state.profile.mfaToken;

export const selectTwoFactor = (state: RootState) => state.profile.twoFactor;

export const selectPasskeys = (state: RootState) => state.profile.passkeys;

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
