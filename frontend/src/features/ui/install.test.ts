import { describe, expect, it } from "vitest";
import { DISMISS_FOR_MS, installModeFrom } from "./install";

const env = {
  isIos: false,
  isAndroid: false,
  isStandalone: false,
  hasNativePrompt: false,
  dismissedAt: null,
  now: 1_000_000_000_000,
};

describe("installModeFrom", () => {
  it("app già installata: nessun invito", () => {
    expect(
      installModeFrom({ ...env, isIos: true, isStandalone: true }),
    ).toBeNull();
  });

  it("iPhone da Safari: istruzioni di Condividi", () => {
    expect(installModeFrom({ ...env, isIos: true })).toBe("ios");
  });

  it("Android con il prompt del browser: installazione nativa", () => {
    expect(
      installModeFrom({ ...env, isAndroid: true, hasNativePrompt: true }),
    ).toBe("native");
  });

  it("Android senza prompt (Firefox): istruzioni dal menu", () => {
    expect(installModeFrom({ ...env, isAndroid: true })).toBe("android_manual");
  });

  it("desktop senza prompt: nessun invito", () => {
    expect(installModeFrom(env)).toBeNull();
  });

  it("chiuso da poco: non torna; dopo due settimane sì", () => {
    const ios = { ...env, isIos: true };
    expect(installModeFrom({ ...ios, dismissedAt: env.now - 1000 })).toBeNull();
    expect(
      installModeFrom({ ...ios, dismissedAt: env.now - DISMISS_FOR_MS - 1 }),
    ).toBe("ios");
  });
});
