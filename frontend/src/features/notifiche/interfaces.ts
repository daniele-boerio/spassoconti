// --- INTERFACCE ---

/** GET /notifiche: preferenze dell'account e configurazione del server. */
export interface NotificheConfig {
  /** False se il server non ha le chiavi VAPID: l'attivazione non si mostra. */
  disponibili: boolean;
  vapid_public_key: string | null;
  budget: boolean;
  ricorrenze: boolean;
  /** Quanti dispositivi dell'account ricevono le notifiche. */
  dispositivi: number;
}

export interface NotifichePreferenzeParams {
  budget?: boolean;
  ricorrenze?: boolean;
}

/**
 * Cosa si può fare su questo dispositivo:
 * - "supported": il browser ha service worker, PushManager e Notification;
 * - "needs_install": iPhone/iPad da Safari — le push arrivano solo all'app
 *   aggiunta alla schermata Home;
 * - "unsupported": browser senza Web Push (o build di sviluppo, dove il
 *   service worker non è registrato).
 */
export type PushSupport = "supported" | "needs_install" | "unsupported";

export interface NotificheState {
  config: NotificheConfig | null;
  /** Questo dispositivo ha un'iscrizione push attiva. */
  thisDevice: boolean;
  loading: boolean;
}

export interface NotificheLoadResponse {
  config: NotificheConfig;
  thisDevice: boolean;
}

export interface EnablePushResponse {
  /** null quando l'utente ha negato il permesso. */
  config: NotificheConfig | null;
  denied: boolean;
  /** Il browser non è riuscito a iscriversi al suo servizio push. */
  failed: boolean;
}
