import { expect, test } from "@playwright/test";

test("WebKit keeps the Studio settings-to-episode path usable", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ayarlar ve bölüm yönlendirmesi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ayar revizyonunu kaydet" })).toBeVisible();

  await page.goto("/ideas/new");
  await expect(page.getByRole("heading", { name: "Fikir oluştur", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Tür / yönlendirme profili")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fikir oluştur" })).toBeEnabled();
});
