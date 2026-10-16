import { describe, it, expect, vi } from "vitest";

// `profile_slice` (importato a catena da error_middleware) legge localStorage a
// import-time, e i test girano in ambiente node: va stubbato PRIMA degli import,
// che è esattamente ciò che vi.hoisted garantisce.
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

import { errorMiddleware } from "./error_middleware";
import { setLocale } from "../i18n";

// Cosa finisce davvero nella dialog d'errore. Prima di questi test un 429 mostrava
// "Rejected", un 422 uno sputo di JSON e un 401 non chiudeva la sessione.

setLocale("it");

interface RecordedAction {
  type: string;
  payload?: unknown;
}

interface ShownError {
  title: string;
  message: string;
}

const run = (action: unknown) => {
  const dispatched: RecordedAction[] = [];
  const store = {
    dispatch: (a: RecordedAction) => dispatched.push(a),
    getState: () => ({}),
  };
  const next = vi.fn();

  errorMiddleware(store as never)(next)(action);

  return { dispatched, next };
};

const shown = (dispatched: RecordedAction[]): ShownError => {
  const action = dispatched.find((a) => a.type === "error/showError");
  if (!action) throw new Error("nessuna dialog d'errore è stata mostrata");
  return action.payload as ShownError;
};

const rejected = (type: string, payload: unknown, extra: object = {}) => ({
  type,
  payload,
  meta: {},
  ...extra,
});

describe("errorMiddleware", () => {
  it("lascia passare le azioni che non sono rejected", () => {
    const { dispatched, next } = run({ type: "conti/getConti/fulfilled" });

    expect(dispatched).toHaveLength(0);
    expect(next).toHaveBeenCalled();
  });

  it("mostra il detail del server con un titolo coerente allo status", () => {
    const { dispatched } = run(
      rejected("conti/deleteConto/rejected", {
        status: 404,
        detail: "Conto not found",
      }),
    );

    expect(shown(dispatched)).toEqual({
      title: "Non trovato (404)",
      message: "Conto not found",
    });
  });

  it("aggiunge il riferimento dell'errore sui 500", () => {
    const { dispatched } = run(
      rejected("profile/login/rejected", {
        status: 500,
        detail: "Credentials are valid but the device session could not be created",
        error_id: "ab12cd34",
      }),
    );

    const payload = shown(dispatched);
    expect(payload.title).toBe("Errore del server (500)");
    expect(payload.message).toContain("device session");
    expect(payload.message).toContain("ab12cd34");
  });

  it("traduce il 429 in un'istruzione, non nel messaggio del rate limiter", () => {
    const { dispatched } = run(
      rejected("profile/login/rejected", {
        status: 429,
        detail: "Rate limit exceeded: 10 per 1 minute",
      }),
    );

    const payload = shown(dispatched);
    expect(payload.title).toBe("Troppi tentativi (429)");
    expect(payload.message).toContain("Attendi");
  });

  it("su 401 chiude la sessione e lo dice", () => {
    const { dispatched } = run(
      rejected("conti/getConti/rejected", {
        status: 401,
        detail: "Not authenticated",
      }),
    );

    expect(dispatched.map((a) => a.type)).toContain("profile/setLogout");
    expect(shown(dispatched).title).toBe("Sessione scaduta");
  });

  it("su 401 di login NON sloggia: sono credenziali sbagliate", () => {
    const { dispatched } = run(
      rejected("profile/login/rejected", {
        status: 401,
        detail: "Invalid credentials",
      }),
    );

    expect(dispatched.map((a) => a.type)).not.toContain("profile/setLogout");
    expect(shown(dispatched).message).toBe("Invalid credentials");
  });

  it("distingue il server irraggiungibile dal server che risponde male", () => {
    const { dispatched } = run(
      rejected("conti/getConti/rejected", "Errore ricezione conti"),
    );

    const payload = shown(dispatched);
    expect(payload.title).toBe("Server non raggiungibile");
    expect(payload.message).toContain("Errore ricezione conti");
  });

  it("ripiega su un messaggio localizzato se il server non manda un detail", () => {
    const { dispatched } = run(
      rejected("conti/getConti/rejected", { status: 502, detail: "" }),
    );

    expect(shown(dispatched).message).toBe(
      "Il server ha risposto con un errore. Riprova tra poco.",
    );
  });

  it("ignora i thunk annullati", () => {
    const { dispatched } = run(
      rejected("conti/getConti/rejected", undefined, {
        meta: { aborted: true },
      }),
    );

    expect(dispatched).toHaveLength(0);
  });
});
