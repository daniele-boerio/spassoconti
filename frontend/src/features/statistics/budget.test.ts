import { describe, it, expect } from "vitest";
import { budgetRows } from "./budget";
import { MonthlyDetailCategory } from "./interfaces";
import { Categoria } from "../categorie/interfaces";

const cat = (categoria: string, totale: number): MonthlyDetailCategory => ({
  categoria,
  totale,
  tipo: totale < 0 ? "USCITA" : "ENTRATA",
  sottocategorie: [],
});

const categoria = (
  id: string,
  nome: string,
  budget_mensile: number | null,
): Categoria => ({ id, nome, budget_mensile }) as Categoria;

const mese = [
  cat("Casa", -404.42),
  cat("Spesa", -620),
  cat("Svago", -30),
  cat("Stipendio", 1850),
];

describe("budgetRows", () => {
  it("tiene solo le categorie con un tetto, e le ordina per quota consumata", () => {
    const rows = budgetRows(mese, [
      categoria("1", "Casa", 500),
      categoria("2", "Spesa", 400),
      categoria("3", "Svago", null),
    ]);

    // Spesa è al 155%, Casa all'81%: prima quella più vicina a sfondare, non
    // quella che pesa di più. Svago non ha un tetto e non compare.
    expect(rows.map((row) => row.nome)).toEqual(["Spesa", "Casa"]);
    expect(rows[0]).toMatchObject({ speso: 620, budget: 400, over: true });
    expect(Math.round(rows[0].percent)).toBe(155);
    expect(rows[0].resta).toBe(-220);
  });

  it("una categoria col tetto e senza spese resta in elenco", () => {
    const [row] = budgetRows([], [categoria("1", "Casa", 500)]);

    expect(row).toMatchObject({
      speso: 0,
      budget: 500,
      percent: 0,
      resta: 500,
      over: false,
    });
  });

  it("le entrate non contano come spesa", () => {
    // Una categoria mista può chiudere il mese in positivo: non è che ci si
    // è spesi "meno di zero".
    const [row] = budgetRows(
      [cat("Rimborsi", 200)],
      [categoria("1", "Rimborsi", 300)],
    );

    expect(row.speso).toBe(0);
    expect(row.over).toBe(false);
  });

  it("un tetto a zero è sforato da qualunque spesa", () => {
    const [sforato] = budgetRows(
      [cat("Fumo", -12)],
      [categoria("1", "Fumo", 0)],
    );
    expect(sforato).toMatchObject({ percent: 100, resta: -12, over: true });

    const [rispettato] = budgetRows([], [categoria("1", "Fumo", 0)]);
    expect(rispettato).toMatchObject({ percent: 0, over: false });
  });

  it("spendere esattamente il tetto non è sforare", () => {
    const [row] = budgetRows(
      [cat("Casa", -500)],
      [categoria("1", "Casa", 500)],
    );

    expect(row).toMatchObject({ percent: 100, resta: 0, over: false });
  });
});

describe("budgetRows con una categoria sola", () => {
  // Il caso che la review ha trovato: con un filtro per categoria attivo,
  // `monthDetails` torna solo quella categoria. Passare l'elenco intero
  // dichiarerebbe a zero tutte le altre — che non sono a zero, sono fuori dal
  // payload. La schermata passa solo la categoria scelta, e qui si fissa che
  // il conto torni.
  it("guarda solo la categoria che le viene data", () => {
    const filtrato = [cat("Casa", -404.42)];

    const rows = budgetRows(filtrato, [categoria("1", "Casa", 500)]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nome: "Casa", speso: 404.42 });
  });

  it("le altre categorie col tetto non compaiono a zero", () => {
    const filtrato = [cat("Casa", -404.42)];

    // Se qualcuno le passasse comunque tutte, Spesa risulterebbe "0 di 400":
    // è proprio la bugia da non raccontare.
    const sbagliato = budgetRows(filtrato, [
      categoria("1", "Casa", 500),
      categoria("2", "Spesa", 400),
    ]);

    expect(sbagliato.find((row) => row.nome === "Spesa")).toMatchObject({
      speso: 0,
    });
  });
});
