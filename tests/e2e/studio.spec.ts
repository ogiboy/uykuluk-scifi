import { expect, test } from "@playwright/test";

test("studio shell renders operator surfaces", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /manual approval-gated/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run Control" })).toBeVisible();
  await expect(page.getByText("CLI/Core")).toBeVisible();
  await expect(page.getByText("Blocked")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asset Inventory" })).toBeVisible();
});

test("studio module tabs are keyboard reachable", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: /prompts/i }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Prompt edits will need diff");
});
