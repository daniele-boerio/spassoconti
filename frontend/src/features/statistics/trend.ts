/**
 * Geometria del grafico "Trend risparmio": porta una serie di valori nelle
 * coordinate del `viewBox` e ci calcola sopra la retta di tendenza.
 *
 * Sta fuori dal componente perché è la parte che si può sbagliare in silenzio:
 * un grafico storto non lancia eccezioni, disegna una bugia.
 */

export interface Point {
  x: number;
  y: number;
}

export interface TrendBox {
  width: number;
  /** Margine laterale: il punto finale ha un pallino da 5.5 di raggio. */
  padX: number;
  /** Coordinata y del valore più alto e del più basso. */
  top: number;
  bottom: number;
  /** Base dell'area riempita sotto la linea. */
  baseline: number;
}

export interface Trend {
  points: Point[];
  /** `points` per la polilinea. */
  line: string;
  /** `points` per l'area chiusa sotto la linea. */
  area: string;
  /** Retta di tendenza, assente con meno di due valori. */
  guide: { x1: number; y1: number; x2: number; y2: number } | null;
  /** Pendenza della tendenza, nell'unità dei valori per passo. */
  slope: number;
  /**
   * Dove finisce un valore qualunque sull'asse verticale. Serve a tracciare
   * righe di riferimento (la media) sulla stessa scala della linea.
   */
  scaleY: (value: number) => number;
}

/**
 * Retta dei minimi quadrati su valori equispaziati (x = 0, 1, 2, …).
 * Con meno di due punti non c'è tendenza: pendenza zero.
 */
export function linearRegression(values: number[]): {
  slope: number;
  intercept: number;
} {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / n;

  let covariance = 0;
  let variance = 0;

  values.forEach((value, index) => {
    covariance += (index - meanX) * (value - meanY);
    variance += (index - meanX) ** 2;
  });

  const slope = variance === 0 ? 0 : covariance / variance;

  return { slope, intercept: meanY - slope * meanX };
}

export function buildTrend(values: number[], box: TrendBox): Trend | null {
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // Serie piatta: senza escursione ogni valore va a metà altezza, invece di
  // dividere per zero e finire fuori dal riquadro.
  const span = max - min || 1;

  const usableWidth = box.width - box.padX * 2;
  const step = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  const yOf = (value: number) =>
    box.bottom - ((value - min) / span) * (box.bottom - box.top);

  const points: Point[] = values.map((value, index) => ({
    x: box.padX + step * index,
    // Con un solo valore la linea non esiste: lo mettiamo al centro.
    y: values.length > 1 ? yOf(value) : (box.top + box.bottom) / 2,
  }));

  const line = points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} ${round(last.x)},${box.baseline} ${round(first.x)},${box.baseline}`;

  const { slope, intercept } = linearRegression(values);

  const guide =
    values.length > 1
      ? {
          x1: round(first.x),
          y1: round(yOf(intercept)),
          x2: round(last.x),
          y2: round(yOf(intercept + slope * (values.length - 1))),
        }
      : null;

  return { points, line, area, guide, slope, scaleY: yOf };
}

// Mezzo pixel di precisione basta e tiene il markup leggibile.
const round = (value: number) => Math.round(value * 10) / 10;
