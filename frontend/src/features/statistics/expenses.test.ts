import { describe, it, expect } from "vitest";
import { expenseRows, yearExpenseRows, UNCATEGORIZED } from "./expenses";
import {
  MonthlyDetailCategory,
  YearDetailsStatRow,
} from "./interfaces";
import { Categoria } from "../categorie/interfaces";

const cat = (
  categoria: string,
  totale: number,
  sottocategorie: { sottocategoria: string; totale: number }[] = [],
): MonthlyDetailCategory => ({
  categoria,
  totale,
  tipo: totale < 0 ? "USCITA" : "ENTRATA",
  sottocategorie,
});

const categoria = (
  nome: string,
  sottocategorie: string[] = [],
): Categoria =>
  ({
    id: "14",
    nome,
    sottocategorie: sottocategorie.map((sub, index) => ({
      id: String(100 + index),
      nome: sub,
    })),
  }) as Categoria;

// Il payload del mese com'è senza filtro: "Casa" ha sottocategorie, le altre
// no, e quelle mandano una riga "Uncategorized" a testa.
const mesePieno = [
  cat("Casa", -404.42, [
    { sottocategoria: "Affitto", totale: -380 },
    { sottocategoria: "Gas", totale: -23 },
    { sottocategoria: "Pulizia", totale: -1.42 },
  ]),
  cat("Spesa", -55, [{ sottocategoria: UNCATEGORIZED, totale: -55 }]),
  cat("Svago", -15, [{ sottocategoria: UNCATEGORIZED, totale: -15 }]),
  cat("Auto", -7.99, [{ sottocategoria: UNCATEGORIZED, totale: -7.99 }]),
  cat("Stipendio", 1200, [{ sottocategoria: UNCATEGORIZED, totale: 1200 }]),
];

describe("expenseRows", () => {
  it("senza categoria elenca le categorie, dalla più cara", () => {
    const rows = expenseRows(mesePieno, null);

    expect(rows.map((row) => row.nome)).toEqual([
      "Casa",
      "Spesa",
      "Svago",
      "Auto",
    ]);
    // Le entrate non sono uscite, e il segno se ne va.
    expect(rows[0].totale).toBe(404.42);
  });

  it("con una categoria scende alle sue sottocategorie, con l'id per filtrare", () => {
    const rows = expenseRows(
      mesePieno,
      categoria("Casa", ["Affitto", "Gas", "Pulizia"]),
    );

    expect(rows).toEqual([
      { nome: "Affitto", totale: 380, sottocategoriaId: "100" },
      { nome: "Gas", totale: 23, sottocategoriaId: "101" },
      { nome: "Pulizia", totale: 1.42, sottocategoriaId: "102" },
    ]);
  });

  it("non mescola le sottocategorie delle altre categorie", () => {
    // Il caso che si vedeva a schermo: payload di tutto il mese (quello di un
    // attimo prima, o di un'altra schermata) e una categoria già scelta. Le
    // righe "Uncategorized" delle altre categorie non c'entrano niente.
    const rows = expenseRows(mesePieno, categoria("Casa", ["Affitto"]));

    expect(rows.filter((row) => row.nome === UNCATEGORIZED)).toEqual([]);
    expect(rows).toHaveLength(3);
  });

  it("non mostra niente finché il payload non parla della categoria scelta", () => {
    expect(expenseRows(mesePieno, categoria("Viaggi", ["Hotel"]))).toEqual([]);
  });

  it("lascia senza id le uscite che una sottocategoria non ce l'hanno", () => {
    const rows = expenseRows(
      [
        cat("Casa", -100, [
          { sottocategoria: "Affitto", totale: -80 },
          { sottocategoria: UNCATEGORIZED, totale: -20 },
        ]),
      ],
      categoria("Casa", ["Affitto"]),
    );

    expect(rows[1]).toEqual({
      nome: UNCATEGORIZED,
      totale: 20,
      sottocategoriaId: null,
    });
  });
});

// `yearDetails` manda una riga per mese con una colonna per etichetta, e le
// colonne sono le categorie finché non se ne sceglie una.
const annoPerCategorie: YearDetailsStatRow[] = [
  { month: 1, Casa: -400, Spesa: -50, Stipendio: 1500 },
  { month: 2, Casa: -404.42, Spesa: -30 },
  { month: 3 },
];

const annoPerSottocategorie: YearDetailsStatRow[] = [
  { month: 1, Affitto: -380, Gas: -20 },
  { month: 2, Affitto: -380, Gas: -23, [UNCATEGORIZED]: -1.42 },
];

describe("yearExpenseRows", () => {
  it("somma i mesi e mette in classifica le categorie", () => {
    const rows = yearExpenseRows(annoPerCategorie, null);

    expect(rows).toEqual([
      { nome: "Casa", totale: 804.42, sottocategoriaId: null },
      { nome: "Spesa", totale: 80, sottocategoriaId: null },
    ]);
  });

  it("con una categoria somma le sue sottocategorie, con l'id per filtrare", () => {
    const rows = yearExpenseRows(
      annoPerSottocategorie,
      categoria("Casa", ["Affitto", "Gas"]),
    );

    expect(rows).toEqual([
      { nome: "Affitto", totale: 760, sottocategoriaId: "100" },
      { nome: "Gas", totale: 43, sottocategoriaId: "101" },
      { nome: UNCATEGORIZED, totale: 1.42, sottocategoriaId: null },
    ]);
  });

  it("non mostra le categorie sotto il titolo di una categoria", () => {
    // Il payload è ancora quello per categorie: sono etichette che con la
    // categoria scelta non c'entrano, e vanno aspettate, non mostrate.
    expect(
      yearExpenseRows(annoPerCategorie, categoria("Casa", ["Affitto", "Gas"])),
    ).toEqual([]);
  });
});

describe("expenseRows con le entrate", () => {
  it("tiene solo le categorie col segno più, dalla più grande", () => {
    const rows = expenseRows(
      [...mesePieno, cat("Rimborsi", 80)],
      null,
      "entrate",
    );

    expect(rows.map((row) => [row.nome, row.totale])).toEqual([
      ["Stipendio", 1200],
      ["Rimborsi", 80],
    ]);
  });

  it("con una categoria scelta elenca le sue sottocategorie di entrata", () => {
    const data = [
      cat("Lavoro", 1500, [
        { sottocategoria: "Stipendio", totale: 1300 },
        { sottocategoria: "Bonus", totale: 200 },
      ]),
    ];

    const rows = expenseRows(
      data,
      categoria("Lavoro", ["Stipendio", "Bonus"]),
      "entrate",
    );

    expect(rows).toEqual([
      { nome: "Stipendio", totale: 1300, sottocategoriaId: "100" },
      { nome: "Bonus", totale: 200, sottocategoriaId: "101" },
    ]);
  });
});

describe("yearExpenseRows con le entrate", () => {
  it("somma i mesi e tiene solo le etichette col segno più", () => {
    const rows = yearExpenseRows(
      [
        { month: 1, Stipendio: 1200, Casa: -400 },
        { month: 2, Stipendio: 1200.1, Casa: -404.42, Regali: 50 },
      ] as YearDetailsStatRow[],
      null,
      "entrate",
    );

    expect(rows.map((row) => [row.nome, row.totale])).toEqual([
      ["Stipendio", 2400.1],
      ["Regali", 50],
    ]);
  });
});
