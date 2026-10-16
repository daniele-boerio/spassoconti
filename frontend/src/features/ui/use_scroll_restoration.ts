import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Una posizione per indirizzo, viva quanto la sessione: tornando indietro, o
// cambiando tab, la schermata riparte dall'altezza a cui la si era lasciata.
//
// L'indirizzo è percorso *e* query: `/transactions` e
// `/transactions?categoria_id=3` sono due liste diverse, e arrivare alla
// seconda da un link dell'Analisi non deve ereditare lo scroll della prima.
const positions = new Map<string, number>();

// Per quanto, al massimo, la posizione salvata resta difesa mentre la pagina
// si riempie. All'arrivo i dati spesso non ci sono ancora — i Movimenti
// ricaricano la prima pagina e ricrescono a colpi di scroll infinito — e
// finché il documento non è alto abbastanza il browser tronca lo scroll.
const HOLD_MS = 4000;

// Uno qualunque di questi vuol dire che lo scroll l'ha preso in mano l'utente:
// da lì in poi la posizione è la sua, non più quella da ripristinare.
const USER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/**
 * Riporta la finestra all'altezza a cui si era lasciata la schermata.
 *
 * A scorrere è il documento, non un riquadro interno (vedi `.page` in
 * App.scss): la posizione si legge e si scrive su `window`.
 */
export function useScrollRestoration(): void {
  const { pathname, search } = useLocation();
  const address = pathname + search;

  // L'indirizzo di adesso, letto al momento dello scroll. Il ripristino
  // riparte solo quando cambia il percorso: un filtro che riscrive la query
  // non deve far saltare la pagina, ma la posizione va salvata sotto la query
  // nuova, che è quella a cui "indietro" riporterà.
  const current = useRef(address);

  useLayoutEffect(() => {
    current.current = address;
  }, [address]);

  // Layout e non passivo: la posizione giusta è già lì al primo frame, e
  // l'ascoltatore della pagina che se ne va si stacca dentro lo stesso commit.
  // Con un effetto passivo farebbe in tempo a sentire lo scroll troncato dalla
  // pagina nuova, più corta, e a salvarlo come proprio.
  useLayoutEffect(() => {
    // Lasciato al browser, il ripristino scatterebbe al popstate: prima che
    // React abbia disegnato la pagina di destinazione, quindi su quella
    // sbagliata.
    history.scrollRestoration = "manual";

    const target = positions.get(current.current) ?? 0;
    window.scrollTo(0, target);

    // Finché tiene, la posizione salvata vale più di quella vera: gli scroll
    // di adesso sono i nostri, o il browser che li tronca.
    let holding = target > 0;

    const remember = () => {
      if (!holding) positions.set(current.current, window.scrollY);
    };

    // Ogni volta che il documento cambia altezza si riprova: i dati arrivano,
    // una sezione lazy si monta, lo scroll infinito accoda una pagina.
    const observer = new ResizeObserver(() => window.scrollTo(0, target));
    let timeout = 0;

    const release = () => {
      holding = false;
      observer.disconnect();
      window.clearTimeout(timeout);
      for (const type of USER_INPUT) {
        window.removeEventListener(type, release, true);
      }
    };

    if (holding) {
      observer.observe(document.body);
      timeout = window.setTimeout(release, HOLD_MS);
      for (const type of USER_INPUT) {
        window.addEventListener(type, release, { capture: true, passive: true });
      }
    }

    window.addEventListener("scroll", remember, { passive: true });

    return () => {
      release();
      window.removeEventListener("scroll", remember);
    };
  }, [pathname]);
}
