import { describe, it, expect } from "vitest";
import { Transaction, tipoTransaction } from "./interfaces";
import {
  amountCeiling,
  amountSign,
  dayOffset,
  groupByDay,
  signedAmount,
} from "./group";

const tx = (data: string, importo: number, tipo: tipoTransaction = "USCITA") =>
  ({ id: `${data}-${importo}`, data, importo, tipo }) as unknown as Transaction;

describe("signedAmount", () => {
  it("scala uscite e accantonamenti", () => {
    expect(signedAmount(tx("2026-09-02", 42.3, "USCITA"))).toBe(-42.3);
    expect(signedAmount(tx("2026-09-02", 200, "ACCANTONAMENTO"))).toBe(-200);
  });

  it("somma entrate e rimborsi", () => {
    expect(signedAmount(tx("2026-09-02", 1850, "ENTRATA"))).toBe(1850);
    expect(signedAmount(tx("2026-09-02", 12, "RIMBORSO"))).toBe(12);
  });

  it("lascia il giroconto fuori dal bilancio", () => {
    // Sposta denaro fra due conti dell'utente: il patrimonio non cambia.
    expect(signedAmount(tx("2026-09-02", 500, "RICARICA"))).toBe(0);
  });
});

describe("amountSign", () => {
  it("mostra sempre il segno tranne che sui giroconti", () => {
    expect(amountSign("USCITA")).toBe("always");
    expect(amountSign("ENTRATA")).toBe("always");
    expect(amountSign("RICARICA")).toBe("never");
  });
});

describe("groupByDay", () => {
  it("accorpa per giorno tenendo l'ordine di arrivo", () => {
    const groups = groupByDay([
      tx("2026-09-02", 42.3),
      tx("2026-09-02", 12.99),
      tx("2026-09-01", 1850, "ENTRATA"),
    ]);

    expect(groups.map((group) => group.day)).toEqual([
      "2026-09-02",
      "2026-09-01",
    ]);
    expect(groups[0].transactions).toHaveLength(2);
    expect(groups[0].total).toBeCloseTo(-55.29);
    expect(groups[1].total).toBe(1850);
  });

  it("riconosce lo stesso giorno anche con l'orario nella data", () => {
    const groups = groupByDay([
      tx("2026-09-02", 10),
      tx("2026-09-02T18:42:00Z", 5),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].total).toBe(-15);
  });

  it("non conta i giroconti nel subtotale del giorno", () => {
    const groups = groupByDay([
      tx("2026-09-02", 200, "RICARICA"),
      tx("2026-09-02", 12.99),
    ]);

    expect(groups[0].transactions).toHaveLength(2);
    expect(groups[0].total).toBe(-12.99);
  });

  it("non inventa gruppi su una lista vuota", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("amountCeiling", () => {
  const at = (importo: number) => tx("2026-09-02", importo);

  it("parte da 500 anche con importi piccoli", () => {
    // Un cursore che finisce a 12 € non si trascina.
    expect(amountCeiling([at(12), at(3)])).toBe(500);
  });

  it("sale al primo tetto tondo che contiene il massimo", () => {
    expect(amountCeiling([at(1847)])).toBe(2500);
  });

  it("arrotonda a centomila oltre l'ultimo tetto", () => {
    expect(amountCeiling([at(230_000)])).toBe(300_000);
  });

  it("guarda il valore assoluto e regge la lista vuota", () => {
    expect(amountCeiling([at(-4000)])).toBe(5000);
    expect(amountCeiling([])).toBe(500);
  });
});

describe("dayOffset", () => {
  const today = new Date(2026, 8, 3);

  it("riconosce oggi e ieri", () => {
    expect(dayOffset("2026-09-03", today)).toBe(0);
    expect(dayOffset("2026-09-02", today)).toBe(1);
  });

  it("conta i giorni indietro anche a cavallo di mese", () => {
    expect(dayOffset("2026-08-31", today)).toBe(3);
  });

  it("resta negativo nel futuro", () => {
    expect(dayOffset("2026-09-05", today)).toBe(-2);
  });
});
