import { expect, test } from "@playwright/test";

const streamedRouteTimeoutMs = 10_000;

test("WebKit keeps the Studio settings-to-episode path usable", async ({ context, page }) => {
  await context.clearCookies();
  await context.addCookies([
    { name: "uykuluk_studio_locale", value: "tr", url: "http://127.0.0.1:3000" },
  ]);

  const settingsResponse = await page.goto("/settings");
  expect(settingsResponse?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Ayarlar ve bölüm yönlendirmesi" })).toBeVisible({
    timeout: streamedRouteTimeoutMs,
  });
  await expect(page.getByRole("button", { name: "Ayar revizyonunu kaydet" })).toBeVisible();

  const response = await page.goto("/ideas/new");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Fikir oluştur", level: 1 })).toBeVisible({
    timeout: streamedRouteTimeoutMs,
  });
  await expect(page.getByLabel("Tür / yönlendirme profili")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fikir oluştur" })).toBeEnabled();
});
