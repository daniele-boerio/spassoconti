import { describe, it, expect } from "vitest";
import { periodRange } from "./period";

// 2026-09-03, un giovedì.
const today = new Date(2026, 8, 3);

describe("periodRange", () => {
  it("prende il mese corrente da capo a fondo", () => {
    expect(periodRange("month", today)).toEqual({
      data_inizio: "2026-09-01",
      data_fine: "2026-09-30",
    });
  });

  it("prende il mese precedente, con la sua lunghezza", () => {
    expect(periodRange("last_month", today)).toEqual({
      data_inizio: "2026-08-01",
      data_fine: "2026-08-31",
    });
  });

  it("conta oggi dentro i 90 giorni", () => {
    // Novanta giorni che finiscono oggi: 89 indietro più oggi.
    expect(periodRange("last_90", today)).toEqual({
      data_inizio: "2026-06-06",
      data_fine: "2026-09-03",
    });
  });

  it("prende l'anno solare", () => {
    expect(periodRange("year", today)).toEqual({
      data_inizio: "2026-01-01",
      data_fine: "2026-12-31",
    });
  });

  it("non filtra su 'tutto' e non tocca le date scelte a mano", () => {
    expect(periodRange("all", today)).toEqual({});
    expect(periodRange("custom", today)).toEqual({});
  });

  it("regge il passaggio d'anno del mese precedente", () => {
    expect(periodRange("last_month", new Date(2026, 0, 15))).toEqual({
      data_inizio: "2025-12-01",
      data_fine: "2025-12-31",
    });
  });

  it("regge febbraio bisestile", () => {
    expect(periodRange("month", new Date(2028, 1, 10))).toEqual({
      data_inizio: "2028-02-01",
      data_fine: "2028-02-29",
    });
  });
});
