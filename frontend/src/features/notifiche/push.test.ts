import { describe, expect, it } from "vitest";
import { pushSupportFrom, urlBase64ToUint8Array } from "./push";

const env = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  isIos: false,
  isStandalone: false,
};

describe("pushSupportFrom", () => {
  it("browser con tutte le API: supportato", () => {
    expect(pushSupportFrom(env)).toBe("supported");
  });

  it("iPhone da Safari: va aggiunta alla Home", () => {
    expect(
      pushSupportFrom({
        ...env,
        hasPushManager: false,
        isIos: true,
        isStandalone: false,
      }),
    ).toBe("needs_install");
  });

  it("iPhone dalla Home: supportato (iOS 16.4+)", () => {
    expect(pushSupportFrom({ ...env, isIos: true, isStandalone: true })).toBe(
      "supported",
    );
  });

  it("app sulla Home ma iOS vecchio: non supportato, non 'aggiungila alla Home'", () => {
    expect(
      pushSupportFrom({
        ...env,
        hasPushManager: false,
        isIos: true,
        isStandalone: true,
      }),
    ).toBe("unsupported");
  });

  it("senza service worker (build di sviluppo): non supportato", () => {
    expect(pushSupportFrom({ ...env, hasServiceWorker: false })).toBe(
      "unsupported",
    );
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodifica base64url senza padding", () => {
    // "-_8" in base64url è 0xfb 0xff in byte.
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([0xfb, 0xff]);
  });

  it("una chiave VAPID pubblica è un punto P-256 non compresso da 65 byte", () => {
    const key =
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });
});
