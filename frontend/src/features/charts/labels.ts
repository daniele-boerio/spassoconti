/**
 * Le etichette dei mesi come le manda `routers/charts.py`.
 *
 * Il BE ne usa due forme: `"9"` quando l'intervallo richiesto sta dentro un
 * anno solo, `"2025-09"` quando lo scavalca (`multi_year` in `get_date_range`).
 *
 * Chi legge quelle etichette non può dare per scontata la forma corta, perché
 * `charts_slice` è un secchio unico riempito da schermate diverse: la vista
 * Mese chiede dodici mesi indietro — una finestra che a cavallo dell'anno è
 * sempre lunga — e la vista Grafici trova quei dati già in memoria al primo
 * render, prima che arrivi la sua risposta.
 *
 * Da lì venivano due guai. `Number("2025-09")` è `NaN`, e una data costruita su
 * `NaN` fa lanciare `Intl.DateTimeFormat` con un `RangeError`: non un grafico
 * storto, proprio la schermata di errore al posto della pagina. E anche senza
 * lanciare, disegnare mesi di un altro anno sull'asse dell'anno corrente
 * sarebbe una bugia.
 */

/**
 * Il mese di un'etichetta, ma solo se appartiene all'anno che si sta guardando.
 * `null` per tutto il resto: etichetta di un altro anno, o non interpretabile.
 */
export function monthOfLabel(label: string, year: number): number | null {
  const parts = String(label).split("-");
  const hasYear = parts.length > 1;

  const month = Number(parts[hasYear ? 1 : 0]);
  // Senza anno nell'etichetta l'anno è quello richiesto: il BE la accorcia
  // proprio perché è l'unico possibile.
  const labelYear = hasYear ? Number(parts[0]) : year;

  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (labelYear !== year) return null;

  return month;
}
