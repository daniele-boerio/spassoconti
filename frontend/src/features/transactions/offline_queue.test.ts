import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  dequeue,
  enqueue,
  isNetworkError,
  isQueuedOffline,
  newIdempotencyKey,
  queueOf,
  QUEUED_OFFLINE,
  QueuedTransaction,
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
