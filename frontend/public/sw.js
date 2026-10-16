/*
 * Service worker di SpassoConto: l'app si apre e si legge anche senza rete.
 *
 * Su iPhone la web app aggiunta alla Home lo supporta (cache e fetch), ma non
 * ha la sincronizzazione in background: i movimenti salvati offline li invia
 * l'app stessa quando è aperta (vedi features/transactions/offline_queue.ts),
 * non questo file.
 *
 * Strategie:
 * - navigazioni (l'HTML): prima la rete, così un deploy nuovo arriva subito;
 *   senza rete, l'ultima index.html salvata.
 * - /assets/* (JS e CSS con l'hash nel nome): prima la cache, il contenuto di
 *   un nome non cambia mai.
 * - icone, manifest, font Google: prima la cache.
 * - GET all'API: prima la rete, e la risposta buona si salva; senza rete
 *   l'ultima salvata, così Home e Movimenti mostrano gli ultimi dati visti.
 *   Le scritture (POST/PUT/DELETE) non passano mai dalla cache.
 *
 * L'origine dell'API arriva nella query di registrazione (`sw.js?api=...`):
 * il service worker non vede le variabili di Vite.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const API_CACHE = `api-${VERSION}`;
const KEEP = [SHELL_CACHE, ASSET_CACHE, API_CACHE];

// Gli asset con hash si accumulano a ogni deploy: oltre questa soglia si
// buttano i più vecchi.
const MAX_ASSETS = 150;
const MAX_API_ENTRIES = 80;

const API_ORIGIN = (() => {
  try {
    const api = new URL(self.location.href).searchParams.get("api");
    return api ? new URL(api).origin : null;
  } catch {
    return null;
  }
})();

const SHELL = ["/", "/index.html", "/manifest.json", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KEEP.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// L'app chiede di svuotare i dati dell'API al logout: su un telefono usato da
// due persone, offline non si devono vedere i movimenti dell'altro.
self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-api-cache") {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) {
    await cache.delete(key);
  }
}

async function cacheFirst(request, cacheName, max) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (max) trim(cacheName, max);
  }
  return response;
}

async function networkFirst(request, cacheName, fallbackUrl, max) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(fallbackUrl ?? request, response.clone());
      if (max) trim(cacheName, max);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/index.html"));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(cacheFirst(request, ASSET_CACHE, MAX_ASSETS));
    } else if (SHELL.includes(url.pathname) || /\.(png|svg|ico)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    }
    return;
  }

  if (
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // File generati (export CSV) e refresh di sessione non si salvano.
  if (
    API_ORIGIN &&
    url.origin === API_ORIGIN &&
    !url.pathname.includes("/export") &&
    !url.pathname.startsWith("/auth")
  ) {
    event.respondWith(networkFirst(request, API_CACHE, null, MAX_API_ENTRIES));
  }
});
