import { test, expect, type Page } from "@playwright/test";

const PROTECTED_PATHS = [
  "/admin",
  "/admin/dashboard",
  "/admin/usuarios",
  "/admin/areas-membros",
  "/admin/cadastrar-produto",
  "/admin/ofertas",
  "/admin/webhooks",
  "/admin/templates",
  "/admin/criar-quiz",
  "/admin/criar-e-clonar-sites",
  "/admin/espionar-ofertas",
  "/admin/hospedar-videos",
  "/admin/cadastrar-perfect-pay",
];

async function clearSupabaseSession(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-")) localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  });
}

test.describe("Route guard /admin/*", () => {
  test.beforeEach(async ({ page }) => {
    await clearSupabaseSession(page);
  });

  for (const path of PROTECTED_PATHS) {
    test(`redireciona ${path} para /admin/login quando deslogado`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL("**/admin/login", { timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe("/admin/login");
      await expect(page.getByRole("heading", { name: /entrar como administrador/i })).toBeVisible();
    });
  }

  test("/admin/login é acessível sem sessão", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: /entrar como administrador/i })).toBeVisible();
  });
});

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe("Login admin", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD para rodar este teste",
  );

  test("admin loga e acessa o dashboard", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/e-mail/i).fill(ADMIN_EMAIL!);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /entrar no painel/i }).click();

    await page.waitForURL("**/admin/dashboard", { timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/admin/dashboard");

    // Após logado, rotas protegidas não devem mais redirecionar para login.
    await page.goto("/admin/usuarios");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toBe("/admin/usuarios");
  });
});