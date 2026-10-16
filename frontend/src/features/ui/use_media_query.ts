import { useEffect, useState } from "react";

/**
 * Vero finché la media query è soddisfatta.
 *
 * Quasi tutto il desktop si fa in CSS — è lì che sta il layout, e una media
 * query non fa ri-renderizzare niente. Questo hook serve ai pochi casi in cui
 * il DOM dev'essere proprio un altro: la riga dei Movimenti, che su schermo
 * largo è una riga di tabella a cinque colonne e sul telefono resta la riga a
 * due righe di sempre. Renderizzarle entrambe e nasconderne una vorrebbe dire
 * scrivere ogni movimento due volte nella pagina.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);

    // Il valore può essere cambiato fra il primo render e qui (rotazione,
    // finestra ridimensionata durante il caricamento).
    onChange();
    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// La stessa soglia di `$bp-desktop` in `styles/_variables.scss`: da qui in su
// c'è il rail al posto della tab bar.
const DESKTOP = "(min-width: 900px)";

export const useIsDesktop = () => useMediaQuery(DESKTOP);
