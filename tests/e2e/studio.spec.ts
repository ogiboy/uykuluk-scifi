import { expect, test } from "@playwright/test";

test("studio shell renders operator surfaces", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.headers()["x-powered-by"]).toBeUndefined();
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response?.headers()["permissions-policy"]).toBe(
    "camera=(), geolocation=(), microphone=()",
  );
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");

  await expect(
    page.getByRole("heading", { name: /control uykulukscifi production/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current production queue" })).toBeVisible();
  const operatorBrief = page.getByRole("region", { name: "Operator brief" });
  await expect(operatorBrief).toBeVisible();
  await expect(operatorBrief).toContainText("Next safe action");
  await expect(page.getByRole("heading", { name: "Run snapshot" })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Studio safety and queue summary" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Home shortcuts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /focused operator pages/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open ideas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open doctor" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open analytics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open assets" })).toBeVisible();
});

test("studio exposes guarded action contracts on the actions route", async ({ page }) => {
  const response = await page.goto("/actions");

  expect(response?.headers()["permissions-policy"]).toBe(
    "camera=(), geolocation=(), microphone=()",
  );
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");

  await expect(page.getByRole("heading", { exact: true, name: "Actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /same-origin/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflow Control Matrix" })).toBeVisible();
  await expect(page.getByText("Idea intake")).toBeVisible();
  await expect(page.getByText("Local media review")).toBeVisible();
  await expect(page.getByRole("region", { name: "Run action queue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Route contracts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mutation Service Contracts" })).toBeVisible();
  await expect(page.getByText("Web Controls", { exact: true })).toBeVisible();
  await expect(page.getByText("CLI Fallbacks", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /render\.decide/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "publish.schedule disabled" })).toBeVisible();
});

test("studio locale cookie configures the document language", async ({ context, page }) => {
  await context.addCookies([
    { name: "uykuluk_studio_locale", value: "tr", url: "http://127.0.0.1:3000" },
  ]);

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
});

test("studio exposes the read-only run index route", async ({ page }) => {
  await page.goto("/runs");

  await expect(page.getByRole("heading", { name: /producer runs/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});

test("studio exposes the read-only idea history route", async ({ page }) => {
  await page.goto("/ideas");

  await expect(page.getByRole("heading", { name: /idea history/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /generated and approved titles/i })).toBeVisible();
  await expect(page.getByText("Runtime idea history")).toBeVisible();
  await expect(page.getByText("Generated + approved")).toBeVisible();
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
  await expect(
    page.getByText("Read-only display from local operator-provided analytics artifacts."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});

test("studio exposes the read-only runtime prompt inventory route", async ({ page }) => {
  await page.goto("/prompts");

  await expect(
    page.getByRole("heading", { level: 1, name: /runtime prompt inventory/i }),
  ).toBeVisible();
  await expect(page.getByText("Studio does not edit prompts")).toBeVisible();
  await expect(page.getByText("No prompt inventory warnings")).toBeVisible();
  await expect(page.getByText("prompts/defaults/planner-task.md").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});

test("studio exposes the read-only producer doctor diagnostics route", async ({ page }) => {
  await page.goto("/doctor");

  await expect(page.getByRole("heading", { name: /producer doctor diagnostics/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doctor Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next Safe Action" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run doctor" })).toBeVisible();
  await expect(page.getByText("Studio can refresh local doctor artifacts")).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio home" })).toBeVisible();
});
