import { describe, it, expect, vi } from "vitest";

// `profile_slice` legge localStorage a import-time e i test girano in node:
// va stubbato PRIMA degli import (vedi store/error_middleware.test.ts).
vi.hoisted(() => {
  const values = new Map<string, string>();
  // Sessione già salvata sul dispositivo: è lo stato da cui l'app riparte al
  // secondo avvio, e quello in cui il bug dello username si vedeva.
  values.set("username", "mario.rossi");
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

import reducer, { selectLastTagId } from "./profile_slice";
import { getProfile, logout } from "./api_calls";
import { ProfileResponse } from "./interfaces";
import { createTransaction } from "../transactions/api_calls";
import { Transaction } from "../transactions/interfaces";
import { RootState } from "../../store/store";

// `last_tag_id` è il tag da precompilare nel form di nuova transazione. Arriva
// dal BE come intero e nel resto del FE gli id della tassonomia sono stringhe:
// se la conversione salta, la Dropdown non trova l'opzione e non preseleziona
// niente (bug muto, la UI sembra solo "non ricordarsi").

const initial = reducer(undefined, { type: "@@INIT" });

const profileFromServer = (last_tag_id: number | null) =>
  getProfile.fulfilled(
    {
      username: "mario",
      email: "mario@example.it",
      last_tag_id,
    } as ProfileResponse,
    "req",
    undefined,
  );

describe("profile_slice — ultimo tag usato", () => {
  it("normalizza a stringa l'id che arriva dal BE", () => {
    const state = reducer(initial, profileFromServer(7));

    expect(state.lastTagId).toBe("7");
  });

  it("azzera il default quando il BE non ne ha uno", () => {
    const conTag = reducer(initial, profileFromServer(7));

    const senzaTag = reducer(conTag, profileFromServer(null));

    expect(senzaTag.lastTagId).toBeNull();
  });

  it("non lascia il default di un utente all'utente successivo", () => {
    const conTag = reducer(initial, profileFromServer(7));

    const dopoLogout = reducer(
      conTag,
      logout.fulfilled(undefined, "req", undefined),
    );

    expect(dopoLogout.lastTagId).toBeNull();
  });

  it("espone il default via selector", () => {
    const state = reducer(initial, profileFromServer(7));

    expect(selectLastTagId({ profile: state } as RootState)).toBe("7");
  });
});

// Lo slice rispecchia la regola del BE su quando il default si muove (vedi
// create_transazione). Questi test sono il gemello lato FE di
// BE/tests/test_ultimo_tag_usato.py: se una delle due parti cambia da sola,
// una delle due suite deve diventare rossa.

// `Transaction` dichiara tag_id e parent_transaction_id come `string`, ma il BE
// li manda a null: tipizziamo qui i soli campi che i test fanno variare, invece
// di allargare l'interfaccia condivisa solo per i test.
const transazioneCreata = (tx: {
  tipo?: string;
  tag_id?: string | null;
  parent_transaction_id?: string | null;
}) =>
  createTransaction.fulfilled(
    {
      id: "1",
      importo: 10,
      tipo: "USCITA",
      data: new Date().toISOString(),
      conto_id: "1",
      tag_id: null,
      parent_transaction_id: null,
      ...tx,
    } as unknown as Transaction,
    "req",
    {} as never,
  );

describe("profile_slice — il default segue le transazioni create", () => {
  it("adotta il tag della transazione appena creata", () => {
    const state = reducer(initial, transazioneCreata({ tag_id: "7" }));

    expect(state.lastTagId).toBe("7");
  });

  it("si azzera se la transazione è stata salvata senza tag", () => {
    const conTag = reducer(initial, profileFromServer(7));

    const state = reducer(conTag, transazioneCreata({ tag_id: null }));

    expect(state.lastTagId).toBeNull();
  });

  it("il giroconto non tocca il default", () => {
    const conTag = reducer(initial, profileFromServer(7));

    const state = reducer(
      conTag,
      transazioneCreata({ tipo: "RICARICA", tag_id: null }),
    );

    expect(state.lastTagId).toBe("7");
  });

  it("il rimborso non tocca il default", () => {
    const conTag = reducer(initial, profileFromServer(7));

    const state = reducer(
      conTag,
      transazioneCreata({
        tipo: "RIMBORSO",
        parent_transaction_id: "42",
        tag_id: "99",
      }),
    );

    expect(state.lastTagId).toBe("7");
  });
});

// Lo username in stato iniziale viene da localStorage e deve essere la stringa
// nuda: la HomePage lo monta prima che /me risponda (il token salvato basta a
// dirla autenticata) e ne ricava le iniziali con uno `split`. Quando qui c'era
// un oggetto, l'avvio con sessione salvata moriva nell'ErrorBoundary.

describe("profile_slice — sessione ripresa da localStorage", () => {
  it("parte con lo username salvato come stringa", () => {
    expect(initial.username).toBe("mario.rossi");
  });

  it("lo username resta una stringa dopo la risposta del server", () => {
    const state = reducer(initial, profileFromServer(null));

    expect(state.username).toBe("mario");
  });
});
