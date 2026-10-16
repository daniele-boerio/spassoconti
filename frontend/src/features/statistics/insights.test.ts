import { describe, it, expect } from "vitest";
import { buildInsights } from "./insights";
import { MonthlyDetailCategory } from "./interfaces";

const cat = (categoria: string, totale: number): MonthlyDetailCategory => ({
  categoria,
  totale,
  tipo: totale < 0 ? "USCITA" : "ENTRATA",
  sottocategorie: [],
});

const base = {
  categories: [cat("Spesa", -400), cat("Svago", -150), cat("Casa", -100)],
  averages: {} as Record<string, number>,
  savings: 500,
  income: 2000,
};

describe("buildInsights", () => {
  it("segnala la categoria più sopra la sua media", () => {
    const [first] = buildInsights({
      ...base,
      averages: { Spesa: 380, Svago: 90 },
    });

    // Svago è +67%, Spesa solo +5%: vince lo scostamento più grosso, non
    // l'importo più grosso.
    expect(first).toMatchObject({
      kind: "above_average",
      tone: "negative",
      category: "Svago",
      percent: 67,
    });
  });

  it("tace sugli scostamenti piccoli", () => {
    const insights = buildInsights({
      ...base,
      averages: { Spesa: 380, Svago: 140, Casa: 95 },
    });

    expect(insights.some((i) => i.kind === "above_average")).toBe(false);
  });

  it("non confronta con una media che non esiste", () => {
    // Primo mese di una categoria: media 0, nessuna percentuale sensata.
    const insights = buildInsights({ ...base, averages: { Svago: 0 } });

    expect(insights.some((i) => i.kind === "above_average")).toBe(false);
  });

  it("dice quando il mese chiude in rosso", () => {
    const insights = buildInsights({ ...base, savings: -120 });

    expect(insights[0]).toMatchObject({ kind: "overspent", tone: "negative" });
  });

  it("festeggia una quota di risparmio alta", () => {
    const insights = buildInsights({ ...base, savings: 600, income: 2000 });

    expect(insights[0]).toMatchObject({
      kind: "saved_share",
      tone: "positive",
      percent: 30,
    });
  });

  it("non festeggia un risparmio marginale", () => {
    const insights = buildInsights({ ...base, savings: 100, income: 2000 });

    expect(insights.some((i) => i.kind === "saved_share")).toBe(false);
  });

  it("segnala la concentrazione solo se resta spazio", () => {
    // Spesa è 400 su 650 di uscite e non c'è nient'altro da dire.
    const insights = buildInsights({ ...base, savings: 100 });

    expect(insights).toEqual([
      { kind: "concentration", tone: "negative", category: "Spesa", percent: 62 },
    ]);
  });

  it("non scrive mai più di due frasi", () => {
    const insights = buildInsights({
      ...base,
      averages: { Svago: 50 },
      savings: 800,
      income: 2000,
    });

    expect(insights).toHaveLength(2);
  });

  it("regge un mese senza movimenti", () => {
    expect(
      buildInsights({ categories: [], averages: {}, savings: 0, income: 0 }),
    ).toEqual([]);
  });
});

describe("striscia di mesi in positivo", () => {
  it("conta i mesi di fila chiusi in positivo, mese corrente incluso", () => {
    const insights = buildInsights({
      ...base,
      savings: 100,
      history: [200, 300, 400],
    });

    expect(insights).toContainEqual({
      kind: "streak",
      tone: "positive",
      count: 4,
    });
  });

  it("si ferma al primo mese in rosso, anche se prima andava bene", () => {
    // Il 500 di quattro mesi fa non conta: la striscia parte dopo il mese in
    // rosso, quindi sono tre e non cinque.
    const insights = buildInsights({
      ...base,
      savings: 100,
      history: [500, -50, 400, 300],
    });

    expect(insights).toContainEqual({
      kind: "streak",
      tone: "positive",
      count: 3,
    });
  });

  it("tace sotto i tre mesi: due di fila non sono una striscia", () => {
    const insights = buildInsights({
      ...base,
      savings: 100,
      history: [-10, 400],
    });

    expect(insights.some((i) => i.kind === "streak")).toBe(false);
  });

  it("non parla di strisce se il mese corrente è in rosso", () => {
    const insights = buildInsights({
      ...base,
      savings: -10,
      history: [400, 500, 600],
    });

    expect(insights.some((i) => i.kind === "streak")).toBe(false);
  });

  it("senza storico non inventa una striscia", () => {
    const insights = buildInsights({ ...base, savings: 100 });

    expect(insights.some((i) => i.kind === "streak")).toBe(false);
  });
});
