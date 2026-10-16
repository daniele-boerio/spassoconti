import { describe, it, expect } from "vitest";
import { categoryIcon } from "./icons";

describe("categoryIcon", () => {
  it("riconosce le categorie comuni dal nome", () => {
    expect(categoryIcon("Spesa")).toBe("ph-bold ph-shopping-cart");
    expect(categoryIcon("Casa")).toBe("ph-bold ph-house");
    expect(categoryIcon("Trasporti")).toBe("ph-bold ph-car");
    expect(categoryIcon("Svago")).toBe("ph-bold ph-ticket");
  });

  it("ignora maiuscole e accenti", () => {
    expect(categoryIcon("UTENZE")).toBe("ph-bold ph-lightning");
    expect(categoryIcon("Bollètte")).toBe("ph-bold ph-lightning");
  });

  it("riconosce anche dentro un nome più lungo", () => {
    expect(categoryIcon("Spesa settimanale")).toBe("ph-bold ph-shopping-cart");
  });

  it("ripiega su un'icona neutra quando non sa", () => {
    expect(categoryIcon("Qualcosa di mio")).toBe("ph-bold ph-tag");
    expect(categoryIcon(null)).toBe("ph-bold ph-tag");
    expect(categoryIcon("")).toBe("ph-bold ph-tag");
  });
});
