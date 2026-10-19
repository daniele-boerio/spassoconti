import { createAsyncThunk } from "@reduxjs/toolkit";
import { AxiosError } from "axios";
import api from "../../services/api";
import {
  EnablePushResponse,
  NotificheConfig,
  NotificheLoadResponse,
  NotifichePreferenzeParams,
} from "./interfaces";
import {
  currentSubscription,
  notificationPermission,
  subscribePush,
  unsubscribePush,
} from "./push";

/** Preferenze dal server, più se QUESTO dispositivo è iscritto (lo sa solo il browser). */
export const getNotifiche = createAsyncThunk<NotificheLoadResponse, void>(
  "notifiche/getNotifiche",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<NotificheConfig>("/notifiche");
      const subscription = await currentSubscription();
      return { config: response.data, thisDevice: subscription !== null };
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore lettura notifiche");
    }
  },
);

export const updatePreferenzeNotifiche = createAsyncThunk<
  NotificheConfig,
  NotifichePreferenzeParams
>("notifiche/updatePreferenze", async (params, { rejectWithValue }) => {
  try {
    const response = await api.put<NotificheConfig>("/notifiche/preferenze", params);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    return rejectWithValue(err.response?.data || "Errore salvataggio preferenze");
  }
});

/**
 * Permesso + iscrizione del browser + registrazione sul server. Un permesso
 * negato non è un errore da finestra rossa: torna come `denied` e la sezione
 * spiega come riattivarlo dalle impostazioni del telefono.
 */
export const enablePushOnDevice = createAsyncThunk<EnablePushResponse, string>(
  "notifiche/enablePushOnDevice",
  async (vapidPublicKey, { rejectWithValue }) => {
    // Un errore del browser (servizio push assente, permesso revocato a metà)
    // non è un problema di rete: l'errorMiddleware lo direbbe "server non
    // raggiungibile". Torna come `failed` e la sezione lo spiega col suo testo.
    let subscription: PushSubscriptionJSON | null;
    try {
      subscription = await subscribePush(vapidPublicKey);
    } catch {
      return { config: null, denied: false, failed: true };
    }
    if (!subscription) return { config: null, denied: true, failed: false };

    try {
      const response = await api.post<NotificheConfig>(
        "/notifiche/dispositivi",
        subscription,
      );
      return { config: response.data, denied: false, failed: false };
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore attivazione notifiche");
    }
  },
);

export const disablePushOnDevice = createAsyncThunk<NotificheConfig | null, void>(
  "notifiche/disablePushOnDevice",
  async (_, { rejectWithValue }) => {
    try {
      const endpoint = await unsubscribePush();
      if (!endpoint) return null;
      const response = await api.delete<NotificheConfig>("/notifiche/dispositivi", {
        data: { endpoint },
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore disattivazione notifiche");
    }
  },
);

export const sendTestNotification = createAsyncThunk<{ inviate: number }, void>(
  "notifiche/sendTestNotification",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post<{ inviate: number }>("/notifiche/prova");
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      return rejectWithValue(err.response?.data || "Errore invio notifica di prova");
    }
  },
);

/**
 * All'avvio ripresenta al server l'iscrizione di questo dispositivo: il browser
 * può averla rinnovata da sé, o sul telefono è entrato un altro account (il
 * server sposta il dispositivo a chi lo usa adesso). Silenziosa: mai un errore.
 */
export async function syncThisDevice(): Promise<void> {
  try {
    if (notificationPermission() !== "granted") return;
    const subscription = await currentSubscription();
    if (!subscription) return;
    await api.post("/notifiche/dispositivi", subscription.toJSON());
  } catch {
    // Senza rete o senza chiavi sul server: si riprova al prossimo avvio.
  }
}

/**
 * Al logout il dispositivo smette di ricevere: su un telefono condiviso le
 * notifiche del vecchio account non devono restare. Va chiamata prima che il
 * token sparisca. Silenziosa: il logout non deve mai fallire per questo.
 */
export async function forgetThisDevice(): Promise<void> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await api.delete("/notifiche/dispositivi", { data: { endpoint } });
  } catch {
    // Il server la toglierà da sé al primo invio fallito (410).
  }
}
