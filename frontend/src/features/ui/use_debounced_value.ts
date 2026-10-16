import { useEffect, useState } from "react";

/**
 * Il valore com'era `delay` millisecondi fa, se nel frattempo è rimasto fermo.
 * Serve dove ogni battuta di tasto o ogni pixel di trascinamento farebbe
 * partire una chiamata: la ricerca dei Movimenti e il cursore degli importi.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
