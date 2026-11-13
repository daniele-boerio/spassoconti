import { describe, expect, it } from "vitest";
import { linkMovimenti } from "./doppioni";
import { decodeFilters } from "../transactions/filters_url";
import { Doppione } from "./interfaces";

const gruppo = {
  data: "2026-05-28",
  tipo: "USCITA",
  importo: 15,
  descrizione: "Parrucchiere",
  transazioni: [{ id: "1", conto_id: "7" }, { id: "2", conto_id: "7" }],
} as unknown as Doppione;

describe("linkMovimenti", () => {
  it("apre i Movimenti di quel giorno, senza altri filtri", () => {
    const url = linkMovimenti(gruppo);
    expect(url).toBe("/transactions?periodo=custom&da=2026-05-28&a=2026-05-28");

    const { period, filters } = decodeFilters(new URLSearchParams(url.split("?")[1]));
    expect(period).toBe("custom");
    expect(filters).toMatchObject({ data_inizio: "2026-05-28", data_fine: "2026-05-28" });
    expect(filters.tipo).toBeUndefined();
    expect(filters.conto_id).toBeUndefined();
    expect(filters.descrizione).toBeUndefined();
  });
});
