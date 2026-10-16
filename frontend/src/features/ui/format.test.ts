import { describe, it, expect, vi } from "vitest";

// `i18n` rileva la lingua da `navigator` a import-time e i test girano in node:
// va stubbato PRIMA degli import.
vi.hoisted(() => {
  vi.stubGlobal("navigator", { languages: ["it-IT"], language: "it-IT" });
});

import { formatAmount, formatNumber } from "./format";

const MINUS = "\u2212";

describe("formatAmount", () => {
  it("mette il segno meno matematico prima del numero", () => {
    expect(formatAmount(-42.3)).toBe(`${MINUS}42,30`);
  });

  it("lascia i positivi senza segno per impostazione predefinita", () => {
    expect(formatAmount(1240)).toBe("1.240,00");
  });

  it("aggiunge il + solo quando richiesto (delta e variazioni)", () => {
    expect(formatAmount(8, { sign: "always" })).toBe("+8,00");
    expect(formatAmount(-8, { sign: "always" })).toBe(`${MINUS}8,00`);
  });

  it("può omettere il segno anche sui negativi", () => {
    expect(formatAmount(-8, { sign: "never" })).toBe("8,00");
  });

  it("arrotonda alle cifre richieste (hero senza decimali)", () => {
    expect(formatAmount(1240.49, { decimals: 0 })).toBe("1.240");
  });

  it("non mette segno sullo zero", () => {
    expect(formatAmount(0)).toBe("0,00");
  });
});

describe("formatNumber", () => {
  it("ignora il segno: lo aggiunge chi formatta l'importo", () => {
    expect(formatNumber(-1234.5)).toBe("1.234,50");
  });
});
