import { defineConfig } from "@playwright/test";

/**
 * E2E del percorso che conta: login → nuovo movimento → saldo aggiornato.
 *
 * Non tocca la produzione: Playwright avvia un backend locale su SQLite usa e
 * getta (backend/scripts/e2e_server.py, porta 8001) e il dev server di Vite
 * (porta 5174) con il proxy /api puntato lì.
 *
 *   npm run test:e2e
 *
 * In locale usa Edge (Chrome non è installato su questo PC); in CI Chromium.
 * I test hanno il suffisso .e2e.ts per non finire dentro vitest.
 */
const CI = !!process.env.CI;
const BACKEND_PORT = 8001;
const FRONTEND_PORT = 5174;
const python =
  process.env.E2E_PYTHON ??
  // Backslash su Windows: cmd.exe leggerebbe "venv/Scripts" come un'opzione.
  (process.platform === "win32" ? "venv\\Scripts\\python.exe" : "python");

export const E2E_API = `http://127.0.0.1:${BACKEND_PORT}/api`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    // Un telefono: l'app si usa soprattutto dalla home dell'iPhone.
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "it-IT",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { browserName: "chromium", channel: CI ? undefined : "msedge" },
    },
  ],
  webServer: [
    {
      command: `${python} scripts/e2e_server.py ${BACKEND_PORT}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      env: { VITE_API_PROXY: `http://127.0.0.1:${BACKEND_PORT}` },
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});
