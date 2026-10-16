/**
 * Registrazione del service worker (public/sw.js): l'app si apre e mostra gli
 * ultimi dati visti anche senza rete.
 *
 * Solo nella build di produzione: in sviluppo una cache davanti a Vite
 * servirebbe moduli vecchi e confonderebbe l'HMR.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const api = import.meta.env.VITE_API_URL ?? "";
  const url = `/sw.js?api=${encodeURIComponent(api)}`;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(url).catch((error) => {
      // Senza service worker l'app funziona come prima, solo non offline.
      console.warn("Service worker non registrato", error);
    });
  });
}

/**
 * Svuota le risposte dell'API salvate per l'offline. Al logout: su un
 * telefono condiviso, offline non devono comparire i dati dell'utente prima.
 */
export function clearApiCache(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "clear-api-cache" });
}
