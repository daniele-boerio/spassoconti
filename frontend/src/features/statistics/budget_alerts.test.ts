import { describe, it, expect } from "vitest";
import {
  budgetAlerts,
  markSeen,
  monthKey,
  unseenAlerts,
} from "./budget_alerts";
import { Categoria } from "../categorie/interfaces";

const categoria = (id: string, nome: string, budget_mensile: number | null) =>
  ({ id, nome, budget_mensile }) as unknown as Categoria;

const noTotal = { budget: null, spent: 0 };

describe("budgetAlerts", () => {
  it("avvisa dall'80% e segnala lo sforamento", () => {
    const alerts = budgetAlerts({
      byCategory: [
        { label: "Ristoranti", value: 170 },
        { label: "Spesa", value: 520 },
        { label: "Svago", value: 30 },
      ],
      categorie: [
        categoria("1", "Ristoranti", 200),
        categoria("2", "Spesa", 500),
        categoria("3", "Svago", 100),
      ],
      spending: noTotal,
    });

    expect(alerts.map((a) => [a.nome, a.level])).toEqual([
      ["Spesa", "over"],
      ["Ristoranti", "warning"],
    ]);
  });

  it("le categorie senza budget non avvisano mai", () => {
    const alerts = budgetAlerts({
      byCategory: [{ label: "Casa", value: 9999 }],
      categorie: [categoria("1", "Casa", null)],
      spending: noTotal,
    });
    expect(alerts).toEqual([]);
  });

  it("un budget a zero è sforato dalla prima spesa", () => {
    const [alert] = budgetAlerts({
      byCategory: [{ label: "Sigarette", value: 5 }],
      categorie: [categoria("1", "Sigarette", 0)],
      spending: noTotal,
    });
    expect(alert.level).toBe("over");
  });

  it("include il tetto di spesa complessivo", () => {
    const [alert] = budgetAlerts({
      byCategory: [],
      categorie: [],
      spending: { budget: 1000, spent: 850 },
    });
    expect(alert).toMatchObject({ key: "total", nome: null, level: "warning" });
  });

  it("gli importi in stringa (Decimal) vengono convertiti", () => {
    const [alert] = budgetAlerts({
      byCategory: [{ label: "Spesa", value: "450.00" as unknown as number }],
      categorie: [categoria("1", "Spesa", 500)],
      spending: noTotal,
    });
    expect(alert.speso).toBe(450);
  });
});

describe("avvisi già mostrati", () => {
  const month = monthKey(new Date(2026, 9, 4));
  const warning = budgetAlerts({
    byCategory: [{ label: "Spesa", value: 450 }],
    categorie: [categoria("1", "Spesa", 500)],
    spending: noTotal,
  });
  const over = budgetAlerts({
    byCategory: [{ label: "Spesa", value: 550 }],
    categorie: [categoria("1", "Spesa", 500)],
    spending: noTotal,
  });

  it("un avviso visto non si ripete nello stesso mese", () => {
    const seen = markSeen(warning, null, month);
    expect(unseenAlerts(warning, seen, month)).toEqual([]);
  });

  it("passare da 'quasi' a 'sforato' avvisa di nuovo", () => {
    const seen = markSeen(warning, null, month);
    expect(unseenAlerts(over, seen, month)).toHaveLength(1);
  });

  it("un mese nuovo riparte da zero", () => {
    const seen = markSeen(warning, null, "2026-09");
    expect(unseenAlerts(warning, seen, month)).toHaveLength(1);
  });
});
