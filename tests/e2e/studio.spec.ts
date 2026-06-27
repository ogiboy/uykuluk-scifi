import { expect, test } from "@playwright/test";

test("studio shell renders operator surfaces", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /manual approval-gated/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run Control" })).toBeVisible();
  await expect(page.getByText("CLI/Core", { exact: true })).toBeVisible();
  await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mutation Service Contracts" })).toBeVisible();
  await expect(page.getByText("Web mutations disabled")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asset Inventory" })).toBeVisible();
});

test("studio module tabs are keyboard reachable", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: /prompts/i }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Runtime prompt inventory");
  await expect(page.getByRole("tabpanel")).toContainText("Studio does not edit prompts");
});

test("studio locale cookie configures the document language", async ({ context, page }) => {
  await context.addCookies([
    {
      name: "uykuluk_studio_locale",
      value: "tr",
      url: "http://127.0.0.1:3000",
    },
  ]);

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
});

test("studio exposes the read-only run index route", async ({ page }) => {
  await page.goto("/runs");

  await expect(page.getByRole("heading", { name: /producer runs/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});

test("studio exposes the read-only visual asset inventory route", async ({ page }) => {
  await page.goto("/assets");

  await expect(page.getByRole("heading", { name: /visual asset inventory/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inventory Overview" })).toBeVisible();
  await expect(page.getByText("does not approve assets")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brand" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});

test("studio exposes the read-only manual analytics feedback route", async ({ page }) => {
  await page.goto("/analytics");

  await expect(page.getByRole("heading", { name: /analytics feedback/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manual Analytics Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import Data Quality" })).toBeVisible();
  await expect(page.getByText("High confidence")).toBeVisible();
  await expect(page.getByText("Missing run links")).toBeVisible();
  await expect(page.getByText("does not call YouTube APIs")).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});

test("studio exposes the read-only runtime prompt inventory route", async ({ page }) => {
  await page.goto("/prompts");

  await expect(page.getByRole("heading", { name: /runtime prompt inventory/i })).toBeVisible();
  await expect(page.getByText("Studio does not edit prompts")).toBeVisible();
  await expect(page.getByText("No prompt inventory warnings")).toBeVisible();
  await expect(page.getByText("prompts/defaults/planner-task.md")).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});
