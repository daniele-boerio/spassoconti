import { ComponentType, lazy, LazyExoticComponent } from "react";

/**
 * `React.lazy` che ritenta, pensato per la webapp in home su iOS.
 *
 * Ogni pagina è un chunk a parte, scaricato nel momento in cui ci si naviga —
 * quindi anche la home, al primo render dopo l'avvio. Su iPhone l'app in
 * standalone viene sospesa e ripresa in continuazione: al rilancio la rete
 * spesso non è ancora pronta (passaggio Wi-Fi/cellulare, DNS freddo, VPN che
 * si riattacca) e quel primo `import()` fallisce.
 *
 * Senza questo wrapper il fallimento è definitivo, per due motivi che si
 * sommano: `React.lazy` memorizza la promise rifiutata e non riprova mai più
 * per tutta la vita della pagina, e l'errore risalendo smonta l'intero albero.
 * È la schermata vuota da cui si esce solo chiudendo e riaprendo l'app.
 *
 * Qui il chunk viene richiesto di nuovo con attese crescenti. Se non arriva
 * nemmeno così, di solito il problema è l'altro: un index.html vecchio rimasto
 * in cache che punta a un bundle cancellato dal deploy successivo. In quel caso
 * ritentare è inutile e serve rileggere l'HTML, cioè un reload — uno solo,
 * `sessionStorage` fa da fusibile contro il ciclo.
 */

// Tre ritentativi in ~4.6s totali: abbastanza da coprire una rete che si sta
// riattaccando, poco abbastanza da non lasciare l'utente su uno spinner muto.
const RETRY_DELAYS_MS = [400, 1200, 3000];

const RELOAD_GUARD_KEY = "chunk-reload";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Il reload vale una volta per sessione: se non basta, è un ciclo infinito. */
const reloadOnce = (): boolean => {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  } catch {
    // Safari in navigazione privata può negare sessionStorage. Senza fusibile
    // meglio non ricaricare affatto: ci pensa l'ErrorBoundary a offrire il
    // "Riprova", che è la stessa cosa ma decisa dall'utente.
    return false;
  }

  window.location.reload();
  return true;
};

/** Un import riuscito dice che l'HTML è allineato: il fusibile si riarma. */
const clearReloadGuard = () => {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // Niente storage, niente fusibile da riarmare.
  }
};

type Loader<T> = () => Promise<{ default: T }>;

/**
 * La parte che si può provare senza montare React: esportata per i test, in
 * app si usa `lazyWithRetry`.
 */
export async function loadWithRetry<T>(
  loader: Loader<T>,
): Promise<{ default: T }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const module = await loader();
      clearReloadGuard();
      return module;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_DELAYS_MS.length) {
        await wait(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  // Il reload sostituisce il documento: questa promise non verrà mai
  // osservata, e risolverla con un errore farebbe solo lampeggiare la
  // schermata di errore un istante prima che la pagina sparisca.
  if (reloadOnce()) return new Promise<never>(() => {});

  throw lastError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  loader: Loader<T>,
): LazyExoticComponent<T> {
  return lazy(() => loadWithRetry(loader));
}
