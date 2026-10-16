import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_API } from "../playwright.config";

/**
 * Il percorso che conta, dall'inizio alla fine come lo fa l'utente:
 * entra, registra una spesa, e il saldo del conto scende di quella cifra.
 *
 * L'utente e il conto (saldo 100) si preparano via API, così il test
 * misura il flusso e non la registrazione.
 */

const PASSWORD = "password-e2e-123";

async function preparaUtente(request: APIRequestContext) {
  const username = `e2e${Date.now()}`;
  const reg = await request.post(`${E2E_API}/register`, {
    data: { username, email: `${username}@example.com`, password: PASSWORD },
  });
  expect(reg.ok(), await reg.text()).toBeTruthy();
  const { access_token } = await reg.json();
  const auth = { Authorization: `Bearer ${access_token}` };

  const conto = await request.post(`${E2E_API}/conti`, {
    headers: auth,
    data: { nome: "Conto E2E", saldo: 100 },
  });
  expect(conto.ok(), await conto.text()).toBeTruthy();

  return { username, auth, contoId: (await conto.json()).id as number };
}

test("login → nuova spesa → saldo del conto aggiornato", async ({ page, request }) => {
  const { username, auth, contoId } = await preparaUtente(request);

  // Login
  await page.goto("/");
  await page.getByRole("textbox", { name: "Nome utente o email" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Accedi" }).click();
  const nuova = page.getByRole("button", { name: "Nuova transazione" });
  await expect(nuova).toBeVisible();

  // Nuova spesa di 25 € sul conto
  await nuova.click();
  const sheet = page.getByRole("dialog").filter({ hasText: "Nuova transazione" });
  await sheet.getByRole("textbox", { name: "Importo" }).fill("25");
  await sheet.getByRole("button", { name: /^Conto/ }).click();
  await page.getByRole("button", { name: "Conto E2E", exact: true }).click();
  await sheet.getByRole("textbox", { name: "Descrizione" }).fill("Spesa E2E");
  await sheet.getByRole("button", { name: "Salva transazione" }).click();

  // Home: la spesa compare tra le uscite del mese e negli ultimi movimenti
  await expect(page.getByRole("button", { name: /^Uscite 25/ })).toBeVisible();
  await expect(page.getByText("Spesa E2E")).toBeVisible();

  // Conti: il saldo è sceso da 100 a 75
  await page.getByRole("link", { name: "Conti" }).click();
  const card = page.locator(".account-card", { hasText: "Conto E2E" });
  await expect(card).toContainText("75,00");

  // E il backend è d'accordo (saldo vero, non solo quello disegnato)
  const conti = await request.get(`${E2E_API}/conti`, { headers: auth });
  const conto = (await conti.json()).find((c: { id: number }) => c.id === contoId);
  expect(conto.saldo).toBe("75.00");
});
