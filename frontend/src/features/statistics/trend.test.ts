import { describe, it, expect } from "vitest";
import { buildTrend, linearRegression } from "./trend";

const box = { width: 360, padX: 8, top: 20, bottom: 126, baseline: 142 };

describe("linearRegression", () => {
  it("trova la pendenza di una serie che sale in modo regolare", () => {
    expect(linearRegression([100, 200, 300, 400]).slope).toBeCloseTo(100);
  });

  it("è negativa su una serie che scende", () => {
    expect(linearRegression([400, 300, 200]).slope).toBeCloseTo(-100);
  });

  it("è piatta su valori tutti uguali", () => {
    expect(linearRegression([250, 250, 250]).slope).toBe(0);
  });

  it("non inventa una tendenza con un punto solo", () => {
    expect(linearRegression([250])).toEqual({ slope: 0, intercept: 250 });
  });
});

describe("buildTrend", () => {
  it("non disegna niente senza valori", () => {
    expect(buildTrend([], box)).toBeNull();
  });

  it("appoggia il minimo in basso e il massimo in alto", () => {
    const trend = buildTrend([100, 500, 300], box)!;

    expect(trend.points[0].y).toBe(box.bottom);
    expect(trend.points[1].y).toBe(box.top);
    expect(trend.points[2].y).toBeGreaterThan(box.top);
    expect(trend.points[2].y).toBeLessThan(box.bottom);
  });

  it("distribuisce i punti da bordo a bordo, margini esclusi", () => {
    const trend = buildTrend([1, 2, 3], box)!;

    expect(trend.points[0].x).toBe(8);
    expect(trend.points[2].x).toBe(352);
  });

  it("chiude l'area sulla base, non sul fondo del riquadro", () => {
    const trend = buildTrend([100, 200], box)!;

    expect(trend.area.endsWith("352,142 8,142")).toBe(true);
  });

  it("mette una serie piatta a metà altezza invece di dividere per zero", () => {
    const trend = buildTrend([300, 300, 300], box)!;

    // Escursione nulla: tutti i punti sulla stessa quota, dentro al riquadro.
    for (const point of trend.points) {
      expect(point.y).toBeGreaterThanOrEqual(box.top);
      expect(point.y).toBeLessThanOrEqual(box.bottom);
    }
    expect(trend.slope).toBe(0);
  });

  it("con un valore solo non traccia la tendenza", () => {
    const trend = buildTrend([420], box)!;

    expect(trend.guide).toBeNull();
    expect(trend.points).toHaveLength(1);
  });

  it("la tendenza sale quando la serie sale", () => {
    const trend = buildTrend([100, 200, 300, 400], box)!;

    expect(trend.slope).toBeGreaterThan(0);
    // In SVG l'asse y punta in basso: salire significa y che diminuisce.
    expect(trend.guide!.y2).toBeLessThan(trend.guide!.y1);
  });
});

describe("scaleY", () => {
  it("porta un valore qualunque sulla stessa scala della linea", () => {
    const trend = buildTrend([100, 500], box)!;

    // La media di 100 e 500 cade a metà fra i due punti disegnati.
    expect(trend.scaleY(300)).toBeCloseTo((box.top + box.bottom) / 2);
  });

  it("è coerente con gli estremi della serie", () => {
    const trend = buildTrend([100, 500, 300], box)!;

    expect(trend.scaleY(100)).toBe(box.bottom);
    expect(trend.scaleY(500)).toBe(box.top);
  });
});
