/*
 * Service worker di SpassoConto: l'app si apre e si legge anche senza rete.
 *
 * Su iPhone la web app aggiunta alla Home lo supporta (cache e fetch), ma non
 * ha la sincronizzazione in background: i movimenti salvati offline li invia
 * l'app stessa quando è aperta (vedi features/transactions/offline_queue.ts),
 * non questo file. Le notifiche push invece sì (da iOS 16.4, solo dalla Home):
 * vedi i listener "push" e "notificationclick".
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
 * L'API sta sullo stesso origin dell'app, sotto /api (nginx la gira al BE).
 */

// v2: l'API è passata dal dominio conti-be a /api, le cache v1 vanno buttate.
const VERSION = "v2";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const API_CACHE = `api-${VERSION}`;
const KEEP = [SHELL_CACHE, ASSET_CACHE, API_CACHE];

// Gli asset con hash si accumulano a ogni deploy: oltre questa soglia si
// buttano i più vecchi.
const MAX_ASSETS = 150;
const MAX_API_ENTRIES = 80;

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

// --- Notifiche push ---------------------------------------------------------
//
// Il server (services.invia_notifica) manda {title, body, url, tag}. Ogni push
// DEVE mostrare una notifica: Safari e Chrome revocano l'iscrizione a chi
// riceve push "silenziose".
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "SpassoConti", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Stesso tag = la nuova sostituisce la vecchia invece di accumularsi.
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    }),
  );
});

// Tocco sulla notifica: si apre la pagina giusta, riusando la finestra
// dell'app se è già aperta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find(
          (client) => new URL(client.url).origin === target.origin,
        );
        if (open) {
          return open.focus().then((client) => client?.navigate?.(target.href));
        }
        return self.clients.openWindow(target.href);
      }),
  );
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
    if (url.pathname.startsWith("/api/")) {
      // File generati (export CSV) e refresh di sessione non si salvano.
      if (!url.pathname.includes("/export") && !url.pathname.startsWith("/api/auth")) {
        event.respondWith(networkFirst(request, API_CACHE, null, MAX_API_ENTRIES));
      }
    } else if (url.pathname.startsWith("/assets/")) {
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
  }
});
