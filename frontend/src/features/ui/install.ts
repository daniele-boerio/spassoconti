/**
 * Invito a installare l'app sulla schermata Home quando la si apre dal
 * browser di un telefono.
 *
 * - Android (Chrome, Edge, Samsung): il browser emette `beforeinstallprompt`;
 *   lo teniamo da parte e lo rilanciamo dal nostro pulsante "Installa".
 * - iPhone/iPad: nessuna API, si installa solo da Condividi → "Aggiungi alla
 *   schermata Home": mostriamo le istruzioni.
 * - Altri browser Android (Firefox…): istruzioni dal menu del browser.
 */

/** L'evento non è nei tipi del DOM: è solo dei browser Chromium. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "native" | "ios" | "android_manual";

export interface InstallEnv {
  isIos: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  hasNativePrompt: boolean;
  /** ms dell'ultima volta che l'utente ha chiuso l'invito, null se mai. */
  dismissedAt: number | null;
  now: number;
}

/** Chiuso l'invito, non lo ripresentiamo per due settimane. */
export const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

const DISMISSED_KEY = "install_prompt_dismissed_at";

/** Che invito mostrare, o null se non va mostrato. */
export function installModeFrom(env: InstallEnv): InstallMode | null {
  if (env.isStandalone) return null;
  if (env.dismissedAt !== null && env.now - env.dismissedAt < DISMISS_FOR_MS) {
    return null;
  }
  if (env.isIos) return "ios";
  if (env.hasNativePrompt) return "native";
  if (env.isAndroid) return "android_manual";
  return null;
}

// --- Browser ------------------------------------------------------------------

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/**
 * Da chiamare all'avvio (main.jsx), prima che React monti: Chrome emette
 * `beforeinstallprompt` presto, e un listener aggiunto dopo lo perderebbe.
 */
export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Niente mini-barra del browser: l'invito lo mostriamo noi.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const hasNativeInstallPrompt = () => deferredPrompt !== null;

/** Apre la finestra di installazione del browser. true se l'utente accetta. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  // Un evento si può usare una volta sola.
  deferredPrompt = null;
  await event.prompt();
  const choice = await event.userChoice;
  notify();
  return choice.outcome === "accepted";
}

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPadOS si presenta come un Mac: lo tradisce il touch.
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const readDismissedAt = (): number | null => {
  try {
    const value = Number(localStorage.getItem(DISMISSED_KEY));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
};

export function rememberInstallDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Storage bloccato (navigazione privata): l'invito tornerà, pazienza.
  }
}

export function detectInstallMode(): InstallMode | null {
  return installModeFrom({
    isIos: isIos(),
    isAndroid: /Android/i.test(navigator.userAgent),
    isStandalone: isStandalone(),
    hasNativePrompt: hasNativeInstallPrompt(),
    dismissedAt: readDismissedAt(),
    now: Date.now(),
  });
}
