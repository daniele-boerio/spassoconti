import { describe, it, expect } from "vitest";
import { monthOfLabel } from "./labels";

// Questo è il punto in cui la vista Grafici si è rotta davvero: apriva
// l'Analisi sul Mese, che riempie `charts_slice` con una finestra di dodici
// mesi a cavallo di due anni ("2025-09", …), poi passando su Grafici trovava
// quelle etichette già in memoria. `Number("2025-09")` è NaN, e `Intl` su una
// data NaN lancia: al posto dei grafici usciva la schermata di errore.

describe("monthOfLabel", () => {
  it("legge la forma corta, che è dell'anno richiesto per definizione", () => {
    expect(monthOfLabel("9", 2026)).toBe(9);
    expect(monthOfLabel("1", 2026)).toBe(1);
    expect(monthOfLabel("12", 2026)).toBe(12);
  });

  it("legge la forma lunga con lo zero davanti", () => {
    expect(monthOfLabel("2026-09", 2026)).toBe(9);
    expect(monthOfLabel("2026-01", 2026)).toBe(1);
  });

  it("scarta i mesi di un altro anno invece di disegnarli sull'asse sbagliato", () => {
    expect(monthOfLabel("2025-09", 2026)).toBeNull();
    expect(monthOfLabel("2027-01", 2026)).toBeNull();
  });

  it("scarta quello che non è un mese, invece di produrre una data NaN", () => {
    expect(monthOfLabel("", 2026)).toBeNull();
    expect(monthOfLabel("gennaio", 2026)).toBeNull();
    expect(monthOfLabel("0", 2026)).toBeNull();
    expect(monthOfLabel("13", 2026)).toBeNull();
    expect(monthOfLabel("9.5", 2026)).toBeNull();
  });
});
