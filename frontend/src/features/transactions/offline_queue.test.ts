import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  clearFailure,
  dequeue,
  enqueue,
  isNetworkError,
  isQueuedOffline,
  isTransientStatus,
  loadQueue,
  markAttempt,
  markFailed,
  newIdempotencyKey,
  queueOf,
  QUEUED_OFFLINE,
  QueuedTransaction,
  saveQueue,
  sendableOf,
} from "./offline_queue";

const item = (key: string, owner: string | null = "mario"): QueuedTransaction => ({
  key,
  owner,
  queuedAt: "2026-10-04T10:00:00Z",
  params: {
    importo: 12.5,
    tipo: "USCITA",
    data: "2026-10-04",
    descrizione: "Pizza",
    conto_id: "1",
    categoria_id: null,
    sottocategoria_id: null,
    tag_id: null,
    parent_transaction_id: null,
  },
});

describe("coda offline", () => {
  it("la stessa chiave non entra due volte", () => {
    const queue = enqueue(enqueue([], item("a")), item("a"));
    expect(queue).toHaveLength(1);
  });

  it("mantiene l'ordine di inserimento e toglie per chiave", () => {
    const queue = [item("a"), item("b"), item("c")].reduce(enqueue, []);
    expect(dequeue(queue, "b").map((q) => q.key)).toEqual(["a", "c"]);
  });

  it("ognuno invia solo le proprie voci", () => {
    const queue = [item("a", "mario"), item("b", "luigi")];
    expect(queueOf(queue, "mario").map((q) => q.key)).toEqual(["a"]);
    expect(queueOf(queue, null)).toEqual([]);
  });

  it("riconosce il rifiuto 'messo in coda'", () => {
    expect(isQueuedOffline({ ...QUEUED_OFFLINE, item: item("a") })).toBe(true);
    expect(isQueuedOffline({ status: 400, detail: "x" })).toBe(false);
    expect(isQueuedOffline(undefined)).toBe(false);
  });

  it("chiavi diverse a ogni chiamata", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

describe("isNetworkError", () => {
  const config = { headers: new AxiosHeaders() };

  it("nessuna risposta = rete", () => {
    expect(isNetworkError(new AxiosError("Network Error", "ERR_NETWORK", config))).toBe(true);
  });

  it("una risposta del server non è un problema di rete", () => {
    const err = new AxiosError("Bad Request", "ERR_BAD_REQUEST", config, null, {
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config,
      data: {},
    });
    expect(isNetworkError(err)).toBe(false);
  });

  it("una richiesta annullata non va in coda", () => {
    expect(isNetworkError(new AxiosError("canceled", "ERR_CANCELED", config))).toBe(false);
  });

  it("un errore qualunque non è di rete", () => {
    expect(isNetworkError(new Error("boom"))).toBe(false);
  });
});

describe("rifiuti e tentativi", () => {
  it("le voci rifiutate non ripartono da sole", () => {
    const queue = markFailed([item("a"), item("b")], "a", { status: 400, detail: "x" });
    expect(sendableOf(queue, "mario").map((q) => q.key)).toEqual(["b"]);
    // ma restano dell'utente, da mostrare nel banner
    expect(queueOf(queue, "mario").map((q) => q.key)).toEqual(["a", "b"]);
  });

  it("Riprova toglie il rifiuto e azzera i tentativi", () => {
    const queue = markAttempt(
      markFailed([item("a")], "a", { status: 400, detail: null }),
      "a",
      "HTTP 503",
    );
    const [ripresa] = clearFailure(queue, "a");
    expect(ripresa.failed).toBeUndefined();
    expect(ripresa.attempts).toBe(0);
  });

  it("i tentativi si sommano", () => {
    const queue = markAttempt(markAttempt([item("a")], "a", "network"), "a", "HTTP 502");
    expect(queue[0]).toMatchObject({ attempts: 2, lastError: "HTTP 502" });
  });

  it("errori passeggeri contro rifiuti definitivi", () => {
    for (const status of [500, 502, 503, 401, 408, 409, 429]) {
      expect(isTransientStatus(status)).toBe(true);
    }
    for (const status of [400, 403, 404, 422]) {
      expect(isTransientStatus(status)).toBe(false);
    }
  });
});

describe("persistenza sul telefono", () => {
  const storage = new Map<string, string>();
  const original = globalThis.localStorage;

  beforeEach(() => {
    storage.clear();
    globalThis.localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    } as unknown as Storage;
  });

  afterEach(() => {
    globalThis.localStorage = original;
  });

  it("una coda illeggibile non si perde: ne resta una copia", () => {
    storage.set("offline_transactions_v1", "{non è json");
    const errore = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(loadQueue()).toEqual([]);

    const copie = [...storage.keys()].filter((k) => k.includes("_corrupt_"));
    expect(copie).toHaveLength(1);
    expect(storage.get(copie[0])).toBe("{non è json");
    errore.mockRestore();
  });

  it("salvare riporta se lo storage ha rifiutato", () => {
    expect(saveQueue([item("a")])).toBe(true);
    globalThis.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(saveQueue([item("a"), item("b")])).toBe(false);
  });
});
