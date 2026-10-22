import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_API } from "../playwright.config";

/**
 * La proposta del tag al salvataggio: due spese passate "con Paolo" senza
 * tag, la terza alla pressione di Salva chiede "Creo il tag #paolo?" con
 * l'anteprima; Sì → tutte e tre finiscono in #paolo.
 *
 * Utente, conto e storia si preparano via API.
 */

const PASSWORD = "password-e2e-123";

async function preparaUtente(request: APIRequestContext) {
  const username = `e2etag${Date.now()}`;
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
  const contoId = (await conto.json()).id as number;

  for (const descrizione of ["Pizza con Paolo", "Cena con paolo"]) {
    const r = await request.post(`${E2E_API}/transazioni`, {
      headers: auth,
      data: {
        importo: "10.00",
        tipo: "USCITA",
        data: "2026-10-01",
        conto_id: contoId,
        descrizione,
      },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
  }

  return { username, auth };
}

test("al salvataggio propone il tag nuovo e lo mette anche sulle passate", async ({
  page,
  request,
}) => {
  const { username, auth } = await preparaUtente(request);

  await page.goto("/");
  await page.getByRole("textbox", { name: "Nome utente o email" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  const nuova = page.getByRole("button", { name: "Nuova transazione" });
  await expect(nuova).toBeVisible();

  await nuova.click();
  const sheet = page.getByRole("dialog").filter({ hasText: "Nuova transazione" });
  await sheet.getByRole("textbox", { name: "Importo" }).fill("18");
  await sheet.getByRole("button", { name: /^Conto/ }).click();
  await page.getByRole("button", { name: "Conto E2E", exact: true }).click();
  await sheet.getByRole("textbox", { name: "Descrizione" }).fill("Sushi con Paolo");
  await sheet.getByRole("button", { name: "Salva transazione" }).click();

  // La domanda, con l'anteprima delle due passate spuntate
  const domanda = page.getByRole("dialog").filter({ hasText: "Creo il tag #paolo?" });
  await expect(domanda).toBeVisible();
  await expect(domanda.getByRole("checkbox")).toHaveCount(2);
  await expect(domanda.getByRole("checkbox", { name: /Pizza con Paolo/ })).toBeChecked();

  await domanda.getByRole("button", { name: "Sì, crea #paolo" }).click();
  await expect(page.getByText("Sushi con Paolo")).toBeVisible();

  // Il backend: il tag esiste e ha tutte e tre le transazioni
  const tags = await (await request.get(`${E2E_API}/tags`, { headers: auth })).json();
  const paolo = tags.find((tag: { nome: string }) => tag.nome === "paolo");
  expect(paolo).toBeTruthy();
  expect(paolo.n_transazioni).toBe(3);
});
