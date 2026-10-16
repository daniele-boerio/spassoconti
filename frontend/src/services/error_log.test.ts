import { describe, it, expect, beforeEach, vi } from "vitest";

// `error_log` legge `window` e `navigator` a runtime e i test girano in node.
vi.hoisted(() => {
  vi.stubGlobal("window", {
    location: { pathname: "/analysis", search: "?scope=categories" },
  });
  vi.stubGlobal("navigator", { userAgent: "iPhone di prova" });
});

import {
  buildErrorReport,
  clearEntries,
  record,
  recentEntries,
} from "./error_log";

// Questo registro esiste per un motivo solo: su un iPhone la console non si
// apre, quindi uno stack che non finisce in un testo copiabile è uno stack
// perso. Se il testo si svuota o si tronca male, l'errore lo si ripara a
// indovinare.

beforeEach(() => {
  clearEntries();
});

describe("il buffer", () => {
  it("tiene le ultime righe e butta le più vecchie", () => {
    for (let i = 0; i < 40; i++) record("error", `riga ${i}`);

    const entries = recentEntries();

    expect(entries.length).toBeLessThanOrEqual(25);
    // Quelle vicine al guasto sono le ultime: sono loro che devono restare.
    expect(entries[entries.length - 1].text).toBe("riga 39");
    expect(entries.some((entry) => entry.text === "riga 0")).toBe(false);
  });

  it("accorcia le righe lunghe invece di allagare il testo da incollare", () => {
    record("error", "x".repeat(1000));

    expect(recentEntries()[0].text.length).toBeLessThan(320);
  });

  it("scrive gli oggetti senza inciampare sui cicli", () => {
    const ciclico: Record<string, unknown> = { nome: "conto" };
    ciclico.se_stesso = ciclico;

    expect(() => record("error", ciclico)).not.toThrow();
    expect(recentEntries()).toHaveLength(1);
  });

  it("riconosce un Error fra gli argomenti", () => {
    record("error", new TypeError("x is not a function"));

    expect(recentEntries()[0].text).toContain("TypeError: x is not a function");
  });
});

describe("buildErrorReport", () => {
  it("mette insieme errore, posizione e log recenti", () => {
    record("error", "Failed to fetch");

    const error = new Error("Invalid time value");
    error.name = "RangeError";
    error.stack = "RangeError: Invalid time value\n  at monthInitial\n  at ChartsPage";

    const report = buildErrorReport(error, "\n    at ChartsPage\n    at Suspense");

    expect(report).toContain("RangeError: Invalid time value");
    expect(report).toContain("at monthInitial");
    expect(report).toContain("at Suspense");
    expect(report).toContain("Failed to fetch");
    // Serve a sapere da quale schermata è partito tutto.
    expect(report).toContain("/analysis?scope=categories");
  });

  it("regge un errore senza stack, invece di produrre un testo vuoto", () => {
    const report = buildErrorReport(new Error("boom"), null);

    expect(report).toContain("Error: boom");
    expect(report).toContain("SpassoConto");
  });

  it("dice che non c'è un errore invece di scrivere 'undefined'", () => {
    expect(buildErrorReport(null, null)).toContain("(nessuno)");
  });
});
