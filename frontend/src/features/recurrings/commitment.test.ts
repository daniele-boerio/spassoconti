import { describe, it, expect } from "vitest";
import { monthlyCommitment, overdue, upcoming } from "./commitment";
import { Recurring } from "./interfaces";

const rec = (
  partial: Partial<Recurring> & { importo: number },
): Recurring =>
  ({
    id: String(Math.random()),
    nome: "Voce",
    tipo: "USCITA",
    frequenza: "MENSILE",
    prossima_esecuzione: "2026-09-10",
    attiva: true,
    conto_id: "1",
    ...partial,
  }) as Recurring;

const today = new Date(2026, 8, 3);

describe("monthlyCommitment", () => {
  it("somma le uscite mensili così come sono", () => {
    expect(
      monthlyCommitment([rec({ importo: 650 }), rec({ importo: 12.99 })]),
    ).toBeCloseTo(662.99);
  });

  it("spalma l'annuale su dodici mesi", () => {
    expect(
      monthlyCommitment([rec({ importo: 1200, frequenza: "ANNUALE" })]),
    ).toBeCloseTo(100);
  });

  it("non conta la settimanale come quattro volte al mese", () => {
    // 52,18 settimane l'anno: su dodici mesi fa 4,35, non 4.
    const value = monthlyCommitment([
      rec({ importo: 10, frequenza: "SETTIMANALE" }),
    ]);

    expect(value).toBeGreaterThan(43);
    expect(value).toBeLessThan(44);
  });

  it("ignora entrate e ricorrenze sospese", () => {
    expect(
      monthlyCommitment([
        rec({ importo: 1850, tipo: "ENTRATA" }),
        rec({ importo: 45, attiva: false as unknown as true }),
      ]),
    ).toBe(0);
  });

  it("tratta una frequenza sconosciuta come mensile invece di scartarla", () => {
    expect(
      monthlyCommitment([rec({ importo: 30, frequenza: "LUNARE" })]),
    ).toBe(30);
  });
});

describe("overdue", () => {
  it("prende solo le attive con la data già passata", () => {
    const late = rec({ importo: 320, prossima_esecuzione: "2026-08-28" });

    expect(
      overdue(
        [
          late,
          rec({ importo: 10, prossima_esecuzione: "2026-09-03" }),
          rec({ importo: 10, prossima_esecuzione: "2026-09-10" }),
          rec({
            importo: 10,
            prossima_esecuzione: "2026-08-01",
            attiva: false as unknown as true,
          }),
        ],
        today,
      ),
    ).toEqual([late]);
  });

  it("oggi non è in ritardo", () => {
    expect(
      overdue([rec({ importo: 10, prossima_esecuzione: "2026-09-03" })], today),
    ).toEqual([]);
  });

  it("una variabile in scadenza oggi è già da registrare", () => {
    const bolletta = rec({
      importo: 80,
      prossima_esecuzione: "2026-09-03",
      importo_variabile: true,
    });
    expect(overdue([bolletta], today)).toEqual([bolletta]);
  });
});

describe("upcoming", () => {
  it("ordina per data e si ferma all'orizzonte", () => {
    const result = upcoming(
      [
        rec({ importo: 1, nome: "Tardi", prossima_esecuzione: "2026-10-20" }),
        rec({ importo: 2, nome: "Dopo", prossima_esecuzione: "2026-09-27" }),
        rec({ importo: 3, nome: "Presto", prossima_esecuzione: "2026-09-05" }),
      ],
      30,
      today,
    );

    expect(result.map((item) => item.nome)).toEqual(["Presto", "Dopo"]);
  });

  it("include oggi e lascia fuori il passato", () => {
    const result = upcoming(
      [
        rec({ importo: 1, nome: "Oggi", prossima_esecuzione: "2026-09-03" }),
        rec({ importo: 2, nome: "Ieri", prossima_esecuzione: "2026-09-02" }),
      ],
      30,
      today,
    );

    expect(result.map((item) => item.nome)).toEqual(["Oggi"]);
  });
});
