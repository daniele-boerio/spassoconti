import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `lazy_with_retry` parla con `sessionStorage` e `window.location`, e i test
// girano in node (vedi profile_slice.test.ts): vanno stubbati PRIMA dell'import.
const reload = vi.fn();

vi.hoisted(() => {
  const values = new Map<string, string>();
  globalThis.sessionStorage = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = { location: { reload: () => reload() } };

import { loadWithRetry } from "./lazy_with_retry";

// Il chunk di una pagina viene chiesto proprio all'avvio, quando la rete di un
// telefono che si è appena risvegliato spesso non c'è ancora. Se quel primo
// `import()` fallisce e nessuno riprova, l'utente resta davanti a una schermata
// vuota fino a quando non chiude e riapre l'app: è il bug che questo modulo
// esiste per chiudere.

const chunkError = () => new Error("Importing a module script failed.");

// Il modulo aspetta 400 + 1200 + 3000 ms fra un tentativo e l'altro.
const drainRetries = async () => {
  await vi.advanceTimersByTimeAsync(5000);
};

beforeEach(() => {
  vi.useFakeTimers();
  reload.mockClear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadWithRetry", () => {
  it("non ritenta se il chunk arriva al primo colpo", async () => {
    const loader = vi.fn().mockResolvedValue({ default: "HomePage" });

    await expect(loadWithRetry(loader)).resolves.toEqual({
      default: "HomePage",
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("riprova e va a buon fine quando la rete torna", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValue({ default: "HomePage" });

    const promise = loadWithRetry(loader);
    await drainRetries();

    await expect(promise).resolves.toEqual({ default: "HomePage" });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("ricarica la pagina dopo quattro tentativi falliti", async () => {
    // Quattro fallimenti di fila non sono più una rete ballerina: di solito è
    // un index.html vecchio in cache che punta a un bundle rimosso.
    const loader = vi.fn().mockRejectedValue(chunkError());

    loadWithRetry(loader);
    await drainRetries();

    expect(loader).toHaveBeenCalledTimes(4);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ricarica una volta sola per sessione", async () => {
    const loader = vi.fn().mockRejectedValue(chunkError());

    loadWithRetry(loader);
    await drainRetries();
    expect(reload).toHaveBeenCalledTimes(1);

    // Al giro dopo il fusibile è scattato: niente secondo reload, l'errore
    // risale e a raccoglierlo c'è l'ErrorBoundary con il suo "Riprova".
    const second = loadWithRetry(loader);
    const settled = second.catch((error) => error);
    await drainRetries();

    expect(await settled).toBeInstanceOf(Error);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("riarma il fusibile appena un chunk si carica", async () => {
    const failing = vi.fn().mockRejectedValue(chunkError());
    loadWithRetry(failing);
    await drainRetries();
    expect(sessionStorage.getItem("chunk-reload")).toBe("1");

    await loadWithRetry(vi.fn().mockResolvedValue({ default: "HomePage" }));

    expect(sessionStorage.getItem("chunk-reload")).toBeNull();
  });
});
