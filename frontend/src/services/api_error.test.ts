import { describe, it, expect } from "vitest";
import { toApiError, isApiError } from "./api_error";

// Il BE risponde in formati diversi a seconda di chi genera l'errore (router,
// validazione FastAPI, rate limiter, proxy). `toApiError` è il punto in cui
// diventano tutti `{status, detail}`: se salta, la UI torna a mostrare JSON grezzo.

describe("toApiError", () => {
  it("estrae il detail dei router", () => {
    expect(toApiError(401, { detail: "Invalid credentials" })).toEqual({
      status: 401,
      detail: "Invalid credentials",
    });
  });

  it("appiattisce gli errori di validazione 422 in campo: messaggio", () => {
    const body = {
      detail: [
        { loc: ["body", "importo"], msg: "Input should be a valid number" },
        { loc: ["body", "data"], msg: "Field required" },
      ],
    };

    expect(toApiError(422, body).detail).toBe(
      "importo: Input should be a valid number; data: Field required",
    );
  });

  it("legge il formato {error} del rate limiter", () => {
    expect(toApiError(429, { error: "Rate limit exceeded: 10 per 1 minute" }))
      .toEqual({ status: 429, detail: "Rate limit exceeded: 10 per 1 minute" });
  });

  it("conserva l'error_id del BE", () => {
    const parsed = toApiError(500, {
      detail: "Unexpected server error on POST /login (reference ab12cd34)",
      error_id: "ab12cd34",
    });

    expect(parsed.error_id).toBe("ab12cd34");
  });

  it("accetta un corpo testuale", () => {
    expect(toApiError(500, "Internal Server Error").detail).toBe(
      "Internal Server Error",
    );
  });

  it("scarta le pagine d'errore HTML dei proxy", () => {
    expect(toApiError(502, "<html><body>502 Bad Gateway</body></html>").detail)
      .toBe("");
  });

  it("non inventa un detail quando il corpo non ne ha uno", () => {
    expect(toApiError(500, undefined)).toEqual({ status: 500, detail: "" });
    expect(toApiError(500, { foo: "bar" }).detail).toBe("");
  });

  it("è idempotente (l'interceptor può girare due volte)", () => {
    const once = toApiError(404, { detail: "Conto not found" });
    expect(toApiError(404, once)).toBe(once);
  });
});

describe("isApiError", () => {
  it("riconosce solo la forma normalizzata", () => {
    expect(isApiError({ status: 500, detail: "x" })).toBe(true);
    expect(isApiError({ detail: "x" })).toBe(false);
    expect(isApiError("Errore di rete")).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});
