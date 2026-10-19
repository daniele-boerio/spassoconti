import { PushSupport } from "./interfaces";

/**
 * Le API del browser per le notifiche push, isolate qui: il resto del FE
 * (thunk, sezione delle Impostazioni) non tocca `PushManager` direttamente.
 *
 * Su iPhone le push web funzionano solo da iOS 16.4 e solo per l'app aggiunta
 * alla schermata Home: in Safari `PushManager` non esiste proprio.
 */

type SupportEnv = {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIos: boolean;
  isStandalone: boolean;
};

/** Regola pura, così si testa senza un browser. */
export function pushSupportFrom(env: SupportEnv): PushSupport {
  if (env.hasServiceWorker && env.hasPushManager && env.hasNotification) {
    return "supported";
  }
  if (env.isIos && !env.isStandalone) return "needs_install";
  return "unsupported";
}

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPadOS si presenta come un Mac: lo tradisce il touch.
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function detectPushSupport(): PushSupport {
  return pushSupportFrom({
    // Il service worker è registrato solo nelle build di produzione.
    hasServiceWorker: import.meta.env.PROD && "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
    isIos: isIos(),
    isStandalone: isStandalone(),
  });
}

/** La chiave pubblica VAPID (base64url) nel formato che vuole `subscribe`. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
};

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration();
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (detectPushSupport() !== "supported") return null;
  const reg = await registration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Chiede il permesso e iscrive il dispositivo. Va chiamata dal tocco
 * dell'utente: iOS rifiuta una richiesta di permesso che non nasce da un gesto.
 * Restituisce null se il permesso è stato negato.
 */
export async function subscribePush(
  vapidPublicKey: string,
): Promise<PushSubscriptionJSON | null> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await registration();
  if (!reg) throw new Error("Service worker non registrato");

  const key = urlBase64ToUint8Array(vapidPublicKey);
  const existing = await reg.pushManager.getSubscription();
  // Iscrizione fatta con chiavi del server ormai cambiate: non riceverebbe
  // più niente, e `subscribe` con una chiave diversa fallirebbe.
  if (existing && !sameKey(existing.options.applicationServerKey, key)) {
    await existing.unsubscribe();
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  return subscription.toJSON();
}

/** Disiscrive il dispositivo; restituisce l'endpoint che aveva, se c'era. */
export async function unsubscribePush(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export const notificationPermission = (): NotificationPermission | null =>
  "Notification" in window ? Notification.permission : null;
