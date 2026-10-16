import { describe, it, expect, beforeEach, vi } from "vitest";

// `ui_slice` legge localStorage a import-time e i test girano in node:
// va stubbato PRIMA degli import (stesso pattern di profile_slice.test.ts).
vi.hoisted(() => {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  } as Storage;
});

import reducer, {
  dismissToast,
  pushToast,
  setTheme,
} from "./ui_slice";
import { THEME_STORAGE_KEY } from "./theme";

const initial = reducer(undefined, { type: "@@INIT" });

describe("ui_slice", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("parte da 'system' quando localStorage non ha una preferenza valida", () => {
    expect(initial.theme).toBe("system");
  });

  it("salva la preferenza di tema scelta dall'utente", () => {
    const state = reducer(initial, setTheme("dark"));

    expect(state.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("persiste anche 'system', così non si ricade sul default per caso", () => {
    const state = reducer({ ...initial, theme: "dark" }, setTheme("system"));

    expect(state.theme).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});

describe("ui_slice · toast", () => {
  const toast = (id: string) => ({
    id,
    variant: "success" as const,
    title: "Transazione salvata",
    duration: 5000,
  });

  it("accoda i toast nell'ordine di arrivo", () => {
    const one = reducer(initial, pushToast(toast("a")));
    const two = reducer(one, pushToast(toast("b")));

    expect(two.toasts.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("chiude solo il toast indicato", () => {
    const withTwo = reducer(
      reducer(initial, pushToast(toast("a"))),
      pushToast(toast("b")),
    );

    const state = reducer(withTwo, dismissToast("a"));

    expect(state.toasts.map((t) => t.id)).toEqual(["b"]);
  });
});
