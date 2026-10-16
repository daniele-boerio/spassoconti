import { describe, it, expect } from "vitest";
import {
  addDays,
  daysBetweenIso,
  endOfMonth,
  relativeTime,
  startOfMonth,
  toIsoDate,
} from "./dates";

describe("toIsoDate", () => {
  it("formatta con il calendario locale, non in UTC", () => {
    // Alle 23 di un fuso avanti, la conversione via UTC darebbe il giorno dopo.
    expect(toIsoDate(new Date(2026, 8, 3, 23, 30))).toBe("2026-09-03");
  });

  it("mette lo zero davanti a mesi e giorni a una cifra", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("confini di mese", () => {
  it("il mese finisce sull'ultimo giorno vero", () => {
    expect(toIsoDate(endOfMonth(new Date(2028, 1, 10)))).toBe("2028-02-29");
    expect(toIsoDate(startOfMonth(new Date(2026, 8, 20)))).toBe("2026-09-01");
  });

  it("addDays scavalca il cambio di mese", () => {
    expect(toIsoDate(addDays(new Date(2026, 7, 31), 1))).toBe("2026-09-01");
  });
});

describe("daysBetweenIso", () => {
  it("conta i giorni fra due date", () => {
    expect(daysBetweenIso("2026-08-31", "2026-09-03")).toBe(3);
  });

  it("è negativo all'indietro e -1 su una data non valida", () => {
    expect(daysBetweenIso("2026-09-03", "2026-08-31")).toBe(-3);
    expect(daysBetweenIso("2026-09-03", "ieri")).toBe(-1);
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 8, 3, 12, 0, 0);

  it("sceglie l'unità più grossa che vale almeno 1", () => {
    expect(relativeTime(new Date(2026, 8, 3, 10, 0).toISOString(), "it", now)).toBe(
      "2 ore fa",
    );
  });

  it("usa le parole dove esistono", () => {
    expect(relativeTime(new Date(2026, 8, 2, 12, 0).toISOString(), "it", now)).toBe(
      "ieri",
    );
  });

  it("sotto il minuto non inventa un'unità", () => {
    expect(
      relativeTime(new Date(2026, 8, 3, 11, 59, 40).toISOString(), "it", now),
    ).toBe("ora");
  });

  it("non si rompe su valori mancanti o illeggibili", () => {
    expect(relativeTime(null, "it", now)).toBeNull();
    expect(relativeTime("mai", "it", now)).toBeNull();
  });
});
