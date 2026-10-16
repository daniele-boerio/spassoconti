import { describe, it, expect } from "vitest";
import reducer, { mapTransaction } from "./transaction_slice";
import {
  createTransaction,
  flushOfflineTransactions,
  updateTransaction,
} from "./api_calls";
import { QUEUED_OFFLINE } from "./offline_queue";
import type { CreateTransactionParams, Transaction } from "./interfaces";

// Il BE serializza gli importi Decimal come stringhe: `mapTransaction` è il
// confine dove diventano Number per la UI (vedi FE/CLAUDE.md). Questi test
// bloccano quel contratto: importi sempre `number`, e null preservato.

const baseRaw = {
  id: "1",
  data: "2026-07-14",
  descrizione: "Spesa",
  tipo: "USCITA",
  conto_id: "10",
  categoria_id: "5",
  sottocategoria_id: "7",
  tag_id: "3",
  parent_transaction_id: "",
  creationDate: "2026-07-14T00:00:00Z",
  lastUpdate: "2026-07-14T00:00:00Z",
};

// Costruisce una transazione "grezza" come arriva dal BE (importi = stringhe).
const rawTx = (importo: unknown, importo_netto: unknown = null) =>
  ({ ...baseRaw, importo, importo_netto }) as unknown as Transaction;

describe("mapTransaction (money boundary)", () => {
  it("converte importo da stringa Decimal a Number", () => {
    expect(mapTransaction(rawTx("1234.56")).importo).toBe(1234.56);
  });

  it("gestisce zero e negativi", () => {
    expect(mapTransaction(rawTx("0.00")).importo).toBe(0);
    expect(mapTransaction(rawTx("-50.00")).importo).toBe(-50);
  });

  it("restituisce sempre un number per importo (mai una stringa)", () => {
    expect(typeof mapTransaction(rawTx("99.99")).importo).toBe("number");
  });

  it("mantiene importo_netto null quando è null", () => {
    expect(mapTransaction(rawTx("10.00", null)).importo_netto).toBeNull();
  });

  it("converte importo_netto quando presente", () => {
    expect(mapTransaction(rawTx("10.00", "8.20")).importo_netto).toBe(8.2);
  });

  it("non altera gli altri campi della transazione", () => {
    const result = mapTransaction(rawTx("5.00"));
    expect(result.id).toBe("1");
    expect(result.tipo).toBe("USCITA");
    expect(result.descrizione).toBe("Spesa");
    expect(result.conto_id).toBe("10");
  });
});

// --- Scritture: lista, coda offline, revisione ------------------------------


const tx = (id: string, data: string, importo = "10.00") =>
  ({
    ...baseRaw,
    id,
    data,
    lastUpdate: `${data}T00:00:00Z`,
    creationDate: `${data}T00:00:00Z`,
    importo,
    importo_netto: null,
  }) as unknown as Transaction;

const params: CreateTransactionParams = {
  importo: 10,
  tipo: "USCITA",
  data: "2026-10-04",
  descrizione: "Pizza",
  conto_id: "1",
  categoria_id: null,
  sottocategoria_id: null,
  tag_id: null,
  parent_transaction_id: null,
};

const withList = (count: number) => {
  const state = reducer(undefined, { type: "@@init" });
  return {
    ...state,
    pending: [],
    transactions: Array.from({ length: count }, (_, i) =>
      mapTransaction(tx(String(i + 1), `2026-09-${String(10 + (i % 15)).padStart(2, "0")}`)),
    ),
    pagination: { ...state.pagination, size: 10, total: count },
  };
};

describe("scritture sulla lista dei movimenti", () => {
  it("un inserimento non taglia le pagine già caricate", () => {
    const state = withList(25);
    const next = reducer(
      state,
      createTransaction.fulfilled(tx("99", "2026-10-04"), "req", params),
    );
    expect(next.transactions).toHaveLength(26);
    expect(next.transactions[0].id).toBe("99");
  });

  it("una pagina accodata non duplica una riga già in lista", () => {
    const state = withList(3);
    const next = reducer(
      state,
      {
        type: "transazioni/getTransactionsPaginated/fulfilled",
        payload: {
          data: [tx("3", "2026-09-12"), tx("4", "2026-09-01")],
          total: 4,
          page: 2,
          size: 10,
        },
        meta: { arg: { page: 2, size: 10, append: true } },
      },
    );
    expect(next.transactions.map((t) => t.id).sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("la modifica trova la riga anche se l'id arriva come numero", () => {
    const state = withList(2);
    const updated = { ...tx("1", "2026-09-10", "77.00"), id: 1 } as unknown as Transaction;
    const next = reducer(
      state,
      updateTransaction.fulfilled(updated, "req", { ...params, id: "1" } as never),
    );
    expect(next.transactions.find((t) => String(t.id) === "1")?.importo).toBe(77);
  });

  it("senza rete il movimento finisce in coda", () => {
    const state = withList(0);
    const queued = {
      key: "k1",
      owner: "mario",
      params,
      queuedAt: "2026-10-04T10:00:00Z",
    };
    const next = reducer(
      state,
      createTransaction.rejected(null, "req", params, { ...QUEUED_OFFLINE, item: queued }),
    );
    expect(next.pending.map((p) => p.key)).toEqual(["k1"]);
    expect(next.transactions).toHaveLength(0);
  });

  it("l'invio della coda toglie le voci e mostra i movimenti", () => {
    const state = {
      ...withList(0),
      pending: [
        { key: "k1", owner: "mario", params, queuedAt: "x" },
        { key: "k2", owner: "mario", params, queuedAt: "x" },
      ],
    };
    const next = reducer(
      state,
      flushOfflineTransactions.fulfilled(
        { sent: [{ key: "k1", transaction: tx("50", "2026-10-04") }], dropped: ["k2"] },
        "req",
      ),
    );
    expect(next.pending).toEqual([]);
    expect(next.transactions.map((t) => t.id)).toEqual(["50"]);
  });

  it("ogni scrittura riuscita fa avanzare la revisione", () => {
    const state = withList(0);
    const next = reducer(
      state,
      createTransaction.fulfilled(tx("1", "2026-10-04"), "req", params),
    );
    expect(next.revision).toBe(state.revision + 1);
  });
});
