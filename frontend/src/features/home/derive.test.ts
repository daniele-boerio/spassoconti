import { describe, it, expect } from "vitest";
import { monthlyAverage, percentDelta } from "./derive";

describe("percentDelta", () => {
  it("calcola il calo rispetto al mese prima", () => {
    expect(percentDelta(920, 1000)).toBe(-8);
  });

  it("calcola l'aumento", () => {
    expect(percentDelta(1100, 1000)).toBe(10);
  });

  it("non produce un delta senza un riferimento sensato", () => {
    // "+∞% vs agosto" non vuol dire niente: meglio non mostrare il badge.
    expect(percentDelta(500, 0)).toBeNull();
    expect(percentDelta(500, null)).toBeNull();
  });
});

describe("monthlyAverage", () => {
  it("divide il totale per i mesi", () => {
    expect(monthlyAverage(900, 3)).toBe(300);
  });

  it("non divide per zero", () => {
    expect(monthlyAverage(900, 0)).toBe(0);
  });
});
