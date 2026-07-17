import { expect, test } from "@playwright/test";

test("fresh Studio settings default to complete Turkish copy", async ({ context, page }) => {
  await context.clearCookies();
  await page.goto("/settings");

  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ayarlar ve bölüm yönlendirmesi" }),
  ).toBeVisible();
  await page.getByTestId("provider-diagnostics").locator("summary").click();
  await expect(page.getByRole("heading", { name: "ElevenLabs bağlantı tanısı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tanıyı çalıştır" })).toBeVisible();
  await expect(page.getByTestId("settings-advanced").locator("summary")).toHaveText("Gelişmiş");
  await expect(page.getByRole("heading", { name: "Görünüm" })).toBeVisible();
  await expect(page.getByText("Türkçe", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ayarlar" })).toHaveAttribute("aria-current", "page");
});

test("English preference renders settings and episode brief without mixed-language headings", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: "uykuluk_studio_locale", value: "en", url: "http://127.0.0.1:3000" },
  ]);

  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings and episode direction" }),
  ).toBeVisible();
  await page.getByTestId("provider-diagnostics").locator("summary").click();
  await expect(
    page.getByRole("heading", { name: "ElevenLabs connectivity diagnostic" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();

  await page.goto("/ideas/new");
  await expect(page.getByRole("heading", { level: 1, name: "Create ideas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New episode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create ideas" })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Episodes" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("custom brief profile visibly requires operator input before idea creation", async ({
  context,
  page,
}) => {
  await context.clearCookies();
  await page.goto("/ideas/new");

  await page.getByRole("combobox", { name: "Tür / yönlendirme profili" }).click();
  await page.getByRole("option", { name: "Kendi Fikrini Yaz" }).click();
  await expect(page.getByText("Bu profil için fikir metni zorunludur.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fikir oluştur" })).toBeDisabled();
  await page.getByLabel("Bölüm fikri (zorunlu)").fill("Satürn halkalarında kayıp bir sonda.");
  await expect(page.getByRole("button", { name: "Fikir oluştur" })).toBeEnabled();
});

test("settings and episode brief remain usable at mobile width", async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ["/settings", "/ideas/new"]) {
    await page.goto(route);
    await expect(page.getByText("Menü ve görünüm", { exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
