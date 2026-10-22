import { describe, expect, it } from "vitest";
import { mapTagSuggestion, toggleId } from "./suggestion";

describe("mapTagSuggestion", () => {
  it("converte importi e id dell'anteprima", () => {
    const mapped = mapTagSuggestion({
      tipo: "nuovo",
      tag_id: null,
      nome: "paolo",
      chiave: "con paol",
      frase: "con Paolo",
      occorrenze: 1,
      transazioni: [
        { id: 7, data: "2026-10-01", descrizione: "pizza con Paolo", importo: "12.50" },
      ],
    });

    expect(mapped.tag_id).toBeNull();
    expect(mapped.transazioni[0]).toEqual({
      id: "7",
      data: "2026-10-01",
      descrizione: "pizza con Paolo",
      importo: 12.5,
    });
  });

  it("id del tag esistente a stringa", () => {
    const mapped = mapTagSuggestion({
      tipo: "esistente",
      tag_id: 3,
      nome: "gaia",
      chiave: "con gai",
      frase: "con Gaia",
      occorrenze: 4,
      transazioni: [],
    });
    expect(mapped.tag_id).toBe("3");
  });
});

describe("toggleId", () => {
  it("aggiunge e toglie", () => {
    expect(toggleId(["1", "2"], "2")).toEqual(["1"]);
    expect(toggleId(["1"], "3")).toEqual(["1", "3"]);
  });
});
