import { describe, expect, it } from "vitest";
import { linkMovimenti } from "./doppioni";
import { decodeFilters } from "../transactions/filters_url";
import { Doppione } from "./interfaces";

const gruppo = (campi: Partial<Doppione> = {}): Doppione =>
  ({
    data: "2026-05-28",
    tipo: "USCITA",
    importo: 15,
    descrizione: "Parrucchiere",
    transazioni: [{ id: "1", conto_id: "7" }, { id: "2", conto_id: "7" }],
    ...campi,
  }) as unknown as Doppione;

describe("linkMovimenti", () => {
  it("apre i Movimenti filtrati su giorno, conto, tipo e descrizione", () => {
    const url = linkMovimenti(gruppo());
    expect(url.startsWith("/transactions?")).toBe(true);

    const { period, filters } = decodeFilters(new URLSearchParams(url.split("?")[1]));
    expect(period).toBe("custom");
    expect(filters).toMatchObject({
      data_inizio: "2026-05-28",
      data_fine: "2026-05-28",
      tipo: "USCITA",
      conto_id: ["7"],
      descrizione: "Parrucchiere",
    });
  });

  it("senza descrizione non filtra sul testo", () => {
    const url = linkMovimenti(gruppo({ descrizione: "" }));
    expect(new URLSearchParams(url.split("?")[1]).has("q")).toBe(false);
  });
});
